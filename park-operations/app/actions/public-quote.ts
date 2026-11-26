"use server";

// Live price for the public booking form (no personal data). Called while the visitor changes dates,
// persons, extras or the coupon. Everything is decided on the server with the same code as the final
// booking: the browser only displays what comes back. Rate limiting for this endpoint comes with PR 4.

import { loadPublicBrand, quoteForBrand } from "@/lib/booking/public-quote";

export type PublicQuoteView =
  | {
      ok: true;
      rateName: string;
      days: number;
      persons: number;
      lines: { label: string; quantity: number; totalCents: number }[];
      discountCents: number;
      totalCents: number;
      rateTotals: Record<string, number>;
    }
  | { ok: false; error: string; rateTotals: Record<string, number> };

const TRIP_FIELDS = ["rateId", "arrivalAt", "departureAt", "adults", "kids", "seatBaby", "seatKind", "seatBoost", "oversize", "couponCode"];

export async function quotePublicAction(input: { slug: string; fields: Record<string, string> }): Promise<PublicQuoteView> {
  try {
    const brand = await loadPublicBrand(String(input?.slug ?? "").slice(0, 60));
    if (!brand) return { ok: false, error: "Diese Buchungsseite ist nicht verfügbar", rateTotals: {} };

    const allowed = new Set([...TRIP_FIELDS, ...brand.extras.map((e) => `extra_${e.id}`)]);
    const raw = input.fields ?? {};
    const get = (name: string) => (allowed.has(name) ? String(raw[name] ?? "").slice(0, 60) : "");
    const now = new Date();

    // Price of EVERY bookable rate for these dates (shown on the rate cards)
    const rateTotals: Record<string, number> = {};
    await Promise.all(
      brand.rates.map(async (r) => {
        const q = await quoteForBrand(brand, (n) => (n === "rateId" ? r.id : get(n)), now);
        if (q.state === "ok") rateTotals[r.id] = q.result.totalCents;
      }),
    );

    const main = await quoteForBrand(brand, get, now);
    if (main.state !== "ok") {
      return { ok: false, error: main.state === "error" ? main.error : "Bitte Reisedaten angeben", rateTotals };
    }
    return {
      ok: true,
      rateName: main.rateName,
      days: main.result.days,
      persons: main.result.persons,
      lines: main.result.lines.map((l) => ({ label: l.label, quantity: l.quantity, totalCents: l.totalCents })),
      discountCents: main.result.discountCents,
      totalCents: main.result.totalCents,
      rateTotals,
    };
  } catch (e) {
    console.error("[public-quote-action] failed:", e);
    const detail = process.env.PUBLIC_DEBUG === "1" && e instanceof Error ? ` [${e.name}: ${e.message.slice(0, 300)}]` : "";
    return { ok: false, error: `Der Preis konnte gerade nicht berechnet werden.${detail}`, rateTotals: {} };
  }
}
