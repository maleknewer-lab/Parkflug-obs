// Pure payment rules (no database, no Stripe): what a Stripe event means for a booking,
// when an unpaid online booking expires, and what a statement descriptor may look like.

/** Stripe's minimum charge for EUR is 0.50 €. */
export const MIN_ONLINE_CENTS = 50;

export function holdExpired(createdAt: Date, now: Date, holdMinutes: number): boolean {
  return now.getTime() - createdAt.getTime() >= holdMinutes * 60_000;
}

export type PaymentSnapshot = { status: "PENDING" | "PAID" | "REFUNDED" | "FAILED"; amountCents: number };
export type BookingSnapshot = { status: "unconfirmed" | "confirmed" | "cancelled" };
export type IntentSnapshot = { status: string; amount: number; currency: string };

export type SucceededPlan =
  | { action: "ignore"; reason: "already_paid" | "intent_not_succeeded" }
  | { action: "flag"; reason: "amount_mismatch" | "currency_mismatch" } // money arrived but does not fit: staff must look
  | { action: "confirm"; reconfirm: boolean }; // reconfirm = booking had been cancelled (expired) while the payment came in

/**
 * Decides what to do when Stripe reports a successful payment. Idempotent: webhooks can be delivered
 * more than once. The booking is confirmed ONLY here, never because the browser says so.
 */
export function planPaymentSucceeded(payment: PaymentSnapshot, booking: BookingSnapshot, intent: IntentSnapshot): SucceededPlan {
  if (intent.status !== "succeeded") return { action: "ignore", reason: "intent_not_succeeded" };
  if (payment.status === "PAID") return { action: "ignore", reason: "already_paid" };
  if (intent.currency.toLowerCase() !== "eur") return { action: "flag", reason: "currency_mismatch" };
  if (intent.amount !== payment.amountCents) return { action: "flag", reason: "amount_mismatch" };
  return { action: "confirm", reconfirm: booking.status === "cancelled" };
}

/** Card-statement suffix (shown after the account's prefix). Conservative: Stripe rejects too long values. */
export function parseStatementDescriptor(input: string): string | null | undefined {
  const v = input.trim();
  if (v === "") return null;
  if (v.length < 2 || v.length > 12) return undefined;
  if (!/^[A-Za-z0-9 .\-]+$/.test(v)) return undefined; // no < > \ ' " * and no umlauts
  if (!/[A-Za-z]/.test(v)) return undefined; // Stripe needs at least one letter
  return v;
}
