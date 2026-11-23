// Pure pricing types. No Prisma, no DB, no I/O — see CLAUDE.md §4 ("business logic lives in /lib").
// All money values are integer cents.

export type PricingSettings = {
  personsIncluded: number;
  extraPersonPriceCents: number;
  kidsCountAsPerson: boolean;
  seatsEnabled: boolean;
  seatPriceCents: number;
  oversizeSurchargePct: number;
};

/** Per-rate overrides: null/undefined = use the brand's value. */
export type PricingOverrides = {
  [K in keyof PricingSettings]?: PricingSettings[K] | null;
};

export type PriceTableInput = {
  /** index 0 = 1 day … index 29 = 30 days */
  dayPriceCents: number[];
  /** price per day beyond 30 */
  extraDayCents: number;
};

export type ExtraInput = { name: string; priceCents: number; quantity: number };

export type CouponInput = {
  kind: "FIXED" | "PERCENT";
  /** cents for FIXED, percent (0–100) for PERCENT */
  value: number;
  validFrom?: Date | null;
  validUntil?: Date | null;
  active: boolean;
};

export type PriceInput = {
  arrival: Date;
  departure: Date;
  adults: number;
  kids: number;
  seatBaby: number;
  seatKind: number;
  seatBoost: number;
  oversize: boolean;
  table: PriceTableInput;
  settings: PricingSettings;
  extras?: ExtraInput[];
  coupon?: CouponInput | null;
  /** Optional returning-customer discount (percent). Not stacked with a coupon: the larger one wins. */
  returningDiscountPct?: number;
  /** "Now", passed in so the function stays pure (used for coupon validity). */
  now: Date;
};

export type PriceLineKind =
  | "parking"
  | "oversize"
  | "extra_persons"
  | "seats"
  | "extra"
  | "discount";

export type PriceLine = {
  kind: PriceLineKind;
  label: string;
  quantity: number;
  unitCents: number;
  /** negative for discounts */
  totalCents: number;
};

export type PriceResult = {
  days: number;
  persons: number;
  lines: PriceLine[];
  subtotalCents: number;
  discountCents: number;
  discountSource: "coupon" | "returning" | null;
  totalCents: number;
};

export type PricingErrorCode =
  | "INVALID_DATES"
  | "INVALID_COUNT"
  | "INVALID_PRICE_TABLE"
  | "SEATS_DISABLED"
  | "COUPON_INVALID";

export class PricingError extends Error {
  constructor(
    public readonly code: PricingErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PricingError";
  }
}
