// Minimal Stripe REST client (fetch only, no SDK). The secret key is passed in by the caller, who reads it
// from the environment through the brand's payment account — nothing about an account is hard-coded here.
import { encodeStripeParams, type StripeParams } from "./encode";

const API = "https://api.stripe.com";
// Pinned so Stripe changing its default version can never change our responses.
const API_VERSION = "2024-06-20";

export class StripeApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | null,
    readonly param: string | null,
    message: string,
  ) {
    super(message);
  }
}

export type StripeIntent = {
  id: string;
  status: string;
  amount: number;
  currency: string;
  client_secret: string | null;
  metadata?: Record<string, string>;
};

async function stripeRequest<T>(
  secretKey: string,
  method: "GET" | "POST",
  path: string,
  params?: StripeParams,
  idempotencyKey?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${secretKey}`,
    "Stripe-Version": API_VERSION,
  };
  if (method === "POST") headers["Content-Type"] = "application/x-www-form-urlencoded";
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: method === "POST" && params ? encodeStripeParams(params) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json().catch(() => null)) as { error?: { code?: string; param?: string; message?: string } } | null;
  if (!res.ok) {
    const e = json?.error;
    throw new StripeApiError(res.status, e?.code ?? null, e?.param ?? null, e?.message ?? `Stripe error ${res.status}`);
  }
  return json as T;
}

export async function createPaymentIntent(
  secretKey: string,
  a: {
    amountCents: number;
    bookingCode: string;
    checkoutKey: string;
    brandSlug: string;
    description: string;
    statementDescriptor: string | null; // from the brand settings
    idempotencyKey: string;
  },
): Promise<StripeIntent> {
  const base: StripeParams = {
    amount: a.amountCents,
    currency: "eur",
    // Card, PayPal, Apple Pay … = whatever is enabled in the Stripe dashboard of this account
    automatic_payment_methods: { enabled: true },
    description: a.description,
    metadata: { bookingCode: a.bookingCode, checkoutKey: a.checkoutKey, brand: a.brandSlug },
  };
  try {
    return await stripeRequest<StripeIntent>(secretKey, "POST", "/v1/payment_intents", {
      ...base,
      statement_descriptor_suffix: a.statementDescriptor,
    }, a.idempotencyKey);
  } catch (e) {
    // A suffix that does not fit the account's prefix must never block a sale: retry without it.
    if (e instanceof StripeApiError && a.statementDescriptor && e.param === "statement_descriptor_suffix") {
      return stripeRequest<StripeIntent>(secretKey, "POST", "/v1/payment_intents", base, `${a.idempotencyKey}-nosuffix`);
    }
    throw e;
  }
}

export const retrievePaymentIntent = (secretKey: string, id: string) =>
  stripeRequest<StripeIntent>(secretKey, "GET", `/v1/payment_intents/${encodeURIComponent(id)}`);

export const cancelPaymentIntent = (secretKey: string, id: string) =>
  stripeRequest<StripeIntent>(secretKey, "POST", `/v1/payment_intents/${encodeURIComponent(id)}/cancel`, {});
