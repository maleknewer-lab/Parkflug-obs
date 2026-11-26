// Run: npx tsx --test tests/consent-status.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readConsent, shouldStoreSmsOptIn, TERMS_VERSION } from "../lib/booking/consent";
import { onlineStatus } from "../lib/payments/status";

describe("readConsent", () => {
  it("terms and sms are false unless the checkbox is on", () => {
    assert.deepEqual(readConsent(() => ""), { terms: false, smsOptIn: false });
    assert.deepEqual(readConsent((n) => (n === "termsAccepted" ? "on" : "")), { terms: true, smsOptIn: false });
  });
  it("only the exact value on counts", () => {
    assert.equal(readConsent(() => "true").terms, false);
    assert.equal(readConsent(() => "1").smsOptIn, false);
  });
  it("has a version string for the wording", () => assert.ok(TERMS_VERSION.length > 3));
});

describe("shouldStoreSmsOptIn", () => {
  const yes = { terms: true, smsOptIn: true };
  it("stores when the phone on file is the phone typed in", () => assert.equal(shouldStoreSmsOptIn(yes, "+49 170 1", "+49 170 1"), true));
  it("does not store for somebody else's number", () => assert.equal(shouldStoreSmsOptIn(yes, "+49 170 9", "+49 170 1"), false));
  it("does not store without a phone on file or without the checkbox", () => {
    assert.equal(shouldStoreSmsOptIn(yes, null, "+49 170 1"), false);
    assert.equal(shouldStoreSmsOptIn({ terms: true, smsOptIn: false }, "+49 170 1", "+49 170 1"), false);
  });
});

describe("onlineStatus", () => {
  const env = { STRIPE_SECRET_KEY: "sk_test_abc123", STRIPE_WEBHOOK_SECRET: "whsec_abc", NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_abc" };
  it("explains each reason", () => {
    assert.equal(onlineStatus(null, env), "no_account");
    assert.equal(onlineStatus({ active: false, envKey: "DEFAULT" }, env), "inactive");
    assert.equal(onlineStatus({ active: true, envKey: "DEFAULT" }, {}), "missing_keys");
    assert.equal(onlineStatus({ active: true, envKey: "DEFAULT" }, env), "ok");
  });
});
