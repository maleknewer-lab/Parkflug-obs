import { describe, expect, it } from "vitest";
import {
  PAGE_SIZE,
  berlinDayStart,
  buildBookingOrderBy,
  buildBookingWhere,
  buildCustomerWhere,
  parseListParams,
  searchTokens,
} from "../lib/booking/list";

const now = new Date("2026-12-01T10:00:00Z"); // 11:00 in Berlin
const ctxAll = { allowedBrandIds: "all" as const, now };
const json = (v: unknown) => JSON.stringify(v);

describe("parseListParams", () => {
  it("defaults to upcoming, page 1, no filters", () => {
    const f = parseListParams({});
    expect(f.scope).toBe("upcoming");
    expect(f.page).toBe(1);
    expect(f.tokens).toEqual([]);
    expect(f.status).toBe(null);
  });

  it("searching, a customer or a date range switches the default scope to all", () => {
    expect(parseListParams({ q: "mueller" }).scope).toBe("all");
    expect(parseListParams({ customer: "abcdefgh12345" }).scope).toBe("all");
    expect(parseListParams({ from: "2026-12-01" }).scope).toBe("all");
    expect(parseListParams({ q: "x", scope: "past" }).scope).toBe("past");
  });

  it("ignores invalid values", () => {
    const f = parseListParams({ status: "weird", paid: "maybe", from: "2026-13-45", to: "abc", page: "-3", customer: "a b", brand: "x" });
    expect(f.status).toBe(null);
    expect(f.paid).toBe(null);
    expect(f.from).toBe(null);
    expect(f.to).toBe(null);
    expect(f.page).toBe(1);
    expect(f.customerId).toBe(null);
    expect(f.brandId).toBe(null);
  });

  it("takes the first value of repeated parameters and parses the page", () => {
    expect(parseListParams({ q: ["abc", "def"], page: "3" }).q).toBe("abc");
    expect(parseListParams({ page: "3" }).page).toBe(3);
  });

  it("limits search words", () => {
    expect(searchTokens("a b c d e f g").length).toBe(5);
    expect(searchTokens("x".repeat(80))[0].length).toBe(40);
    expect(searchTokens("  Müller   D-AB  ")).toEqual(["Müller", "D-AB"]);
  });
});

describe("berlinDayStart", () => {
  it("is Berlin midnight", () => {
    expect(berlinDayStart(now).toISOString()).toBe("2026-11-30T23:00:00.000Z");
    expect(berlinDayStart(new Date("2026-07-01T21:30:00Z")).toISOString()).toBe("2026-06-30T22:00:00.000Z");
  });
});

describe("buildBookingWhere", () => {
  it("upcoming = departure from the start of today (Berlin)", () => {
    const w = json(buildBookingWhere(parseListParams({}), ctxAll));
    expect(w.includes('"departureAt":{"gte":"2026-11-30T23:00:00.000Z"}')).toBe(true);
  });

  it("past = departure before today", () => {
    const w = json(buildBookingWhere(parseListParams({ scope: "past" }), ctxAll));
    expect(w.includes('"departureAt":{"lt":"2026-11-30T23:00:00.000Z"}')).toBe(true);
  });

  it("date range is inclusive of the last day and ignores the scope", () => {
    const w = json(buildBookingWhere(parseListParams({ from: "2026-12-01", to: "2026-12-05" }), ctxAll));
    expect(w.includes('"arrivalAt":{"gte":"2026-11-30T23:00:00.000Z","lt":"2026-12-05T23:00:00.000Z"}')).toBe(true);
    expect(w.includes("departureAt")).toBe(false);
  });

  it("the last day is correct across the spring DST change", () => {
    const w = json(buildBookingWhere(parseListParams({ to: "2027-03-28", field: "departure" }), ctxAll));
    expect(w.includes('"departureAt":{"lt":"2027-03-28T22:00:00.000Z"}')).toBe(true);
  });

  it("every search word must match code, plate, reference or the customer", () => {
    const where = buildBookingWhere(parseListParams({ q: "mueller d-ab" }), ctxAll) as { AND: { OR?: unknown[] }[] };
    const ors = where.AND.filter((c) => c.OR);
    expect(ors.length).toBe(2);
    expect(ors[0].OR?.length).toBe(4);
    expect(json(where).includes('"mode":"insensitive"')).toBe(true);
  });

  it("restricts to the user's brands, only when limited", () => {
    const all = json(buildBookingWhere(parseListParams({ scope: "all" }), ctxAll));
    expect(all.includes("brandId")).toBe(false);
    const limited = json(buildBookingWhere(parseListParams({ scope: "all" }), { allowedBrandIds: ["b1"], now }));
    expect(limited.includes('"brandId":{"in":["b1"]}')).toBe(true);
  });

  it("adds status, paid and customer filters", () => {
    const w = json(buildBookingWhere(parseListParams({ status: "cancelled", paid: "open", customer: "abcdefgh12345" }), ctxAll));
    expect(w.includes('"status":"cancelled"')).toBe(true);
    expect(w.includes('"paid":false')).toBe(true);
    expect(w.includes('"customerId":"abcdefgh12345"')).toBe(true);
  });
});

describe("order and paging", () => {
  it("upcoming is soonest first, everything else newest first", () => {
    expect(buildBookingOrderBy(parseListParams({}))[0]).toEqual({ arrivalAt: "asc" });
    expect(buildBookingOrderBy(parseListParams({ scope: "past" }))[0]).toEqual({ arrivalAt: "desc" });
    expect(buildBookingOrderBy(parseListParams({ q: "x" }))[0]).toEqual({ arrivalAt: "desc" });
  });

  it("page size is 25", () => {
    expect(PAGE_SIZE).toBe(25);
  });
});

describe("buildCustomerWhere", () => {
  it("searches name, e-mail, phone and company", () => {
    const where = buildCustomerWhere("max muster", "all") as { AND: { OR?: unknown[] }[] };
    expect(where.AND.length).toBe(2);
    expect(where.AND[0].OR?.length).toBe(5);
  });

  it("limited users only see customers of their brands", () => {
    expect(json(buildCustomerWhere("", ["b1"])).includes('"bookings":{"some":{"brandId":{"in":["b1"]}}}')).toBe(true);
    expect(json(buildCustomerWhere("", "all"))).toBe('{"AND":[]}');
  });
});
