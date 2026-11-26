// Payment methods the customer can pick on the booking form. The customer chooses the method FIRST;
// for an online method the Stripe payment is then created for exactly that method.
// Pure: no database, no Stripe calls.
import type { OnlineStatus } from "./status";

export type PaymentChoice = "CARD" | "PAYPAL" | "CASH";
export type MethodAvailability = { card: boolean; paypal: boolean };

/** Card (Visa, Mastercard, Amex, Apple Pay, Google Pay) needs a working payment account; PayPal also its own switch. */
export function methodsFor(status: OnlineStatus, account: { paypalEnabled: boolean } | null): MethodAvailability {
  const ok = status === "ok";
  return { card: ok, paypal: ok && !!account?.paypalEnabled };
}

/** Cash is always allowed. An online method only when it is available; anything else is rejected (null). */
export function parsePaymentChoice(value: string, avail: MethodAvailability): PaymentChoice | null {
  if (value === "CASH") return "CASH";
  if (value === "CARD") return avail.card ? "CARD" : null;
  if (value === "PAYPAL") return avail.paypal ? "PAYPAL" : null;
  return null;
}

/** Stripe `payment_method_types` for an online choice. */
export function stripeTypesFor(choice: "CARD" | "PAYPAL"): string[] {
  return choice === "PAYPAL" ? ["paypal"] : ["card"];
}
