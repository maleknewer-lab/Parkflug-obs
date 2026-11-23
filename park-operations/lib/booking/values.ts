// Turns a stored booking back into the string values of the booking form (edit page prefill).
// Pure; the round trip values → parseBookingForm is covered by tests/booking-values.test.ts.

import { toBerlinLocalInput } from "../pricing/dates";
import { formatEuro } from "../rates/form";

export type BookingValuesInput = {
  customer: { firstName: string; lastName: string; email: string; phone: string | null; company: string | null };
  arrivalAt: Date;
  departureAt: Date;
  outboundFlight: string | null;
  returnFlight: string | null;
  adults: number;
  kids: number;
  seatBaby: number;
  seatKind: number;
  seatBoost: number;
  plate: string;
  vehicle: string | null;
  oversize: boolean;
  extras: { extraId: string; quantity: number }[];
  couponCode: string | null;
  status: string;
  paid: boolean;
  paymentMethod: string | null;
  source: string;
  externalRef: string | null;
  commissionCents: number | null;
  manualPriceCents: number | null;
  customerNote: string | null;
  internalNote: string | null;
  billingCompany: string | null;
  billingContact: string | null;
  billingAddress: string | null;
  billingVatId: string | null;
};

/** Manual price stored next to the calculated one in Booking.priceBreakdown (null = none). */
export function manualPriceOf(breakdown: unknown): number | null {
  if (breakdown && typeof breakdown === "object" && "manualPriceCents" in breakdown) {
    const v = (breakdown as { manualPriceCents: unknown }).manualPriceCents;
    return typeof v === "number" ? v : null;
  }
  return null;
}

export function bookingFormValues(b: BookingValuesInput): Record<string, string> {
  const v: Record<string, string> = {
    firstName: b.customer.firstName,
    lastName: b.customer.lastName,
    email: b.customer.email,
    phone: b.customer.phone ?? "",
    company: b.customer.company ?? "",
    arrivalAt: toBerlinLocalInput(b.arrivalAt),
    departureAt: toBerlinLocalInput(b.departureAt),
    outboundFlight: b.outboundFlight ?? "",
    returnFlight: b.returnFlight ?? "",
    adults: String(b.adults),
    kids: String(b.kids),
    seatBaby: String(b.seatBaby),
    seatKind: String(b.seatKind),
    seatBoost: String(b.seatBoost),
    plate: b.plate,
    vehicle: b.vehicle ?? "",
    oversize: b.oversize ? "on" : "",
    couponCode: b.couponCode ?? "",
    manualPrice: b.manualPriceCents === null ? "" : formatEuro(b.manualPriceCents),
    status: b.status,
    paid: b.paid ? "on" : "",
    paymentMethod: b.paymentMethod ?? "",
    source: b.source,
    externalRef: b.externalRef ?? "",
    commission: b.commissionCents === null ? "" : formatEuro(b.commissionCents),
    customerNote: b.customerNote ?? "",
    internalNote: b.internalNote ?? "",
    billingCompany: b.billingCompany ?? "",
    billingContact: b.billingContact ?? "",
    billingAddress: b.billingAddress ?? "",
    billingVatId: b.billingVatId ?? "",
  };
  for (const e of b.extras) v[`extra_${e.extraId}`] = String(e.quantity);
  return v;
}
