import { describe, expect, it } from "vitest";
import { parseBookingForm } from "../lib/booking/form";

const base: Record<string, string> = {
  firstName: "Max",
  lastName: "Muster",
  email: "Max@Example.test",
  phone: "+49 211 123456",
  arrivalAt: "2026-12-01T10:00",
  departureAt: "2026-12-05T18:00",
  adults: "2",
  plate: "d-ab  1234",
};

function parse(overrides: Record<string, string> = {}, extraIds: string[] = []) {
  const values = { ...base, ...overrides };
  return parseBookingForm((n) => values[n] ?? "", { extraIds });
}

describe("parseBookingForm", () => {
  it("parses a minimal valid form and normalizes values", () => {
    const r = parse();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.email).toBe("max@example.test");
    expect(r.data.plate).toBe("D-AB 1234");
    expect(r.data.arrivalAt.toISOString()).toBe("2026-12-01T09:00:00.000Z");
    expect(r.data.kids).toBe(0);
    expect(r.data.status).toBe("confirmed");
    expect(r.data.source).toBe("PHONE");
    expect(r.data.paid).toBe(false);
  });

  it("normalizes flight numbers", () => {
    const r = parse({ outboundFlight: " ew 9421 " });
    expect(r.ok && r.data.outboundFlight).toBe("EW9421");
    expect(parse({ outboundFlight: "x" }).ok).toBe(false);
  });

  it("rejects bad e-mail, missing names and bad phone", () => {
    expect(parse({ email: "nope" }).ok).toBe(false);
    expect(parse({ firstName: "" }).ok).toBe(false);
    expect(parse({ phone: "abc" }).ok).toBe(false);
  });

  it("rejects invalid, reversed and too long date ranges", () => {
    expect(parse({ arrivalAt: "" }).ok).toBe(false);
    expect(parse({ departureAt: "2026-11-30T10:00" }).ok).toBe(false);
    expect(parse({ departureAt: "2028-12-05T18:00" }).ok).toBe(false);
  });

  it("allows same-day bookings", () => {
    expect(parse({ departureAt: "2026-12-01T20:00" }).ok).toBe(true);
  });

  it("requires at least one adult and limits counts", () => {
    expect(parse({ adults: "0" }).ok).toBe(false);
    expect(parse({ adults: "" }).ok).toBe(false);
    expect(parse({ seatBaby: "9" }).ok).toBe(false);
    const r = parse({ kids: "2", seatKind: "1" });
    expect(r.ok && r.data.kids).toBe(2);
  });

  it("reads extras by id and skips quantity 0", () => {
    const r = parse({ extra_a: "2", extra_b: "0" }, ["a", "b", "c"]);
    expect(r.ok && r.data.extras).toEqual([{ extraId: "a", quantity: 2 }]);
    expect(parse({ extra_a: "99" }, ["a"]).ok).toBe(false);
  });

  it("paid needs a payment method; staff cannot pick ONLINE", () => {
    expect(parse({ paid: "on" }).ok).toBe(false);
    expect(parse({ paid: "on", paymentMethod: "CASH" }).ok).toBe(true);
    expect(parse({ paymentMethod: "ONLINE" }).ok).toBe(false);
  });

  it("parses manual price and commission in euro", () => {
    const r = parse({ manualPrice: "49,90", commission: "5" });
    expect(r.ok && r.data.manualPriceCents).toBe(4990);
    expect(r.ok && r.data.commissionCents).toBe(500);
    expect(parse({ manualPrice: "abc" }).ok).toBe(false);
  });

  it("validates the VAT id loosely and uppercases it", () => {
    const r = parse({ billingVatId: "de 123456789" });
    expect(r.ok && r.data.billingVatId).toBe("DE123456789");
    expect(parse({ billingVatId: "123" }).ok).toBe(false);
  });

  it("limits note length", () => {
    expect(parse({ internalNote: "x".repeat(1001) }).ok).toBe(false);
  });
});
