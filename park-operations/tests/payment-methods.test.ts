// Run: npx tsx --test tests/payment-methods.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { methodsFor, parsePaymentChoice, stripeTypesFor } from "../lib/payments/methods";

describe("methodsFor", () => {
  it("nothing online without a working account", () => {
    assert.deepEqual(methodsFor("no_account", null), { card: false, paypal: false });
    assert.deepEqual(methodsFor("missing_keys", { paypalEnabled: true }), { card: false, paypal: false });
    assert.deepEqual(methodsFor("inactive", { paypalEnabled: true }), { card: false, paypal: false });
  });
  it("card with a working account, PayPal only when switched on", () => {
    assert.deepEqual(methodsFor("ok", { paypalEnabled: false }), { card: true, paypal: false });
    assert.deepEqual(methodsFor("ok", { paypalEnabled: true }), { card: true, paypal: true });
  });
});

describe("parsePaymentChoice", () => {
  const all = { card: true, paypal: true };
  const none = { card: false, paypal: false };
  it("cash is always possible", () => assert.equal(parsePaymentChoice("CASH", none), "CASH"));
  it("online methods only when available", () => {
    assert.equal(parsePaymentChoice("CARD", all), "CARD");
    assert.equal(parsePaymentChoice("PAYPAL", all), "PAYPAL");
    assert.equal(parsePaymentChoice("CARD", none), null);
    assert.equal(parsePaymentChoice("PAYPAL", { card: true, paypal: false }), null);
  });
  it("rejects missing and unknown values (also the old ONLINE value)", () => {
    for (const v of ["", "ONLINE", "cash", "BITCOIN"]) assert.equal(parsePaymentChoice(v, all), null);
  });
});

describe("stripeTypesFor", () => {
  it("maps the choice to Stripe payment method types", () => {
    assert.deepEqual(stripeTypesFor("CARD"), ["card"]);
    assert.deepEqual(stripeTypesFor("PAYPAL"), ["paypal"]);
  });
});
