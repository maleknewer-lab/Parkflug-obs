// Run: npx tsx --test tests/payments.test.ts   (node:test; adapt the imports if the project uses Vitest)
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { envNamesFor, isValidEnvKey, keyStatus, readStripeKeys } from "../lib/stripe/env";
import { verifyStripeSignature } from "../lib/stripe/signature";
import { encodeStripeParams } from "../lib/stripe/encode";
import { holdExpired, parseStatementDescriptor, planPaymentSucceeded } from "../lib/payments/rules";
import { formatMailbox, parseOptionalEmail, parseSenderName, parseSmsSender } from "../lib/brand/sender";

const SECRET = "whsec_testsecret123";
const sign = (body: string, t: number, secret = SECRET) =>
  `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${body}`).digest("hex")}`;
const now = new Date("2026-12-01T12:00:00Z");
const t0 = Math.floor(now.getTime() / 1000);

describe("verifyStripeSignature", () => {
  const body = '{"id":"evt_1","type":"payment_intent.succeeded"}';
  it("accepts a correct signature", () => assert.deepEqual(verifyStripeSignature(body, sign(body, t0), SECRET, { now }), { ok: true }));
  it("accepts when one of several v1 signatures matches", () => {
    const h = `${sign(body, t0)},v1=${"0".repeat(64)}`;
    assert.equal(verifyStripeSignature(body, h, SECRET, { now }).ok, true);
  });
  it("rejects a changed body", () => assert.equal(verifyStripeSignature(body + " ", sign(body, t0), SECRET, { now }).ok, false));
  it("rejects a wrong secret", () => assert.equal(verifyStripeSignature(body, sign(body, t0, "whsec_other"), SECRET, { now }).ok, false));
  it("rejects an old timestamp (replay)", () => {
    const r = verifyStripeSignature(body, sign(body, t0 - 3600), SECRET, { now });
    assert.deepEqual(r, { ok: false, reason: "expired" });
  });
  it("rejects missing and malformed headers", () => {
    assert.deepEqual(verifyStripeSignature(body, null, SECRET, { now }), { ok: false, reason: "missing" });
    assert.deepEqual(verifyStripeSignature(body, "garbage", SECRET, { now }), { ok: false, reason: "malformed" });
    assert.equal(verifyStripeSignature(body, `t=${t0},v1=zz`, SECRET, { now }).ok, false);
  });
});

describe("env keys", () => {
  it("DEFAULT uses the names already in Render", () => {
    assert.equal(envNamesFor("DEFAULT").secretKey, "STRIPE_SECRET_KEY");
    assert.equal(envNamesFor("DEFAULT").publishableKey, "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY");
  });
  it("other accounts get suffixed names", () => assert.equal(envNamesFor("ACME").webhookSecret, "STRIPE_WEBHOOK_SECRET_ACME"));
  it("refuses env keys that could read arbitrary variables", () => {
    assert.equal(isValidEnvKey("DATABASE_URL"), true); // allowed shape, but it only ever becomes STRIPE_*_DATABASE_URL
    assert.equal(envNamesFor("DATABASE_URL").secretKey, "STRIPE_SECRET_KEY_DATABASE_URL");
    assert.equal(isValidEnvKey("lower"), false);
    assert.equal(isValidEnvKey("A B"), false);
    assert.equal(isValidEnvKey(""), false);
    assert.throws(() => envNamesFor("x; rm"));
  });
  it("reports presence without exposing values and needs all three", () => {
    const env = { STRIPE_SECRET_KEY: "sk_test_abc123", STRIPE_WEBHOOK_SECRET: "whsec_abc", NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_abc" };
    assert.deepEqual(keyStatus("DEFAULT", env), { secretKey: true, webhookSecret: true, publishableKey: true });
    assert.notEqual(readStripeKeys("DEFAULT", env), null);
    assert.equal(readStripeKeys("DEFAULT", { ...env, STRIPE_WEBHOOK_SECRET: undefined }), null);
    assert.equal(readStripeKeys("DEFAULT", { ...env, STRIPE_SECRET_KEY: "pk_test_wrongkind" }), null);
  });
});

describe("encodeStripeParams", () => {
  it("encodes nested objects with brackets and skips empty values", () => {
    const s = encodeStripeParams({ amount: 1234, currency: "eur", metadata: { bookingCode: "ABC" }, x: undefined, y: null, automatic_payment_methods: { enabled: true } });
    const p = new URLSearchParams(s);
    assert.equal(p.get("amount"), "1234");
    assert.equal(p.get("metadata[bookingCode]"), "ABC");
    assert.equal(p.get("automatic_payment_methods[enabled]"), "true");
    assert.equal(p.has("x"), false);
    assert.equal(p.has("y"), false);
  });
  it("escapes special characters", () => {
    assert.equal(new URLSearchParams(encodeStripeParams({ description: "A&B=C é" })).get("description"), "A&B=C é");
  });
});

describe("planPaymentSucceeded", () => {
  const pi = { status: "succeeded", amount: 8900, currency: "eur" };
  it("confirms a pending payment with the right amount", () =>
    assert.deepEqual(planPaymentSucceeded({ status: "PENDING", amountCents: 8900 }, { status: "unconfirmed" }, pi), { action: "confirm", reconfirm: false }));
  it("is idempotent for repeated webhooks", () =>
    assert.deepEqual(planPaymentSucceeded({ status: "PAID", amountCents: 8900 }, { status: "confirmed" }, pi), { action: "ignore", reason: "already_paid" }));
  it("flags a wrong amount or currency instead of confirming", () => {
    assert.deepEqual(planPaymentSucceeded({ status: "PENDING", amountCents: 9000 }, { status: "unconfirmed" }, pi), { action: "flag", reason: "amount_mismatch" });
    assert.deepEqual(planPaymentSucceeded({ status: "PENDING", amountCents: 8900 }, { status: "unconfirmed" }, { ...pi, currency: "usd" }), { action: "flag", reason: "currency_mismatch" });
  });
  it("ignores intents that did not succeed", () =>
    assert.equal(planPaymentSucceeded({ status: "PENDING", amountCents: 8900 }, { status: "unconfirmed" }, { ...pi, status: "requires_payment_method" }).action, "ignore"));
  it("re-confirms a booking that expired while the payment came in", () =>
    assert.deepEqual(planPaymentSucceeded({ status: "PENDING", amountCents: 8900 }, { status: "cancelled" }, pi), { action: "confirm", reconfirm: true }));
});

describe("holdExpired", () => {
  const created = new Date("2026-12-01T10:00:00Z");
  it("is false before the hold ends", () => assert.equal(holdExpired(created, new Date("2026-12-01T10:29:59Z"), 30), false));
  it("is true at the limit", () => assert.equal(holdExpired(created, new Date("2026-12-01T10:30:00Z"), 30), true));
});

describe("parseStatementDescriptor", () => {
  it("empty is allowed", () => assert.equal(parseStatementDescriptor(" "), null));
  it("accepts a short brand name", () => assert.equal(parseStatementDescriptor("PARKFLUG"), "PARKFLUG"));
  it("rejects too long, forbidden characters, umlauts and digits-only", () => {
    assert.equal(parseStatementDescriptor("A".repeat(13)), undefined);
    assert.equal(parseStatementDescriptor("PARK*FLUG"), undefined);
    assert.equal(parseStatementDescriptor("PARKFLÜG"), undefined);
    assert.equal(parseStatementDescriptor("12345"), undefined);
    assert.equal(parseStatementDescriptor("A"), undefined);
  });
});

describe("brand sender", () => {
  it("validates e-mail addresses", () => {
    assert.equal(parseOptionalEmail("  Buchung@ParkFlug.de "), "buchung@parkflug.de");
    assert.equal(parseOptionalEmail(""), null);
    assert.equal(parseOptionalEmail("a@b"), undefined);
    assert.equal(parseOptionalEmail("a b@c.de"), undefined);
    assert.equal(parseOptionalEmail("a@c.de, x@y.de"), undefined);
  });
  it("blocks header injection in the sender name", () => {
    assert.equal(parseSenderName("ParkFlug"), "ParkFlug");
    assert.equal(parseSenderName("Evil\r\nBcc: x@y.de"), undefined);
    assert.equal(parseSenderName("A <b@c.de>"), undefined);
  });
  it("validates SMS sender ids", () => {
    assert.equal(parseSmsSender("ParkFlug"), "ParkFlug");
    assert.equal(parseSmsSender("Park Flug"), undefined);
    assert.equal(parseSmsSender("123456"), undefined);
    assert.equal(parseSmsSender("AB"), undefined);
    assert.equal(parseSmsSender("ABCDEFGHIJKL"), undefined);
  });
  it("formats the From header", () => {
    assert.equal(formatMailbox("ParkFlug", "buchung@parkflug.de"), '"ParkFlug" <buchung@parkflug.de>');
    assert.equal(formatMailbox(null, "a@b.de"), "a@b.de");
  });
});
