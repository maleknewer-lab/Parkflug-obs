import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { isValidBookingCode, normalizeBookingCode } from "@/lib/booking/code";
import { db } from "@/lib/db";
import { loadAccountById } from "@/lib/payments/account";
import { formatBerlin } from "@/lib/pricing";
import { formatEuro } from "@/lib/rates/form";
import { retrievePaymentIntent } from "@/lib/stripe/client";
import { LegalFooter } from "@/app/book/_components/legal-footer";
import { PaymentForm } from "./payment-form";

// Online payment for a booking that waits for it. Reached with the booking code (rate limiting for such
// pages comes in PR 4). The page only shows the amount and the Stripe form — no personal data.

export const metadata: Metadata = { title: "Zahlung" };
export const dynamic = "force-dynamic";

export default async function PayPage({ params }: { params: Promise<{ brand: string; code: string }> }) {
  const { brand: slug, code: rawCode } = await params;
  const code = normalizeBookingCode(rawCode);
  if (!isValidBookingCode(code)) notFound();

  const booking = await db.booking.findFirst({
    where: { code, brand: { slug } },
    select: {
      code: true,
      status: true,
      paymentMethod: true,
      priceCents: true,
      arrivalAt: true,
      departureAt: true,
      brand: { select: { name: true, impressumUrl: true, privacyUrl: true, termsUrl: true } },
      payments: { where: { method: "ONLINE" }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!booking) notFound();
  if (booking.paymentMethod !== "ONLINE" || booking.status === "confirmed") redirect(`/book/${slug}/booked/${code}`);

  const head = (
    <header className="pub-head"><h1>{booking.brand.name}</h1></header>
  );
  const problem = (message: string) => (
    <main className="pub-wrap">
      {head}
      <div className="pub-error" role="alert">⚠ {message}</div>
      <a className="pub-btn" href={`/book/${slug}`}>Neue Buchung starten</a>
      <LegalFooter brand={booking.brand} />
    </main>
  );

  if (booking.status === "cancelled") {
    return problem("Die Zahlungsfrist ist abgelaufen und die Buchung wurde storniert. Bitte buchen Sie erneut.");
  }

  const payment = booking.payments[0];
  const account = payment?.paymentAccountId ? await loadAccountById(payment.paymentAccountId) : null;
  if (!payment?.stripePaymentIntentId || !account?.keys) {
    return problem("Online-Zahlung ist zurzeit nicht verfügbar. Bitte kontaktieren Sie uns.");
  }

  let intent;
  try {
    intent = await retrievePaymentIntent(account.keys.secretKey, payment.stripePaymentIntentId);
  } catch {
    return problem("Die Zahlung konnte nicht geladen werden. Bitte versuchen Sie es in einem Moment erneut.");
  }
  // Paid already (the webhook may still be on its way): the confirmation page waits for it
  if (intent.status === "succeeded" || intent.status === "processing") redirect(`/book/${slug}/booked/${code}`);
  if (intent.status === "canceled" || !intent.client_secret) {
    return problem("Die Zahlungsfrist ist abgelaufen. Bitte buchen Sie erneut.");
  }

  return (
    <main className="pub-wrap">
      {head}
      <section className="pub-card">
        <h2>Zahlung für Buchung {booking.code}</h2>
        <div className="pub-sum">
          <span>Anreise: {formatBerlin(booking.arrivalAt)} Uhr</span>
          <span>Abreise: {formatBerlin(booking.departureAt)} Uhr</span>
          <span>Gesamtpreis (inkl. MwSt.): {formatEuro(booking.priceCents)} €</span>
        </div>
        <p className="pub-muted" style={{ margin: 0 }}>
          Ihre Buchung wird erst nach erfolgreicher Zahlung bestätigt. Bitte schließen Sie die Zahlung innerhalb weniger Minuten ab.
        </p>
      </section>
      <PaymentForm
        publishableKey={account.keys.publishableKey}
        clientSecret={intent.client_secret}
        brandSlug={slug}
        code={booking.code}
        amountLabel={`${formatEuro(booking.priceCents)} €`}
      />
      <LegalFooter brand={booking.brand} />
    </main>
  );
}
