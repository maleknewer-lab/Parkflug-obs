// Run with: npx tsx --test tests/public-booking.test.ts  (node:test; adapt imports if the project uses Vitest)
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parsePublicBookingForm } from "../lib/booking/public-form";
import { parseOptionalHttpsUrl } from "../lib/booking/legal-links";
import { quoteQueryString } from "../lib/booking/quote";

const valid: Record<string, string> = {
  firstName: "Max", lastName: "TESTmann", email: "Max@Example.test", phone: "+49 211 123456",
  arrivalAt: "2026-12-01T10:00", departureAt: "2026-12-05T18:00", adults: "2", plate: "d ab 1234",
};
const parse = (o: Record<string, string> = {}, payment: "CASH" | "ONLINE" = "CASH") =>
  parsePublicBookingForm((n) => ({ ...valid, ...o })[n] ?? "", { extraIds: ["x1"], payment });

describe("parsePublicBookingForm", () => {
  it("accepts a valid form and normalises e-mail and plate", () => {
    const r = parse();
    assert.ok(r.ok);
    if (r.ok) {
      assert.equal(r.data.email, "max@example.test");
      assert.equal(r.data.plate, "D AB 1234");
    }
  });

  it("cash booking is confirmed, source website, payment cash, not paid", () => {
    const r = parse();
    assert.ok(r.ok);
    if (r.ok) {
      assert.equal(r.data.status, "confirmed");
      assert.equal(r.data.source, "WEBSITE");
      assert.equal(r.data.paymentMethod, "CASH");
      assert.equal(r.data.paid, false);
    }
  });

  it("online booking stays unconfirmed until the payment arrives", () => {
    const r = parse({}, "ONLINE");
    assert.ok(r.ok);
    if (r.ok) {
      assert.equal(r.data.status, "unconfirmed");
      assert.equal(r.data.paymentMethod, "ONLINE");
    }
  });

  it("ignores everything the visitor must not control", () => {
    const r = parse({
      paid: "on", manualPrice: "0,01", internalNote: "hack", source: "PHONE", status: "confirmed",
      paymentMethod: "PARTNER", externalRef: "X1", commission: "5", extra_other: "3",
    }, "ONLINE");
    assert.ok(r.ok);
    if (r.ok) {
      assert.equal(r.data.paid, false);
      assert.equal(r.data.manualPriceCents, null);
      assert.equal(r.data.internalNote, null);
      assert.equal(r.data.source, "WEBSITE");
      assert.equal(r.data.status, "unconfirmed");
      assert.equal(r.data.paymentMethod, "ONLINE");
      assert.equal(r.data.externalRef, null);
      assert.equal(r.data.commissionCents, null);
      assert.deepEqual(r.data.extras, []);
    }
  });

  it("requires a phone number", () => {
    assert.equal(parse({ phone: "" }).ok, false);
  });

  it("rejects bad e-mail, missing plate and bad VAT id", () => {
    assert.equal(parse({ email: "nope" }).ok, false);
    assert.equal(parse({ plate: "" }).ok, false);
    assert.equal(parse({ billingVatId: "12" }).ok, false);
  });

  it("reads extras only for known extra ids", () => {
    const r = parse({ extra_x1: "2" });
    assert.ok(r.ok);
    if (r.ok) assert.deepEqual(r.data.extras, [{ extraId: "x1", quantity: 2 }]);
  });
});

describe("parseOptionalHttpsUrl", () => {
  it("empty is allowed (null)", () => assert.equal(parseOptionalHttpsUrl("  "), null));
  it("accepts https URLs", () => assert.equal(parseOptionalHttpsUrl("https://parkflug.de/impressum/"), "https://parkflug.de/impressum/"));
  it("rejects http, javascript, credentials and garbage", () => {
    assert.equal(parseOptionalHttpsUrl("http://parkflug.de"), undefined);
    assert.equal(parseOptionalHttpsUrl("javascript:alert(1)"), undefined);
    assert.equal(parseOptionalHttpsUrl("https://user:pw@parkflug.de"), undefined);
    assert.equal(parseOptionalHttpsUrl("parkflug.de"), undefined);
    assert.equal(parseOptionalHttpsUrl("https://" + "a".repeat(300) + ".de"), undefined);
  });
});

describe("quoteQueryString", () => {
  it("carries only trip fields and extras, never personal data", () => {
    const data: Record<string, string> = { rateId: "r1", adults: "2", extra_x1: "1", email: "a@b.de", firstName: "Max", kids: "" };
    const qs = quoteQueryString((n) => data[n] ?? "", ["x1"]);
    const p = new URLSearchParams(qs);
    assert.equal(p.get("rateId"), "r1");
    assert.equal(p.get("extra_x1"), "1");
    assert.equal(p.get("email"), null);
    assert.equal(p.get("firstName"), null);
    assert.equal(p.get("kids"), null);
  });
});
