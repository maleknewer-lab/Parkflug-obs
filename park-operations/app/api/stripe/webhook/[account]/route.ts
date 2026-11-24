// Stripe webhook, one URL per payment ACCOUNT (not per brand): /api/stripe/webhook/<account slug>.
// Brands that share an account share this endpoint. Every request is verified with that account's
// webhook secret (read from the environment through PaymentAccount.envKey) before anything is touched.
import { keysFor } from "@/lib/payments/account";
import { applyPaymentSucceeded } from "@/lib/payments/confirm";
import { db } from "@/lib/db";
import type { StripeIntent } from "@/lib/stripe/client";
import { verifyStripeSignature } from "@/lib/stripe/signature";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ account: string }> }) {
  const { account: slug } = await ctx.params;
  const account = await db.paymentAccount.findFirst({ where: { slug, active: true } });
  if (!account) return new Response("unknown account", { status: 404 });

  const keys = keysFor(account);
  if (!keys) return new Response("account keys not configured", { status: 503 }); // Stripe retries later

  const raw = await req.text(); // RAW body: the signature covers the exact bytes
  const verdict = verifyStripeSignature(raw, req.headers.get("stripe-signature"), keys.webhookSecret);
  if (!verdict.ok) return new Response(`invalid signature (${verdict.reason})`, { status: 400 });

  let event: { type?: string; data?: { object?: StripeIntent } };
  try {
    event = JSON.parse(raw);
  } catch {
    return new Response("invalid json", { status: 400 });
  }
  const intent = event.data?.object;
  if (!intent?.id) return Response.json({ received: true, ignored: "no object" });

  if (event.type === "payment_intent.succeeded" || event.type === "payment_intent.canceled") {
    const payment = await db.payment.findUnique({ where: { stripePaymentIntentId: intent.id } });
    // Unknown intent, or it belongs to ANOTHER account: acknowledge and ignore
    if (!payment || payment.paymentAccountId !== account.id) return Response.json({ received: true, ignored: "not ours" });

    if (event.type === "payment_intent.succeeded") {
      const result = await applyPaymentSucceeded(payment.id, intent, "webhook");
      return Response.json({ received: true, result });
    }
    await db.payment.updateMany({ where: { id: payment.id, status: "PENDING" }, data: { status: "FAILED" } });
  }
  return Response.json({ received: true });
}
