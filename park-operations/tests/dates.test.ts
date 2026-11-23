import { describe, expect, it } from "vitest";
import { berlinLocalToDate, formatBerlin, toBerlinLocalInput } from "../lib/pricing";

describe("berlinLocalToDate", () => {
  it("winter time is UTC+1", () => {
    expect(berlinLocalToDate("2026-12-01T10:00")?.toISOString()).toBe("2026-12-01T09:00:00.000Z");
  });

  it("summer time is UTC+2", () => {
    expect(berlinLocalToDate("2026-07-01T10:00")?.toISOString()).toBe("2026-07-01T08:00:00.000Z");
  });

  it("handles midnight", () => {
    expect(berlinLocalToDate("2026-12-01T00:00")?.toISOString()).toBe("2026-11-30T23:00:00.000Z");
  });

  it("rejects a time that does not exist (spring DST gap)", () => {
    expect(berlinLocalToDate("2027-03-28T02:30")).toBe(null);
  });

  it("rejects malformed input and impossible dates", () => {
    expect(berlinLocalToDate("")).toBe(null);
    expect(berlinLocalToDate("2026-12-01 10:00")).toBe(null);
    expect(berlinLocalToDate("2026-02-30T10:00")).toBe(null);
  });

  it("round-trips with toBerlinLocalInput", () => {
    for (const v of ["2026-12-01T10:00", "2026-07-01T23:59", "2027-03-29T03:00", "2026-10-26T00:00"]) {
      const d = berlinLocalToDate(v);
      expect(d === null ? null : toBerlinLocalInput(d)).toBe(v);
    }
  });
});

describe("formatBerlin", () => {
  it("shows Berlin wall-clock time", () => {
    const text = formatBerlin(new Date("2026-12-01T09:00:00Z"));
    expect(text.includes("01.12.2026")).toBe(true);
    expect(text.includes("10:00")).toBe(true);
  });
});
