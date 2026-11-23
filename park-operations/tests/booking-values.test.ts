import { describe, expect, it } from "vitest";
import { parseBookingForm } from "../lib/booking/form";
import { bookingFormValues, manualPriceOf, type BookingValuesInput } from "../lib/booking/values";

const stored: BookingValuesInput = {
  customer: { firstName: "Max", lastName: "TEST-Muster", email: "max@example.test", phone: "+49 211 123456", company: null },
  arrivalAt: new Date("2026-12-01T09:00:00Z"),
  departureAt: new Date("2026-12-05T17:00:00Z"),
  outboundFlight: "EW9421",
  returnFlight: null,
  adults: 4,
  kids: 1,
  seatBaby: 1,
  seatKind: 0,
  seatBoost: 0,
  plate: "D-AB 1234",
  vehicle: "VW Bus",
  oversize: true,
  extras: [{ extraId: "x1", quantity: 2 }],
  couponCode: "SOMMER10",
  status: "confirmed",
  paid: true,
  paymentMethod: "CASH",
  source: "PHONE",
  externalRef: null,
  commissionCents: 500,
  manualPriceCents: 4990,
  customerNote: "Kinderwagen",
  internalNote: "Stammkunde",
  billingCompany: "Muster GmbH",
  billingContact: "Frau Beispiel",
  billingAddress: "Teststr. 1, 40210 Düsseldorf",
  billingVatId: "DE123456789",
};

describe("bookingFormValues ↔ parseBookingForm round trip", () => {
  it("parsing the prefilled values gives back the stored booking", () => {
    const values = bookingFormValues(stored);
    const r = parseBookingForm((n) => values[n] ?? "", { extraIds: ["x1", "x2"], allowSystemValues: true });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const d = r.data;
    expect(d.arrivalAt.toISOString()).toBe(stored.arrivalAt.toISOString());
    expect(d.departureAt.toISOString()).toBe(stored.departureAt.toISOString());
    expect(d.firstName).toBe("Max");
    expect(d.email).toBe("max@example.test");
    expect(d.adults).toBe(4);
    expect(d.kids).toBe(1);
    expect(d.seatBaby).toBe(1);
    expect(d.oversize).toBe(true);
    expect(d.extras).toEqual([{ extraId: "x1", quantity: 2 }]);
    expect(d.couponCode).toBe("SOMMER10");
    expect(d.paid).toBe(true);
    expect(d.paymentMethod).toBe("CASH");
    expect(d.commissionCents).toBe(500);
    expect(d.manualPriceCents).toBe(4990);
    expect(d.customerNote).toBe("Kinderwagen");
    expect(d.internalNote).toBe("Stammkunde");
    expect(d.billingVatId).toBe("DE123456789");
    expect(d.returnFlight).toBe(null);
  });

  it("works for a summer-time booking and an online/website booking", () => {
    const summer = { ...stored, arrivalAt: new Date("2026-07-01T08:00:00Z"), departureAt: new Date("2026-07-03T20:30:00Z"),
      paymentMethod: "ONLINE", source: "WEBSITE" };
    const values = bookingFormValues(summer);
    const r = parseBookingForm((n) => values[n] ?? "", { extraIds: ["x1"], allowSystemValues: true });
    expect(r.ok && r.data.arrivalAt.toISOString()).toBe("2026-07-01T08:00:00.000Z");
    expect(r.ok && r.data.paymentMethod).toBe("ONLINE");
  });

  it("empty optional values stay null", () => {
    const bare = { ...stored, vehicle: null, couponCode: null, manualPriceCents: null, commissionCents: null,
      customerNote: null, internalNote: null, extras: [], billingVatId: null, billingCompany: null };
    const values = bookingFormValues(bare);
    const r = parseBookingForm((n) => values[n] ?? "", { extraIds: [] });
    expect(r.ok && r.data.manualPriceCents).toBe(null);
    expect(r.ok && r.data.customerNote).toBe(null);
  });
});

describe("manualPriceOf", () => {
  it("reads the manual price from the stored breakdown", () => {
    expect(manualPriceOf({ manualPriceCents: 4990 })).toBe(4990);
    expect(manualPriceOf({ manualPriceCents: null })).toBe(null);
    expect(manualPriceOf(null)).toBe(null);
    expect(manualPriceOf({ lines: [] })).toBe(null);
  });
});
