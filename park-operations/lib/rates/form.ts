// Pure helpers for the price admin forms (German number input → integer cents, validation).
// No framework imports, unit-tested in tests/rates-form.test.ts.

/** "12", "12,5", "12.50", "12,50 €" → cents. Returns null if invalid. No thousands separators. */
export function parseEuro(input: string): number | null {
  const s = input.replace(/€/g, "").trim();
  if (!/^\d{1,6}([.,]\d{1,2})?$/.test(s)) return null;
  return Math.round(Number(s.replace(",", ".")) * 100);
}

/** 1250 → "12,50" */
export function formatEuro(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

/** Whole number within [min, max]. Returns null if invalid. */
export function parseIntIn(input: string, min: number, max: number): number | null {
  const s = input.trim();
  if (!/^\d{1,9}$/.test(s)) return null;
  const n = Number(s);
  return n >= min && n <= max ? n : null;
}

/** Optional override: "" → null (use the brand's value), invalid → undefined. */
export function parseOptionalInt(input: string, min: number, max: number): number | null | undefined {
  if (input.trim() === "") return null;
  return parseIntIn(input, min, max) ?? undefined;
}

export function parseOptionalEuro(input: string): number | null | undefined {
  if (input.trim() === "") return null;
  return parseEuro(input) ?? undefined;
}

/** Select values "inherit" | "yes" | "no" → null | true | false. Anything else → undefined. */
export function parseTriBool(input: string): boolean | null | undefined {
  if (input === "inherit" || input === "") return null;
  if (input === "yes") return true;
  if (input === "no") return false;
  return undefined;
}

export type PriceTableParse =
  | { ok: true; dayPriceCents: number[]; extraDayCents: number }
  | { ok: false; error: string };

/** Reads fields d1…d30 and "extra" (euro strings). Every price must be > 0 (no free parking by accident). */
export function parsePriceTable(get: (name: string) => string): PriceTableParse {
  const dayPriceCents: number[] = [];
  for (let day = 1; day <= 30; day++) {
    const cents = parseEuro(get(`d${day}`));
    if (cents === null) return { ok: false, error: `${day} Tag(e): ungültiger Preis` };
    if (cents <= 0) return { ok: false, error: `${day} Tag(e): Preis muss größer als 0 sein` };
    dayPriceCents.push(cents);
  }
  const extraDayCents = parseEuro(get("extra"));
  if (extraDayCents === null) return { ok: false, error: "Preis pro Zusatztag: ungültig" };
  if (extraDayCents <= 0) return { ok: false, error: "Preis pro Zusatztag muss größer als 0 sein" };
  return { ok: true, dayPriceCents, extraDayCents };
}
