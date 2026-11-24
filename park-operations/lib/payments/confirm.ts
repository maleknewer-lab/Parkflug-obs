// The ONE place where a successful online payment confirms a booking (used by the webhook and by the
// cron job). Idempotent: Stripe may deliver an event several times.
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { StripeIntent } from "@/lib/stripe/client";
import { planPaymentSucceeded } from "./rules";

export type ApplyResult = "confirmed" | "reconfirmed" | "ignored" | "flagged";

export async function applyPaymentSucceeded(paymentId: string, intent: StripeIntent, via: "webhook" | "cron"): Promise<ApplyResult> {
  const payment = await db.payment.findUnique({ where: { id: paymentId }, include: { booking: true } });
  if (!payment) return "ignored";

  const plan = planPaymentSucceeded(
    { status: payment.status, amountCents: payment.amountCents },
    { status: payment.booking.status },
    { status: intent.status, amount: intent.amount, currency: intent.currency },
  );

  const log = (action: string, changes: Record<string, { from: unknown; to: unknown }>) =>
    db.activityLog.create({
      data: {
        userId: null,
        bookingId: payment.bookingId,
        entity: "Payment",
        entityId: payment.id,
        action,
        changes: changes as unknown as Prisma.InputJsonObject,
      },
    });

  if (plan.action === "ignore") return "ignored";
  if (plan.action === "flag") {
    // Money arrived but does not match the booking: do NOT confirm, make it visible for staff.
    await log("payment_flag", {
      reason: { from: null, to: plan.reason },
      expectedCents: { from: null, to: payment.amountCents },
      receivedCents: { from: null, to: intent.amount },
      currency: { from: null, to: intent.currency },
    });
    return "flagged";
  }

  const done = await db.$transaction(async (tx) => {
    // Only the first delivery wins; repeats find the payment already PAID
    const won = await tx.payment.updateMany({
      where: { id: payment.id, status: { not: "PAID" } },
      data: { status: "PAID", paidAt: new Date() },
    });
    if (won.count === 0) return false;
    await tx.booking.update({
      where: { id: payment.bookingId },
      data: {
        status: "confirmed",
        paid: true,
        paymentMethod: "ONLINE",
        ...(plan.reconfirm ? { cancelledAt: null, cancelFree: null } : {}),
      },
    });
    return true;
  });
  if (!done) return "ignored";

  await log(plan.reconfirm ? "payment_reconfirmed" : "payment_confirmed", {
    status: { from: payment.booking.status, to: "confirmed" },
    paid: { from: payment.booking.paid, to: true },
    via: { from: null, to: via },
  });
  return plan.reconfirm ? "reconfirmed" : "confirmed";
}
