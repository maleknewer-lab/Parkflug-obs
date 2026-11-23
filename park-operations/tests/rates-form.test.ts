import { describe, expect, it } from "vitest";
import {
  formatEuro,
  parseEuro,
  parseIntIn,
  parseOptionalEuro,
  parseOptionalInt,
  parsePriceTable,
  parseTriBool,
} from "../lib/rates/form";

describe("parseEuro", () => {
  it("accepts German and English decimals", () => {
    expect(parseEuro("12")).toBe(1200);
    expect(parseEuro("12,5")).toBe(1250);
    expect(parseEuro("12,50")).toBe(1250);
    expect(parseEuro("12.50")).toBe(1250);
    expect(parseEuro(" 12,50 € ")).toBe(1250);
    expect(parseEuro("0,99")).toBe(99);
  });

  it("rounds floating-point cases correctly", () => {
    expect(parseEuro("19,99")).toBe(1999);
    expect(parseEuro("1,15")).toBe(115);
  });

  it("rejects invalid input", () => {
    for (const bad of ["", "abc", "-5", "12,345", "1.250,00", "1,2,3", "12 34", "9999999"]) {
      expect(parseEuro(bad)).toBe(null);
    }
  });
});

describe("formatEuro", () => {
  it("formats cents with a decimal comma", () => {
    expect(formatEuro(1250)).toBe("12,50");
    expect(formatEuro(0)).toBe("0,00");
    expect(formatEuro(5)).toBe("0,05");
  });

  it("round-trips with parseEuro", () => {
    for (const c of [1, 99, 1000, 123456]) expect(parseEuro(formatEuro(c))).toBe(c);
  });
});

describe("integer and optional fields", () => {
  it("parseIntIn enforces the range", () => {
    expect(parseIntIn("25", 0, 100)).toBe(25);
    expect(parseIntIn("101", 0, 100)).toBe(null);
    expect(parseIntIn("-1", 0, 100)).toBe(null);
    expect(parseIntIn("2.5", 0, 100)).toBe(null);
    expect(parseIntIn("", 0, 100)).toBe(null);
  });

  it("optional: blank = inherit (null), invalid = undefined", () => {
    expect(parseOptionalInt("", 0, 100)).toBe(null);
    expect(parseOptionalInt("30", 0, 100)).toBe(30);
    expect(parseOptionalInt("x", 0, 100)).toBe(undefined);
    expect(parseOptionalEuro("")).toBe(null);
    expect(parseOptionalEuro("0")).toBe(0);
    expect(parseOptionalEuro("x")).toBe(undefined);
  });

  it("tri-state select", () => {
    expect(parseTriBool("inherit")).toBe(null);
    expect(parseTriBool("yes")).toBe(true);
    expect(parseTriBool("no")).toBe(false);
    expect(parseTriBool("maybe")).toBe(undefined);
  });
});

describe("parsePriceTable", () => {
  const full = (override: Record<string, string> = {}) => {
    const values: Record<string, string> = { extra: "5" };
    for (let d = 1; d <= 30; d++) values[`d${d}`] = String(d * 10);
    return (name: string) => ({ ...values, ...override })[name] ?? "";
  };

  it("parses 30 prices and the extra-day price", () => {
    const r = parsePriceTable(full());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.dayPriceCents).toHaveLength(30);
      expect(r.dayPriceCents[0]).toBe(1000);
      expect(r.dayPriceCents[29]).toBe(30000);
      expect(r.extraDayCents).toBe(500);
    }
  });

  it("names the day that is missing or invalid", () => {
    const r = parsePriceTable(full({ d7: "" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.startsWith("7 Tag")).toBe(true);
  });

  it("rejects zero prices", () => {
    expect(parsePriceTable(full({ d3: "0" })).ok).toBe(false);
    expect(parsePriceTable(full({ extra: "0" })).ok).toBe(false);
  });
});
