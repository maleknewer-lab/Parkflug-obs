// Verifies the `Stripe-Signature` header of a webhook (HMAC-SHA256 over "<timestamp>.<raw body>").
// Works on the RAW request body: any re-serialised JSON would break the signature.
import { createHmac, timingSafeEqual } from "node:crypto";

export type SignatureResult = { ok: true } | { ok: false; reason: "missing" | "malformed" | "expired" | "mismatch" };

export function verifyStripeSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  opts: { now?: Date; toleranceSeconds?: number } = {},
): SignatureResult {
  if (!header) return { ok: false, reason: "missing" };
  let timestamp: string | null = null;
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k === "t") timestamp = v;
    else if (k === "v1") signatures.push(v);
  }
  if (!timestamp || !/^\d+$/.test(timestamp) || signatures.length === 0) return { ok: false, reason: "malformed" };

  const now = opts.now ?? new Date();
  const tolerance = opts.toleranceSeconds ?? 300;
  if (Math.abs(now.getTime() / 1000 - Number(timestamp)) > tolerance) return { ok: false, reason: "expired" };

  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest();
  const match = signatures.some((sig) => {
    if (!/^[0-9a-f]{64}$/i.test(sig)) return false;
    return timingSafeEqual(expected, Buffer.from(sig, "hex"));
  });
  return match ? { ok: true } : { ok: false, reason: "mismatch" };
}
