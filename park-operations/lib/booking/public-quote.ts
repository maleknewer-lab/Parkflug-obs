// Server side of the public price quote (Phase 3, PR 1). Loads the brand, its bookable rates and
// extras, then prices the trip with the SAME code path the admin uses (computeBookingPrice →
// lib/pricing). Nothing price-related is ever taken from the browser. Creates no booking.
import { db } from "@/lib/db";
import { formatBerlin, type PriceResult } from "@/lib/pricing";
import { checkLeadTime } from "./rules";
import { parseQuoteParams, type QuoteData } from "./quote";
import { computeBookingPrice, type PricedExtra } from "./server";

export async function loadPublicBrand(slug: string) {
  return db.brand.findFirst({
    where: { slug, active: true },
    select: {
      id: true,
      slug: true,
      name: true,
      logoUrl: true,
      colors: true,
      termsUrl: true,
      impressumUrl: true,
      privacyUrl: true,
      minLeadHours: true,
      freeCancelHours: true,
      seatsEnabled: true,
      statementDescriptor: true,
      paymentAccount: { select: { id: true, slug: true, name: true, envKey: true, active: true } },
      rates: {
        // Only rates that can actually be priced: active AND with a base price table
        where: { active: true, priceTables: { some: { seasonId: null } } },
        orderBy: { sort: "asc" },
        select: { id: true, name: true, service: true, lotType: true, seatsEnabled: true },
      },
      extras: {
        where: { active: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, priceCents: true },
      },
    },
  });
}

export type PublicBrand = NonNullable<Awaited<ReturnType<typeof loadPublicBrand>>>;

export type PublicQuote =
  | { state: "idle" }
  | { state: "error"; error: string }
  | {
      state: "ok";
      data: QuoteData;
      result: PriceResult;
      rateName: string;
      /** Needed to create the booking (same price run, never recomputed from browser data). */
      brandId: string;
      extras: PricedExtra[];
      couponId: string | null;
    };

/** `get` reads one query parameter as a string ("" when missing). `now` is passed in (testable). */
export async function quoteForBrand(
  brand: PublicBrand,
  get: (name: string) => string,
  now: Date,
): Promise<PublicQuote> {
  // Nothing submitted yet → show the empty form without errors
  if (get("rateId") === "" && get("arrivalAt") === "" && get("departureAt") === "") {
    return { state: "idle" };
  }

  const parsed = parseQuoteParams(get, { extraIds: brand.extras.map((e) => e.id) });
  if (!parsed.ok) return { state: "error", error: parsed.error };
  const data = parsed.data;

  // The rate must belong to THIS brand's bookable rates (never trust the id from the URL)
  const rate = brand.rates.find((r) => r.id === data.rateId);
  if (!rate) return { state: "error", error: "Dieser Tarif ist nicht verfügbar" };

  const lead = checkLeadTime(data.arrivalAt, now, brand.minLeadHours);
  if (!lead.ok) {
    return {
      state: "error",
      error: `Online-Buchungen sind frühestens ${brand.minLeadHours} Std. vor der Anreise möglich (früheste Anreise: ${formatBerlin(lead.earliestArrival)} Uhr). Bitte rufen Sie uns an, wenn es kurzfristiger sein muss.`,
    };
  }

  const priced = await computeBookingPrice({ rateId: data.rateId, data, now });
  if (!priced.ok) return { state: "error", error: priced.error };
  return {
    state: "ok",
    data,
    result: priced.result,
    rateName: rate.name,
    brandId: priced.brandId,
    extras: priced.extras,
    couponId: priced.couponId,
  };
}

/** Like quoteForBrand, but an unexpected failure (database, bug) is logged with its real cause and shown
 *  as a friendly message instead of a crashed page. Search the server log for "[public-quote]". */
export async function safeQuoteForBrand(
  brand: PublicBrand,
  get: (name: string) => string,
  now: Date,
): Promise<PublicQuote> {
  try {
    return await quoteForBrand(brand, get, now);
  } catch (e) {
    console.error("[public-quote] failed:", e);
    // Staging only: with PUBLIC_DEBUG=1 in the environment the real cause is shown on the page.
    // Remove the variable again before the pages go public.
    const detail = process.env.PUBLIC_DEBUG === "1" && e instanceof Error ? ` [${e.name}: ${e.message.slice(0, 400)}]` : "";
    return { state: "error", error: `Der Preis konnte gerade nicht berechnet werden. Bitte versuchen Sie es in einem Moment erneut.${detail}` };
  }
}
