// Server-side price calculation for a booking: loads rate, price table, extras and coupon from the DB
// and calls the pure calculatePrice(). Never trusts prices coming from the browser.
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  calculatePrice,
  PricingError,
  resolveSettings,
  type PriceResult,
  type PricingErrorCode,
} from "@/lib/pricing";
import type { BookingFormData } from "./form";

const PRICING_ERRORS: Record<PricingErrorCode, string> = {
  INVALID_DATES: "Abreise liegt vor der Anreise",
  INVALID_COUNT: "Ungültige Anzahl bei Personen, Sitzen oder Extras",
  INVALID_PRICE_TABLE: "Die Preisliste dieses Tarifs ist unvollständig",
  SEATS_DISABLED: "Kindersitze sind für diesen Tarif nicht aktiviert",
  COUPON_INVALID: "Gutschein ist nicht gültig (abgelaufen, inaktiv oder noch nicht gültig)",
};

export type PricedExtra = { extraId: string; name: string; quantity: number; priceCents: number };

export type PricedBooking =
  | { ok: true; brandId: string; result: PriceResult; extras: PricedExtra[]; couponId: string | null }
  | { ok: false; error: string };

type PriceFields = Pick<
  BookingFormData,
  "arrivalAt" | "departureAt" | "adults" | "kids" | "seatBaby" | "seatKind" | "seatBoost" | "oversize" | "extras" | "couponCode"
>;

export async function computeBookingPrice(args: {
  rateId: string;
  data: PriceFields;
  /** Edit: extras already on the booking keep their old price (snapshot). */
  keepExtraPrices?: Map<string, number>;
  allowInactive?: boolean;
  now: Date;
}): Promise<PricedBooking> {
  const err = (error: string): PricedBooking => ({ ok: false, error });
  const { data } = args;

  const rate = await db.rate.findUnique({
    where: { id: args.rateId },
    include: { brand: true, priceTables: { where: { seasonId: null } } },
  });
  if (!rate) return err("Tarif nicht gefunden");
  if (!rate.active && !args.allowInactive) return err("Dieser Tarif ist nicht aktiv");
  const table = rate.priceTables[0];
  if (!table) return err("Für diesen Tarif sind noch keine Preise hinterlegt");

  // Extras: must belong to the same brand; inactive ones only if already on the booking
  const rows = data.extras.length
    ? await db.extra.findMany({
        where: { id: { in: data.extras.map((e) => e.extraId) }, brandId: rate.brandId },
      })
    : [];
  const extras: PricedExtra[] = [];
  for (const wanted of data.extras) {
    const row = rows.find((r) => r.id === wanted.extraId);
    if (!row) return err("Ein gewähltes Extra gehört nicht zu dieser Marke");
    const kept = args.keepExtraPrices?.get(row.id);
    if (!row.active && kept === undefined) return err(`Extra „${row.name}“ ist nicht aktiv`);
    extras.push({ extraId: row.id, name: row.name, quantity: wanted.quantity, priceCents: kept ?? row.priceCents });
  }

  // Coupon: by code, brand-specific or global
  let coupon = null;
  let couponId: string | null = null;
  if (data.couponCode) {
    const c = await db.coupon.findUnique({ where: { code: data.couponCode } });
    if (!c) return err("Gutschein unbekannt");
    if (c.brandId && c.brandId !== rate.brandId) return err("Gutschein gilt nicht für diese Marke");
    coupon = { kind: c.kind, value: c.value, validFrom: c.validFrom, validUntil: c.validUntil, active: c.active };
    couponId = c.id;
  }

  try {
    const result = calculatePrice({
      arrival: data.arrivalAt,
      departure: data.departureAt,
      adults: data.adults,
      kids: data.kids,
      seatBaby: data.seatBaby,
      seatKind: data.seatKind,
      seatBoost: data.seatBoost,
      oversize: data.oversize,
      table: { dayPriceCents: table.dayPriceCents, extraDayCents: table.extraDayCents },
      settings: resolveSettings(rate.brand, rate),
      extras: extras.map((e) => ({ name: e.name, priceCents: e.priceCents, quantity: e.quantity })),
      coupon,
      now: args.now,
    });
    return { ok: true, brandId: rate.brandId, result, extras, couponId };
  } catch (e) {
    if (e instanceof PricingError) return err(PRICING_ERRORS[e.code]);
    throw e;
  }
}

/** JSON stored in Booking.priceBreakdown (shown on the booking page, later on the invoice). */
export function breakdownJson(result: PriceResult, manualPriceCents: number | null): Prisma.InputJsonObject {
  return {
    days: result.days,
    persons: result.persons,
    lines: result.lines.map((l) => ({ ...l })),
    subtotalCents: result.subtotalCents,
    discountCents: result.discountCents,
    calculatedTotalCents: result.totalCents,
    manualPriceCents,
  };
}

/** What recomputeStoredBooking needs from a stored booking (structural, so any query shape fits). */
export type BookingForPricing = {
  rateId: string;
  createdAt: Date;
  arrivalAt: Date;
  departureAt: Date;
  adults: number;
  kids: number;
  seatBaby: number;
  seatKind: number;
  seatBoost: number;
  oversize: boolean;
  coupon: { code: string } | null;
  extras: { extraId: string; quantity: number; priceCents: number }[];
};

/**
 * Re-prices a stored booking with today's price list. Extras keep the price they had when booked,
 * an already used coupon is judged at the booking's creation date, inactive rates are fine.
 */
export function recomputeStoredBooking(b: BookingForPricing): Promise<PricedBooking> {
  return computeBookingPrice({
    rateId: b.rateId,
    data: {
      arrivalAt: b.arrivalAt,
      departureAt: b.departureAt,
      adults: b.adults,
      kids: b.kids,
      seatBaby: b.seatBaby,
      seatKind: b.seatKind,
      seatBoost: b.seatBoost,
      oversize: b.oversize,
      extras: b.extras.map((e) => ({ extraId: e.extraId, quantity: e.quantity })),
      couponCode: b.coupon?.code ?? null,
    },
    keepExtraPrices: new Map(b.extras.map((e) => [e.extraId, e.priceCents])),
    allowInactive: true,
    now: b.createdAt,
  });
}
