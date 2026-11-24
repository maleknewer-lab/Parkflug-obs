// Public price quote (Phase 3, PR 1). Parses the NON-personal trip data of the public booking page
// (rate, dates, persons, seats, extras, coupon) from query parameters. Pure: takes a getter, returns
// data or a German error message. Personal data (name, e-mail, phone) is never part of the quote and
// never goes into a URL — it is sent by POST in the next step (PR 2).
//
// Dates come from <input type="datetime-local"> and are Berlin wall-clock time.

import { berlinLocalToDate, calendarDaysInclusive } from "../pricing/dates";
import { parseIntIn } from "../rates/form";
import { MAX_BOOKING_DAYS, type ParseResult } from "./form";

export type QuoteData = {
  rateId: string;
  arrivalAt: Date;
  departureAt: Date;
  adults: number;
  kids: number;
  seatBaby: number;
  seatKind: number;
  seatBoost: number;
  oversize: boolean;
  extras: { extraId: string; quantity: number }[];
  couponCode: string | null;
};

class QuoteFormError extends Error {}
const fail = (message: string): never => {
  throw new QuoteFormError(message);
};

export function parseQuoteParams(
  get: (name: string) => string,
  opts: { extraIds: string[] },
): ParseResult<QuoteData> {
  const val = (name: string) => get(name).trim();
  const count = (name: string, label: string, min: number, max: number, whenBlank?: number): number => {
    const v = val(name);
    if (v === "" && whenBlank !== undefined) return whenBlank;
    return parseIntIn(v, min, max) ?? fail(`${label}: Zahl zwischen ${min} und ${max}`);
  };

  try {
    const rateId = val("rateId");
    if (rateId === "" || rateId.length > 40) fail("Bitte einen Tarif wählen");

    const arrivalAt = berlinLocalToDate(val("arrivalAt")) ?? fail("Anreise: bitte Datum und Uhrzeit angeben");
    const departureAt = berlinLocalToDate(val("departureAt")) ?? fail("Abreise: bitte Datum und Uhrzeit angeben");
    const days = calendarDaysInclusive(arrivalAt, departureAt);
    if (days < 1) fail("Die Abreise darf nicht vor der Anreise liegen");
    if (days > MAX_BOOKING_DAYS) fail(`Buchungsdauer: höchstens ${MAX_BOOKING_DAYS} Tage`);

    const extras = opts.extraIds
      .map((extraId) => ({ extraId, quantity: count(`extra_${extraId}`, "Extra-Menge", 0, 9, 0) }))
      .filter((e) => e.quantity > 0);

    const couponRaw = val("couponCode").toUpperCase();
    if (couponRaw.length > 40) fail("Gutschein: zu lang");

    return {
      ok: true,
      data: {
        rateId,
        arrivalAt,
        departureAt,
        adults: count("adults", "Erwachsene", 1, 20),
        kids: count("kids", "Kinder", 0, 20, 0),
        seatBaby: count("seatBaby", "Babyschale", 0, 5, 0),
        seatKind: count("seatKind", "Kindersitz", 0, 5, 0),
        seatBoost: count("seatBoost", "Sitzerhöhung", 0, 5, 0),
        oversize: val("oversize") === "on",
        extras,
        couponCode: couponRaw === "" ? null : couponRaw,
      },
    };
  } catch (e) {
    if (e instanceof QuoteFormError) return { ok: false, error: e.message };
    throw e;
  }
}
