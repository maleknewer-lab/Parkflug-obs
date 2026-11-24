// Run with: npx tsx --test tests/booking-quote.test.ts  (node:test; adapt the import lines if the project uses Vitest)
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseQuoteParams } from "../lib/booking/quote";
import { checkLeadTime } from "../lib/booking/rules";

const base: Record<string, string> = {
  rateId: "rate1",
  arrivalAt: "2026-12-01T10:00",
  departureAt: "2026-12-05T18:00",
  adults: "2",
};
const parse = (o: Record<string, string> = {}, extraIds: string[] = []) =>
  parseQuoteParams((n) => ({ ...base, ...o })[n] ?? "", { extraIds });

describe("parseQuoteParams", () => {
  it("accepts a minimal valid quote and applies defaults", () => {
    const r = parse();
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.data.adults, 2);
    assert.equal(r.data.kids, 0);
    assert.equal(r.data.seatBaby, 0);
    assert.equal(r.data.oversize, false);
    assert.equal(r.data.couponCode, null);
    assert.deepEqual(r.data.extras, []);
  });

  it("converts Berlin wall-clock time (winter: UTC+1)", () => {
    const r = parse();
    assert.ok(r.ok);
    if (r.ok) assert.equal(r.data.arrivalAt.toISOString(), "2026-12-01T09:00:00.000Z");
  });

  it("rejects a missing rate, bad dates and departure before arrival", () => {
    assert.equal(parse({ rateId: "" }).ok, false);
    assert.equal(parse({ arrivalAt: "" }).ok, false);
    assert.equal(parse({ departureAt: "2026-11-30T10:00" }).ok, false);
  });

  it("allows same-day trips (1 calendar day)", () => {
    assert.equal(parse({ departureAt: "2026-12-01T20:00" }).ok, true);
  });

  it("rejects more than 365 days", () => {
    assert.equal(parse({ departureAt: "2027-12-05T10:00" }).ok, false);
  });

  it("validates person counts", () => {
    assert.equal(parse({ adults: "0" }).ok, false);
    assert.equal(parse({ adults: "abc" }).ok, false);
    assert.equal(parse({ kids: "21" }).ok, false);
    assert.equal(parse({ seatKind: "6" }).ok, false);
  });

  it("keeps only extras with quantity > 0 and upper-cases the coupon", () => {
    const r = parse({ extra_a: "2", extra_b: "0", couponCode: " welcome10 " }, ["a", "b"]);
    assert.ok(r.ok);
    if (r.ok) {
      assert.deepEqual(r.data.extras, [{ extraId: "a", quantity: 2 }]);
      assert.equal(r.data.couponCode, "WELCOME10");
    }
  });

  it("reads the oversize checkbox", () => {
    const r = parse({ oversize: "on" });
    assert.ok(r.ok);
    if (r.ok) assert.equal(r.data.oversize, true);
  });
});

describe("lead time (brand.minLeadHours)", () => {
  const now = new Date("2026-12-01T08:00:00Z");
  it("rejects arrival inside the lead time", () => {
    assert.equal(checkLeadTime(new Date("2026-12-01T09:30:00Z"), now, 2).ok, false);
  });
  it("accepts arrival exactly at the limit", () => {
    assert.equal(checkLeadTime(new Date("2026-12-01T10:00:00Z"), now, 2).ok, true);
  });
});
