import { calendarDaysInclusive } from "./dates";
import {
  PricingError,
  type CouponInput,
  type PriceInput,
  type PriceLine,
  type PriceResult,
  type PriceTableInput,
  type PricingOverrides,
  type PricingSettings,
} from "./types";

function assertCount(name: string, value: number, min = 0): void {
  if (!Number.isInteger(value) || value < min) {
    throw new PricingError("INVALID_COUNT", `${name} must be an integer >= ${min}`);
  }
}

/** Brand settings with the rate's non-null overrides applied. `false` and `0` overrides are honoured. */
export function resolveSettings(
  brand: PricingSettings,
  overrides: PricingOverrides = {},
): PricingSettings {
  return {
    personsIncluded: overrides.personsIncluded ?? brand.personsIncluded,
    extraPersonPriceCents: overrides.extraPersonPriceCents ?? brand.extraPersonPriceCents,
    kidsCountAsPerson: overrides.kidsCountAsPerson ?? brand.kidsCountAsPerson,
    seatsEnabled: overrides.seatsEnabled ?? brand.seatsEnabled,
    seatPriceCents: overrides.seatPriceCents ?? brand.seatPriceCents,
    oversizeSurchargePct: overrides.oversizeSurchargePct ?? brand.oversizeSurchargePct,
  };
}

function parkingCents(days: number, table: PriceTableInput): number {
  if (table.dayPriceCents.length !== 30) {
    throw new PricingError("INVALID_PRICE_TABLE", "Price table needs exactly 30 day prices");
  }
  if (days <= 30) return table.dayPriceCents[days - 1];
  return table.dayPriceCents[29] + (days - 30) * table.extraDayCents;
}

function couponDiscountCents(coupon: CouponInput, subtotal: number, now: Date): number {
  const started = !coupon.validFrom || now >= coupon.validFrom;
  const notExpired = !coupon.validUntil || now <= coupon.validUntil;
  if (!coupon.active || !started || !notExpired) {
    throw new PricingError("COUPON_INVALID", "Coupon is inactive or outside its validity dates");
  }
  if (coupon.kind === "PERCENT") {
    if (coupon.value < 0 || coupon.value > 100) {
      throw new PricingError("COUPON_INVALID", "Percent coupon must be between 0 and 100");
    }
    return Math.round((subtotal * coupon.value) / 100);
  }
  return Math.min(Math.max(coupon.value, 0), subtotal); // fixed: never more than the price
}

/**
 * Pure price calculation for one booking.
 * Order: parking (by calendar days) → oversize % on parking only → extra persons → child seats
 * → extras → subtotal → one discount (coupon OR returning-customer, the larger) → total.
 */
export function calculatePrice(input: PriceInput): PriceResult {
  const { arrival, departure, table, settings, now } = input;
  const extras = input.extras ?? [];

  assertCount("adults", input.adults, 1);
  assertCount("kids", input.kids);
  assertCount("seatBaby", input.seatBaby);
  assertCount("seatKind", input.seatKind);
  assertCount("seatBoost", input.seatBoost);

  const days = calendarDaysInclusive(arrival, departure);
  if (days < 1) {
    throw new PricingError("INVALID_DATES", "Departure must not be before arrival");
  }

  const lines: PriceLine[] = [];

  // Parking
  const parking = parkingCents(days, table);
  lines.push({
    kind: "parking",
    label: `Parken (${days} ${days === 1 ? "Tag" : "Tage"})`,
    quantity: 1,
    unitCents: parking,
    totalCents: parking,
  });

  // Oversize: % of the parking price only
  if (input.oversize && settings.oversizeSurchargePct > 0) {
    const amount = Math.round((parking * settings.oversizeSurchargePct) / 100);
    lines.push({
      kind: "oversize",
      label: `Aufschlag Übergröße (${settings.oversizeSurchargePct} %)`,
      quantity: 1,
      unitCents: amount,
      totalCents: amount,
    });
  }

  // Persons: adults (+ kids if configured); included persons are free
  const persons = input.adults + (settings.kidsCountAsPerson ? input.kids : 0);
  const extraPersons = Math.max(0, persons - settings.personsIncluded);
  if (extraPersons > 0 && settings.extraPersonPriceCents > 0) {
    lines.push({
      kind: "extra_persons",
      label: "Zusätzliche Personen",
      quantity: extraPersons,
      unitCents: settings.extraPersonPriceCents,
      totalCents: extraPersons * settings.extraPersonPriceCents,
    });
  }

  // Child seats
  const seatCount = input.seatBaby + input.seatKind + input.seatBoost;
  if (seatCount > 0 && !settings.seatsEnabled) {
    throw new PricingError("SEATS_DISABLED", "Child seats are switched off for this rate");
  }
  if (seatCount > 0 && settings.seatPriceCents > 0) {
    lines.push({
      kind: "seats",
      label: "Kindersitze",
      quantity: seatCount,
      unitCents: settings.seatPriceCents,
      totalCents: seatCount * settings.seatPriceCents,
    });
  }

  // Extras
  for (const e of extras) {
    assertCount(`extra quantity (${e.name})`, e.quantity);
    if (e.quantity === 0) continue;
    lines.push({
      kind: "extra",
      label: e.name,
      quantity: e.quantity,
      unitCents: e.priceCents,
      totalCents: e.quantity * e.priceCents,
    });
  }

  const subtotalCents = lines.reduce((sum, l) => sum + l.totalCents, 0);

  // One discount: coupon or returning-customer, whichever is larger (tie → coupon)
  let discountCents = 0;
  let discountSource: PriceResult["discountSource"] = null;
  let discountLabel = "";

  if (input.coupon) {
    discountCents = couponDiscountCents(input.coupon, subtotalCents, now);
    discountSource = "coupon";
    discountLabel =
      input.coupon.kind === "PERCENT" ? `Gutschein (${input.coupon.value} %)` : "Gutschein";
  }
  const returningPct = input.returningDiscountPct ?? 0;
  if (returningPct > 0) {
    const returning = Math.round((subtotalCents * returningPct) / 100);
    if (returning > discountCents) {
      discountCents = returning;
      discountSource = "returning";
      discountLabel = `Stammkunden-Rabatt (${returningPct} %)`;
    }
  }

  if (discountCents > 0) {
    lines.push({
      kind: "discount",
      label: discountLabel,
      quantity: 1,
      unitCents: -discountCents,
      totalCents: -discountCents,
    });
  } else {
    discountSource = null;
  }

  return {
    days,
    persons,
    lines,
    subtotalCents,
    discountCents,
    discountSource,
    totalCents: subtotalCents - discountCents,
  };
}

/** Result of re-pricing an edited booking: positive = customer owes more, negative = refund. */
export function priceDifference(oldTotalCents: number, newTotalCents: number) {
  const differenceCents = newTotalCents - oldTotalCents;
  const kind =
    differenceCents > 0 ? ("extra_payment" as const)
    : differenceCents < 0 ? ("refund" as const)
    : ("none" as const);
  return { differenceCents, kind };
}
