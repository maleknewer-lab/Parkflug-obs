"use server";

// Public checkout (Phase 3): creates a booking from the website, paid in cash on site (confirmed at once)
// or online through the brand's payment account (stays `unconfirmed` until the Stripe webhook reports
// success). The visitor is untrusted: trip data is re-validated and re-priced on the server, customer
// fields go through the shared parser with an allow-list, and everything the system decides (status,
// source, payment, paid, price) is set here.

import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { generateUniqueBookingCode } from "@/lib/booking";
import { readConsent, shouldStoreSmsOptIn, TERMS_VERSION } from "@/lib/booking/consent";
import { parsePublicBookingForm } from "@/lib/booking/public-form";
import { loadPublicBrand, quoteForBrand } from "@/lib/booking/public-quote";
import { breakdownJson } from "@/lib/booking/server";
import { db } from "@/lib/db";
import { keysFor, onlineAvailable } from "@/lib/payments/account";
import { MIN_ONLINE_CENTS } from "@/lib/payments/rules";
import { cancelPaymentIntent, createPaymentIntent, StripeApiError, type StripeIntent } from "@/lib/stripe/client";

export type CheckoutState = { error?: string; values?: Record<string, string> };

// Customer fields that are given back to the form after an error (never put into a URL)
const REFILL = [
  "firstName", "lastName", "email", "phone", "plate", "vehicle", "outboundFlight", "returnFlight",
  "customerNote", "billingCompany", "billingContact", "billingAddress", "billingVatId",
] as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const nextPath = (slug: string, code: string, online: boolean, status: string) =>
  online && status === "unconfirmed" ? `/book/${slug}/pay/${code}` : `/book/${slug}/booked/${code}`;

async function createPublicBookingInner(fd: FormData): Promise<CheckoutState> {
  const text = (name: string) => String(fd.get(name) ?? "").trim();
  const values = Object.fromEntries(REFILL.map((k) => [k, String(fd.get(k) ?? "")]));
  const fail = (error: string): CheckoutState => ({ error, values });

  const brand = await loadPublicBrand(text("brandSlug"));
  if (!brand) return fail("Diese Buchungsseite ist nicht verfügbar");

  const checkoutKey = text("checkoutKey");
  if (!UUID.test(checkoutKey)) return fail("Die Sitzung ist abgelaufen. Bitte laden Sie die Seite neu.");

  // Consent: AGB + Datenschutz are mandatory, the SMS opt-in is optional and never pre-ticked
  const consent = readConsent(text);
  if (!consent.terms) return fail("Bitte akzeptieren Sie AGB und Datenschutz.");

  // Double click / retry: the same key returns the booking that already exists
  const existing = await db.booking.findUnique({
    where: { checkoutKey },
    select: { code: true, brandId: true, status: true, paymentMethod: true },
  });
  if (existing && existing.brandId === brand.id) {
    redirect(nextPath(brand.slug, existing.code, existing.paymentMethod === "ONLINE", existing.status));
  }

  // Trip data: rate of THIS brand, lead time, price — all from the server
  const now = new Date();
  const quote = await quoteForBrand(brand, text, now);
  if (quote.state !== "ok") return fail(quote.state === "error" ? quote.error : "Bitte zuerst die Reisedaten angeben");

  // Payment choice: online only if this brand has an active payment account with all keys configured
  const online = text("payment") === "ONLINE";
  const account = brand.paymentAccount;
  if (online && !onlineAvailable(account)) {
    return fail("Online-Zahlung ist zurzeit nicht verfügbar. Bitte wählen Sie Barzahlung vor Ort.");
  }
  if (online && quote.result.totalCents < MIN_ONLINE_CENTS) {
    return fail("Online-Zahlung ist erst ab 0,50 € möglich. Bitte wählen Sie Barzahlung vor Ort.");
  }

  // Customer data (allow-list; status/source/payment are forced)
  const parsed = parsePublicBookingForm(text, {
    extraIds: brand.extras.map((e) => e.id),
    payment: online ? "ONLINE" : "CASH",
  });
  if (!parsed.ok) return fail(parsed.error);
  const d = parsed.data;

  const code = await generateUniqueBookingCode(
    async (c) => (await db.booking.findUnique({ where: { code: c }, select: { id: true } })) !== null,
  );

  // Online: the Stripe payment intent is created BEFORE the booking exists, so a Stripe outage leaves no
  // half-made booking behind. The same checkoutKey always maps to the same intent (idempotency key).
  let intent: StripeIntent | null = null;
  let secretKey: string | null = null;
  if (online && account) {
    secretKey = keysFor(account)?.secretKey ?? null;
    if (!secretKey) return fail("Online-Zahlung ist zurzeit nicht verfügbar. Bitte wählen Sie Barzahlung vor Ort.");
    try {
      intent = await createPaymentIntent(secretKey, {
        amountCents: quote.result.totalCents,
        bookingCode: code,
        checkoutKey,
        brandSlug: brand.slug,
        description: `${brand.name} ${code}`,
        statementDescriptor: brand.statementDescriptor, // from the brand settings
        idempotencyKey: `pi-${checkoutKey}`,
      });
    } catch (e) {
      if (e instanceof StripeApiError) {
        return fail("Die Online-Zahlung konnte nicht gestartet werden. Bitte versuchen Sie es erneut oder wählen Sie Barzahlung.");
      }
      throw e;
    }
  }

  let target: string | null = null;
  try {
    const booking = await db.$transaction(async (tx) => {
      // Same e-mail (case-insensitive) = same customer. A visitor never overwrites an existing
      // customer's data; an empty phone number may be filled in.
      let customer = await tx.customer.findFirst({ where: { email: { equals: d.email, mode: "insensitive" } } });
      if (!customer) {
        customer = await tx.customer.create({
          data: { firstName: d.firstName, lastName: d.lastName, email: d.email, phone: d.phone, company: d.company },
        });
      } else if (!customer.phone && d.phone) {
        customer = await tx.customer.update({ where: { id: customer.id }, data: { phone: d.phone } });
      }

      if (shouldStoreSmsOptIn(consent, customer.phone, d.phone) && !customer.smsOptInAt) {
        customer = await tx.customer.update({
          where: { id: customer.id },
          data: { smsOptInAt: now, smsOptInSource: "website_booking", smsOptOutAt: null },
        });
      }

      return tx.booking.create({
        data: {
          code,
          checkoutKey,
          brandId: quote.brandId,
          customerId: customer.id,
          rateId: quote.data.rateId,
          status: d.status, // cash: confirmed · online: unconfirmed until the webhook
          arrivalAt: d.arrivalAt,
          departureAt: d.departureAt,
          outboundFlight: d.outboundFlight,
          returnFlight: d.returnFlight,
          adults: d.adults,
          kids: d.kids,
          seatBaby: d.seatBaby,
          seatKind: d.seatKind,
          seatBoost: d.seatBoost,
          plate: d.plate,
          vehicle: d.vehicle,
          oversize: d.oversize,
          priceCents: quote.result.totalCents,
          discountCents: quote.result.discountCents,
          priceBreakdown: breakdownJson(quote.result, null),
          paid: false,
          paymentMethod: online ? "ONLINE" : "CASH",
          couponId: quote.couponId,
          customerNote: d.customerNote,
          billingCompany: d.billingCompany,
          billingContact: d.billingContact,
          billingAddress: d.billingAddress,
          billingVatId: d.billingVatId,
          source: "WEBSITE",
          termsAcceptedAt: now,
          termsVersion: TERMS_VERSION,
          extras: {
            create: quote.extras.map((e) => ({ extraId: e.extraId, quantity: e.quantity, priceCents: e.priceCents })),
          },
          ...(intent && account
            ? {
                payments: {
                  create: {
                    method: "ONLINE" as const,
                    status: "PENDING" as const,
                    amountCents: quote.result.totalCents,
                    stripePaymentIntentId: intent.id,
                    paymentAccountId: account.id, // refunds must go back to this account
                  },
                },
              }
            : {}),
        },
      });
    });

    await db.activityLog.create({
      data: {
        userId: null, // the visitor, not a staff member
        bookingId: booking.id,
        entity: "Booking",
        entityId: booking.id,
        action: "create",
        changes: {
          status: { from: null, to: booking.status },
          priceCents: { from: null, to: booking.priceCents },
          arrivalAt: { from: null, to: d.arrivalAt.toISOString() },
          departureAt: { from: null, to: d.departureAt.toISOString() },
          source: { from: null, to: "WEBSITE" },
          paymentMethod: { from: null, to: booking.paymentMethod },
          termsVersion: { from: null, to: TERMS_VERSION },
          smsOptIn: { from: null, to: consent.smsOptIn },
        } as unknown as Prisma.InputJsonObject,
      },
    });
    target = nextPath(brand.slug, booking.code, online, booking.status);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      // Two submits with the same key at the same moment: the second one lands here
      const again = await db.booking.findUnique({ where: { checkoutKey }, select: { code: true, status: true, paymentMethod: true } });
      if (!again) return fail("Bitte versuchen Sie es noch einmal.");
      target = nextPath(brand.slug, again.code, again.paymentMethod === "ONLINE", again.status);
    } else {
      // The booking could not be saved: release the payment intent (best effort) and report the error
      if (intent && secretKey) await cancelPaymentIntent(secretKey, intent.id).catch(() => undefined);
      throw e;
    }
  }

  redirect(target ?? `/book/${brand.slug}`);
}

export async function createPublicBookingAction(_prev: CheckoutState, fd: FormData): Promise<CheckoutState> {
  try {
    return await createPublicBookingInner(fd);
  } catch (e) {
    // redirect() works by throwing: let Next.js handle it
    const digest = typeof e === "object" && e !== null && "digest" in e ? String((e as { digest: unknown }).digest) : "";
    if (digest.startsWith("NEXT_REDIRECT")) throw e;
    console.error("[public-booking] failed:", e);
    const detail = process.env.PUBLIC_DEBUG === "1" && e instanceof Error ? ` [${e.name}: ${e.message.slice(0, 400)}]` : "";
    return { error: `Die Buchung konnte gerade nicht gespeichert werden. Bitte versuchen Sie es in einem Moment erneut.${detail}` };
  }
}
