// Cancels online bookings whose payment was not completed within the brand's hold time
// (Brand.unpaidHoldMinutes, default 30). Called every few minutes by a scheduler with the header
// `Authorization: Bearer <CRON_SECRET>` (CRON_SECRET lives only in the server environment).
import { timingSafeEqual } from "node:crypto";
import { keysFor, loadAccountById } from "@/lib/payments/account";
import { applyPaymentSucceeded } from "@/lib/payments/confirm";
import { holdExpired } from "@/lib/payments/rules";
import { db } from "@/lib/db";
import { cancelPaymentIntent, retrievePaymentIntent, StripeApiError } from "@/lib/stripe/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(req: Request): boolean | "unconfigured" {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return "unconfigured";
  const given = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function run(req: Request) {
  const auth = authorized(req);
  if (auth === "unconfigured") return new Response("CRON_SECRET not configured", { status: 503 });
  if (!auth) return new Response("unauthorized", { status: 401 });

  const now = new Date();
  const candidates = await db.booking.findMany({
    where: { status: "unconfirmed", paymentMethod: "ONLINE", source: "WEBSITE", payments: { some: { status: "PENDING" } } },
    include: { brand: { select: { unpaidHoldMinutes: true } }, payments: { where: { status: "PENDING" }, take: 1 } },
    orderBy: { createdAt: "asc" },
    take: 100,
  });

  const out = { checked: candidates.length, expired: 0, confirmed: 0, skipped: 0, errors: 0 };

  const expireLocally = async (bookingId: string, paymentId: string) => {
    const changed = await db.$transaction(async (tx) => {
      const b = await tx.booking.updateMany({
        where: { id: bookingId, status: "unconfirmed" }, // never touch a booking that was confirmed meanwhile
        data: { status: "cancelled", cancelledAt: new Date(), cancelFree: true },
      });
      await tx.payment.updateMany({ where: { id: paymentId, status: "PENDING" }, data: { status: "FAILED" } });
      return b.count;
    });
    if (changed) {
      await db.activityLog.create({
        data: {
          userId: null,
          bookingId,
          entity: "Booking",
          entityId: bookingId,
          action: "expire_unpaid",
          changes: { status: { from: "unconfirmed", to: "cancelled" } },
        },
      });
      out.expired++;
    }
  };

  for (const booking of candidates) {
    if (!holdExpired(booking.createdAt, now, booking.brand.unpaidHoldMinutes)) {
      out.skipped++;
      continue;
    }
    const payment = booking.payments[0];
    try {
      if (!payment?.stripePaymentIntentId || !payment.paymentAccountId) {
        if (payment) await expireLocally(booking.id, payment.id);
        continue;
      }
      const account = await loadAccountById(payment.paymentAccountId);
      const keys = account && keysFor(account);
      if (!keys) {
        out.skipped++; // cannot reach Stripe for this account right now: try again next run
        continue;
      }
      try {
        await cancelPaymentIntent(keys.secretKey, payment.stripePaymentIntentId);
        await expireLocally(booking.id, payment.id);
      } catch (e) {
        if (!(e instanceof StripeApiError) || e.code !== "payment_intent_unexpected_state") throw e;
        // The intent is no longer cancelable: it either succeeded just now or is already canceled
        const intent = await retrievePaymentIntent(keys.secretKey, payment.stripePaymentIntentId);
        if (intent.status === "succeeded") {
          if ((await applyPaymentSucceeded(payment.id, intent, "cron")) !== "ignored") out.confirmed++;
        } else if (intent.status === "canceled") {
          await expireLocally(booking.id, payment.id);
        } else {
          out.skipped++;
        }
      }
    } catch {
      out.errors++; // never leak details; the next run retries
    }
  }
  return Response.json(out);
}

export const GET = run;
export const POST = run;
