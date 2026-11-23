import { describe, expect, it } from "vitest";
import {
  PricingError,
  calculatePrice,
  calendarDaysInclusive,
  priceDifference,
  resolveSettings,
  type PriceInput,
  type PricingSettings,
} from "../lib/pricing";

// Test table: day n costs n * 10 €; every day beyond 30 costs 5 €.
const table = {
  dayPriceCents: Array.from({ length: 30 }, (_, i) => (i + 1) * 1000),
  extraDayCents: 500,
};

const settings: PricingSettings = {
  personsIncluded: 3,
  extraPersonPriceCents: 1000,
  kidsCountAsPerson: true,
  seatsEnabled: true,
  seatPriceCents: 0,
  oversizeSurchargePct: 25,
};

const NOW = new Date("2026-11-23T10:00:00+01:00");

function input(overrides: Partial<PriceInput> = {}): PriceInput {
  return {
    arrival: new Date("2026-12-01T10:00:00+01:00"),
    departure: new Date("2026-12-05T18:00:00+01:00"), // 5 calendar days
    adults: 1,
    kids: 0,
    seatBaby: 0,
    seatKind: 0,
    seatBoost: 0,
    oversize: false,
    table,
    settings,
    now: NOW,
    ...overrides,
  };
}

describe("calendar days (Europe/Berlin, inclusive)", () => {
  it("same day = 1 day", () => {
    const d = calendarDaysInclusive(
      new Date("2026-12-01T08:00:00+01:00"),
      new Date("2026-12-01T20:00:00+01:00"),
    );
    expect(d).toBe(1);
  });

  it("counts arrival and departure day", () => {
    expect(calculatePrice(input()).days).toBe(5);
  });

  it("23:30 → 00:30 over midnight is 2 days", () => {
    const d = calendarDaysInclusive(
      new Date("2026-12-01T23:30:00+01:00"),
      new Date("2026-12-02T00:30:00+01:00"),
    );
    expect(d).toBe(2);
  });

  it("uses the Berlin date, not UTC", () => {
    // 23:30 UTC on Dec 1 is already Dec 2 in Berlin
    const d = calendarDaysInclusive(
      new Date("2026-12-01T23:30:00Z"),
      new Date("2026-12-02T10:00:00Z"),
    );
    expect(d).toBe(1);
  });

  it("is stable across the spring DST change", () => {
    const d = calendarDaysInclusive(
      new Date("2027-03-27T12:00:00+01:00"),
      new Date("2027-03-29T12:00:00+02:00"),
    );
    expect(d).toBe(3);
  });
});

describe("parking price", () => {
  it("1 day and 30 days use the table", () => {
    const one = calculatePrice(
      input({ departure: new Date("2026-12-01T20:00:00+01:00") }),
    );
    expect(one.totalCents).toBe(1000);
    const exact = calculatePrice(
      input({ departure: new Date("2026-12-30T12:00:00+01:00") }),
    );
    expect(exact.days).toBe(30);
    expect(exact.totalCents).toBe(30000);
  });

  it("adds the extra-day price beyond 30 days", () => {
    const r = calculatePrice(input({ departure: new Date("2027-01-02T12:00:00+01:00") })); // 33 days
    expect(r.days).toBe(33);
    expect(r.totalCents).toBe(30000 + 3 * 500);
  });
});

describe("persons", () => {
  it("up to 3 persons are included", () => {
    expect(calculatePrice(input({ adults: 3 })).totalCents).toBe(5000);
  });

  it("charges +10 € per additional person", () => {
    const r = calculatePrice(input({ adults: 5 }));
    expect(r.totalCents).toBe(5000 + 2000);
    expect(r.lines.find((l) => l.kind === "extra_persons")?.quantity).toBe(2);
  });

  it("children count as persons by default", () => {
    const r = calculatePrice(input({ adults: 2, kids: 2 })); // 4 persons
    expect(r.persons).toBe(4);
    expect(r.totalCents).toBe(5000 + 1000);
  });

  it("children do not count when kidsCountAsPerson is false", () => {
    const r = calculatePrice(
      input({ adults: 2, kids: 2, settings: { ...settings, kidsCountAsPerson: false } }),
    );
    expect(r.persons).toBe(2);
    expect(r.totalCents).toBe(5000);
  });
});

describe("child seats", () => {
  it("are free by default (0 €) and add no line", () => {
    const r = calculatePrice(input({ seatBaby: 1, seatKind: 1 }));
    expect(r.totalCents).toBe(5000);
    expect(r.lines.some((l) => l.kind === "seats")).toBe(false);
  });

  it("are charged per seat when seatPrice > 0", () => {
    const r = calculatePrice(
      input({ seatBaby: 1, seatBoost: 1, settings: { ...settings, seatPriceCents: 300 } }),
    );
    expect(r.totalCents).toBe(5000 + 600);
  });

  it("throws when seats are requested but switched off", () => {
    expect(() =>
      calculatePrice(input({ seatKind: 1, settings: { ...settings, seatsEnabled: false } })),
    ).toThrow(PricingError);
  });
});

describe("oversize vehicles", () => {
  it("adds 25 % on the parking price", () => {
    expect(calculatePrice(input({ oversize: true })).totalCents).toBe(5000 + 1250);
  });

  it("does not apply to extra persons or extras", () => {
    const r = calculatePrice(
      input({
        oversize: true,
        adults: 4,
        extras: [{ name: "Autowäsche", priceCents: 1500, quantity: 1 }],
      }),
    );
    expect(r.totalCents).toBe(5000 + 1250 + 1000 + 1500);
  });

  it("rounds to whole cents", () => {
    const odd = { dayPriceCents: Array.from({ length: 30 }, () => 1001), extraDayCents: 0 };
    const r = calculatePrice(
      input({ table: odd, departure: new Date("2026-12-01T20:00:00+01:00"), oversize: true }),
    );
    expect(r.lines.find((l) => l.kind === "oversize")?.totalCents).toBe(250); // 250.25
  });
});

describe("extras", () => {
  it("multiplies price by quantity and skips quantity 0", () => {
    const r = calculatePrice(
      input({
        extras: [
          { name: "Autowäsche", priceCents: 1500, quantity: 2 },
          { name: "Innenreinigung", priceCents: 3000, quantity: 0 },
        ],
      }),
    );
    expect(r.totalCents).toBe(5000 + 3000);
    expect(r.lines.filter((l) => l.kind === "extra")).toHaveLength(1);
  });
});

describe("coupons and discounts", () => {
  it("percent coupon applies to the subtotal", () => {
    const r = calculatePrice(input({ coupon: { kind: "PERCENT", value: 10, active: true } }));
    expect(r.discountCents).toBe(500);
    expect(r.totalCents).toBe(4500);
  });

  it("fixed coupon subtracts cents", () => {
    const r = calculatePrice(input({ coupon: { kind: "FIXED", value: 700, active: true } }));
    expect(r.totalCents).toBe(4300);
  });

  it("fixed coupon never makes the total negative", () => {
    const r = calculatePrice(input({ coupon: { kind: "FIXED", value: 999999, active: true } }));
    expect(r.totalCents).toBe(0);
  });

  it("rejects inactive, expired and not-yet-valid coupons", () => {
    const base = { kind: "PERCENT" as const, value: 10 };
    expect(() => calculatePrice(input({ coupon: { ...base, active: false } }))).toThrow(PricingError);
    expect(() =>
      calculatePrice(input({ coupon: { ...base, active: true, validUntil: new Date("2026-11-01") } })),
    ).toThrow(PricingError);
    expect(() =>
      calculatePrice(input({ coupon: { ...base, active: true, validFrom: new Date("2027-01-01") } })),
    ).toThrow(PricingError);
  });

  it("returning discount and coupon are not stacked: the larger wins", () => {
    const couponWins = calculatePrice(
      input({ coupon: { kind: "PERCENT", value: 10, active: true }, returningDiscountPct: 5 }),
    );
    expect(couponWins.discountSource).toBe("coupon");
    expect(couponWins.totalCents).toBe(4500);

    const returningWins = calculatePrice(
      input({ coupon: { kind: "PERCENT", value: 5, active: true }, returningDiscountPct: 10 }),
    );
    expect(returningWins.discountSource).toBe("returning");
    expect(returningWins.totalCents).toBe(4500);
  });
});

describe("invariants and validation", () => {
  it("total always equals the sum of all lines", () => {
    const r = calculatePrice(
      input({
        adults: 4,
        kids: 1,
        oversize: true,
        seatBaby: 1,
        settings: { ...settings, seatPriceCents: 250 },
        extras: [{ name: "Autowäsche", priceCents: 1500, quantity: 1 }],
        coupon: { kind: "PERCENT", value: 15, active: true },
      }),
    );
    expect(r.lines.reduce((s, l) => s + l.totalCents, 0)).toBe(r.totalCents);
  });

  it("rejects departure before arrival", () => {
    expect(() =>
      calculatePrice(input({ departure: new Date("2026-11-30T10:00:00+01:00") })),
    ).toThrow(PricingError);
  });

  it("rejects zero adults and negative counts", () => {
    expect(() => calculatePrice(input({ adults: 0 }))).toThrow(PricingError);
    expect(() => calculatePrice(input({ kids: -1 }))).toThrow(PricingError);
  });

  it("rejects a price table without 30 entries", () => {
    expect(() =>
      calculatePrice(input({ table: { dayPriceCents: [1000], extraDayCents: 500 } })),
    ).toThrow(PricingError);
  });
});

describe("resolveSettings", () => {
  it("null/undefined overrides fall back to the brand", () => {
    expect(resolveSettings(settings, { personsIncluded: null })).toEqual(settings);
  });

  it("false and 0 overrides are honoured", () => {
    const r = resolveSettings(settings, { kidsCountAsPerson: false, extraPersonPriceCents: 0 });
    expect(r.kidsCountAsPerson).toBe(false);
    expect(r.extraPersonPriceCents).toBe(0);
  });
});

describe("priceDifference", () => {
  it("classifies extra payment, refund and no change", () => {
    expect(priceDifference(10000, 12000)).toEqual({ differenceCents: 2000, kind: "extra_payment" });
    expect(priceDifference(10000, 8000)).toEqual({ differenceCents: -2000, kind: "refund" });
    expect(priceDifference(10000, 10000)).toEqual({ differenceCents: 0, kind: "none" });
  });
});
