// Parses and validates the booking form (admin create/edit). Pure: takes a getter, returns data or an error.
// Dates come from <input type="datetime-local"> and are Berlin wall-clock time.

import { berlinLocalToDate, calendarDaysInclusive } from "../pricing/dates";
import { parseEuro, parseIntIn } from "../rates/form";

export type BookingFormData = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  company: string | null;
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
  status: "confirmed" | "unconfirmed";
  paid: boolean;
  paymentMethod: "CASH" | "EC" | "PARTNER" | "ONLINE" | null;
  source: "PHONE" | "PARTNER_PORTAL" | "XPARK" | "WEBSITE";
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

export type ParseResult<T> = { ok: true; data: T } | { ok: false; error: string };

class FormError extends Error {}
const fail = (message: string): never => {
  throw new FormError(message);
};

export const MAX_BOOKING_DAYS = 365;

export function parseBookingForm(
  get: (name: string) => string,
  opts: {
    extraIds: string[];
    /** Edit mode: keep values only the system sets (online payment, website source). */
    allowSystemValues?: boolean;
  },
): ParseResult<BookingFormData> {
  const val = (name: string) => get(name).trim();

  const required = (name: string, label: string, max: number): string => {
    const v = val(name);
    if (v === "") fail(`${label}: bitte ausfüllen`);
    if (v.length > max) fail(`${label}: höchstens ${max} Zeichen`);
    return v;
  };
  const optional = (name: string, label: string, max: number): string | null => {
    const v = val(name);
    if (v === "") return null;
    if (v.length > max) fail(`${label}: höchstens ${max} Zeichen`);
    return v;
  };
  const count = (name: string, label: string, min: number, max: number, whenBlank?: number): number => {
    const v = val(name);
    if (v === "" && whenBlank !== undefined) return whenBlank;
    const n = parseIntIn(v, min, max);
    return n ?? fail(`${label}: Zahl zwischen ${min} und ${max}`);
  };
  const euro = (name: string, label: string): number | null => {
    const v = val(name);
    if (v === "") return null;
    return parseEuro(v) ?? fail(`${label}: ungültiger Betrag`);
  };
  const flight = (name: string, label: string): string | null => {
    const v = val(name).toUpperCase().replace(/\s+/g, "");
    if (v === "") return null;
    if (!/^[A-Z0-9]{3,8}$/.test(v)) fail(`${label}: ungültige Flugnummer (z. B. EW9421)`);
    return v;
  };

  try {
    const firstName = required("firstName", "Vorname", 60);
    const lastName = required("lastName", "Nachname", 60);
    const email = required("email", "E-Mail", 120).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail("E-Mail: ungültige Adresse");
    const phone = optional("phone", "Telefon", 40);
    if (phone && !/^[0-9+()\-\s/]{5,40}$/.test(phone)) fail("Telefon: ungültige Nummer");

    const arrivalAt = berlinLocalToDate(val("arrivalAt")) ?? fail("Anreise: ungültiges Datum oder Uhrzeit");
    const departureAt = berlinLocalToDate(val("departureAt")) ?? fail("Abreise: ungültiges Datum oder Uhrzeit");
    const days = calendarDaysInclusive(arrivalAt, departureAt);
    if (days < 1) fail("Abreise darf nicht vor der Anreise liegen");
    if (days > MAX_BOOKING_DAYS) fail(`Buchungsdauer: höchstens ${MAX_BOOKING_DAYS} Tage`);

    const plate = required("plate", "Kennzeichen", 15).toUpperCase().replace(/\s+/g, " ");
    if (plate.length < 2) fail("Kennzeichen: zu kurz");

    const extras = opts.extraIds
      .map((extraId) => ({ extraId, quantity: count(`extra_${extraId}`, "Extra-Menge", 0, 9, 0) }))
      .filter((e) => e.quantity > 0);

    const paid = get("paid") === "on";
    const pm = val("paymentMethod");
    const paymentMethod: BookingFormData["paymentMethod"] =
      pm === "" ? null
      : pm === "CASH" ? "CASH"
      : pm === "EC" ? "EC"
      : pm === "PARTNER" ? "PARTNER"
      : pm === "ONLINE" && opts.allowSystemValues ? "ONLINE"
      : fail("Zahlart ungültig");
    if (paid && !paymentMethod) fail("Bezahlt: bitte die Zahlart wählen");

    const srcRaw = val("source") || "PHONE";
    const src: BookingFormData["source"] =
      srcRaw === "PHONE" ? "PHONE"
      : srcRaw === "PARTNER_PORTAL" ? "PARTNER_PORTAL"
      : srcRaw === "XPARK" ? "XPARK"
      : srcRaw === "WEBSITE" && opts.allowSystemValues ? "WEBSITE"
      : fail("Quelle ungültig");
    const status = val("status") === "unconfirmed" ? "unconfirmed" : "confirmed";

    const vatRaw = val("billingVatId").toUpperCase().replace(/\s+/g, "");
    if (vatRaw !== "" && !/^[A-Z]{2}[A-Z0-9]{2,12}$/.test(vatRaw)) fail("USt-IdNr.: ungültiges Format (z. B. DE123456789)");

    const couponRaw = val("couponCode").toUpperCase();
    if (couponRaw.length > 40) fail("Gutschein: zu lang");

    const manual = euro("manualPrice", "Manueller Preis");

    return {
      ok: true,
      data: {
        firstName,
        lastName,
        email,
        phone,
        company: optional("company", "Firma", 100),
        arrivalAt,
        departureAt,
        outboundFlight: flight("outboundFlight", "Hinflug"),
        returnFlight: flight("returnFlight", "Rückflug"),
        adults: count("adults", "Erwachsene", 1, 20),
        kids: count("kids", "Kinder", 0, 20, 0),
        seatBaby: count("seatBaby", "Babyschale", 0, 5, 0),
        seatKind: count("seatKind", "Kindersitz", 0, 5, 0),
        seatBoost: count("seatBoost", "Sitzerhöhung", 0, 5, 0),
        plate,
        vehicle: optional("vehicle", "Fahrzeug", 60),
        oversize: get("oversize") === "on",
        extras,
        couponCode: couponRaw === "" ? null : couponRaw,
        status,
        paid,
        paymentMethod,
        source: src,
        externalRef: optional("externalRef", "Externe Buchungsnummer", 60),
        commissionCents: euro("commission", "Provision"),
        manualPriceCents: manual,
        customerNote: optional("customerNote", "Kundenhinweis", 1000),
        internalNote: optional("internalNote", "Interne Notiz", 1000),
        billingCompany: optional("billingCompany", "Rechnung: Firma", 100),
        billingContact: optional("billingContact", "Rechnung: z. Hd.", 100),
        billingAddress: optional("billingAddress", "Rechnung: Adresse", 300),
        billingVatId: vatRaw === "" ? null : vatRaw,
      },
    };
  } catch (e) {
    if (e instanceof FormError) return { ok: false, error: e.message };
    throw e;
  }
}
