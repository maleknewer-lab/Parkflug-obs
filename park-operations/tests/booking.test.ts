import { describe, expect, it } from "vitest";
import {
  cancellationOutcome,
  cancellationPolicy,
  checkLeadTime,
  diffFields,
  generateBookingCode,
  generateUniqueBookingCode,
  isValidBookingCode,
  normalizeBookingCode,
} from "../lib/booking";

describe("booking code", () => {
  it("has 9 characters: 5 letters + 4 digits, no look-alikes", () => {
    for (let i = 0; i < 500; i++) {
      const code = generateBookingCode();
      expect(code).toHaveLength(9);
      expect(/^[A-HJ-NP-Z]{5}[1-9]{4}$/.test(code)).toBe(true);
    }
  });

  it("uses the injected random source", () => {
    expect(generateBookingCode(() => 0)).toBe("AAAAA1111");
  });

  it("normalizes user input", () => {
    expect(normalizeBookingCode(" ktoyg-1199 ")).toBe("KTOYG1199");
    expect(normalizeBookingCode("ktoyg 1199")).toBe("KTOYG1199");
  });

  it("validates loosely: any 9 letters/digits", () => {
    expect(isValidBookingCode("KTOYG1199")).toBe(true);
    expect(isValidBookingCode("KTOYG119")).toBe(false);
    expect(isValidBookingCode("ktoyg1199")).toBe(false);
    expect(isValidBookingCode("KTOYG-1199")).toBe(false);
  });

  it("retries on collision and fails after max attempts", async () => {
    let calls = 0;
    const code = await generateUniqueBookingCode(async () => ++calls < 3);
    expect(calls).toBe(3);
    expect(isValidBookingCode(code)).toBe(true);
    await expect(generateUniqueBookingCode(async () => true, 4)).rejects.toThrow();
  });
});

describe("lead time", () => {
  const now = new Date("2026-12-01T10:00:00Z");

  it("2 hours ahead is allowed, less is not", () => {
    expect(checkLeadTime(new Date("2026-12-01T12:00:00Z"), now, 2).ok).toBe(true);
    expect(checkLeadTime(new Date("2026-12-01T11:59:00Z"), now, 2).ok).toBe(false);
  });

  it("reports the earliest possible arrival", () => {
    expect(checkLeadTime(now, now, 2).earliestArrival.toISOString()).toBe("2026-12-01T12:00:00.000Z");
  });

  it("follows the brand setting", () => {
    expect(checkLeadTime(new Date("2026-12-01T12:00:00Z"), now, 4).ok).toBe(false);
  });
});

describe("cancellation policy (24 h)", () => {
  const arrival = new Date("2026-12-10T12:00:00Z");

  it("free well before the deadline", () => {
    expect(cancellationPolicy(arrival, new Date("2026-12-05T12:00:00Z"), 24).free).toBe(true);
  });

  it("exactly 24 h before is still free", () => {
    expect(cancellationPolicy(arrival, new Date("2026-12-09T12:00:00Z"), 24).free).toBe(true);
  });

  it("one minute too late is not free", () => {
    expect(cancellationPolicy(arrival, new Date("2026-12-09T12:01:00Z"), 24).free).toBe(false);
  });

  it("after arrival is not free", () => {
    expect(cancellationPolicy(arrival, new Date("2026-12-11T12:00:00Z"), 24).free).toBe(false);
  });

  it("exposes the deadline and follows the brand setting", () => {
    const p = cancellationPolicy(arrival, new Date("2026-12-09T00:00:00Z"), 48);
    expect(p.deadline.toISOString()).toBe("2026-12-08T12:00:00.000Z");
    expect(p.free).toBe(false);
  });
});

describe("cancellation outcome", () => {
  it("free: refunds everything paid, owes nothing", () => {
    expect(cancellationOutcome({ priceCents: 5000, paidCents: 5000, free: true })).toEqual({
      refundCents: 5000,
      owedCents: 0,
    });
  });

  it("free and unpaid: nothing to refund or owe", () => {
    expect(cancellationOutcome({ priceCents: 5000, paidCents: 0, free: true })).toEqual({
      refundCents: 0,
      owedCents: 0,
    });
  });

  it("late and paid: no refund, nothing more owed", () => {
    expect(cancellationOutcome({ priceCents: 5000, paidCents: 5000, free: false })).toEqual({
      refundCents: 0,
      owedCents: 0,
    });
  });

  it("late and unpaid: full price is owed", () => {
    expect(cancellationOutcome({ priceCents: 5000, paidCents: 0, free: false })).toEqual({
      refundCents: 0,
      owedCents: 5000,
    });
  });
});

describe("diffFields (booking history)", () => {
  const before = {
    plate: "D-AB 123",
    phone: null as string | null,
    arrivalAt: new Date("2026-12-01T10:00:00Z"),
    adults: 2,
    internalNote: "x" as string | null,
  };
  const fields = ["plate", "phone", "arrivalAt", "adults", "internalNote"] as const;

  it("returns old → new for changed fields only", () => {
    const c = diffFields(before, { plate: "D-XY 999", adults: 2 }, fields);
    expect(c).toEqual({ plate: { from: "D-AB 123", to: "D-XY 999" } });
  });

  it("ignores fields missing from the update", () => {
    expect(diffFields(before, {}, fields)).toEqual({});
  });

  it("treats null and undefined/empty-to-null as equal", () => {
    expect(diffFields(before, { phone: undefined }, fields)).toEqual({});
    expect(diffFields(before, { phone: null }, fields)).toEqual({});
  });

  it("compares dates by value and stores ISO strings", () => {
    expect(diffFields(before, { arrivalAt: new Date("2026-12-01T10:00:00Z") }, fields)).toEqual({});
    const c = diffFields(before, { arrivalAt: new Date("2026-12-02T10:00:00Z") }, fields);
    expect(c.arrivalAt).toEqual({
      from: "2026-12-01T10:00:00.000Z",
      to: "2026-12-02T10:00:00.000Z",
    });
  });

  it("records a note being cleared", () => {
    expect(diffFields(before, { internalNote: null }, fields)).toEqual({
      internalNote: { from: "x", to: null },
    });
  });
});
