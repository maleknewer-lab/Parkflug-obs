// Public checkout form (Phase 3). The browser is untrusted: only an allow-list of fields is read from
// the form, and everything the system decides (status, source, payment method, paid flag, manual price,
// internal note, external number, commission) is forced here and can never come from the visitor.
// Validation itself is shared with the admin form (parseBookingForm), so both stay in sync.

import { parseBookingForm, type BookingFormData, type ParseResult } from "./form";

const VISITOR_FIELDS = new Set([
  "firstName", "lastName", "email", "phone", "company",
  "arrivalAt", "departureAt", "outboundFlight", "returnFlight",
  "adults", "kids", "seatBaby", "seatKind", "seatBoost",
  "plate", "vehicle", "oversize", "couponCode", "customerNote",
  "billingCompany", "billingContact", "billingAddress", "billingVatId",
]);

export type PublicPayment = "CASH" | "ONLINE";

export function parsePublicBookingForm(
  get: (name: string) => string,
  opts: { extraIds: string[]; payment: PublicPayment },
): ParseResult<BookingFormData> {
  const extraNames = new Set(opts.extraIds.map((id) => `extra_${id}`));
  const forced: Record<string, string> = {
    source: "WEBSITE",
    paymentMethod: opts.payment,
    // Cash bookings are confirmed at once; online bookings wait for the successful payment (webhook).
    status: opts.payment === "CASH" ? "confirmed" : "unconfirmed",
  };
  const safeGet = (name: string): string => {
    if (name in forced) return forced[name];
    if (VISITOR_FIELDS.has(name) || extraNames.has(name)) return get(name);
    return "";
  };

  const parsed = parseBookingForm(safeGet, { extraIds: opts.extraIds, allowSystemValues: true });
  if (!parsed.ok) return parsed;
  // The driver must be able to reach the customer → phone is required on the public form.
  if (!parsed.data.phone) return { ok: false, error: "Telefon: bitte ausfüllen" };
  return parsed;
}
