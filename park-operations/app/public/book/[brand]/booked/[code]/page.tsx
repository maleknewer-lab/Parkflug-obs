import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isValidBookingCode, normalizeBookingCode } from "@/lib/booking/code";
import { db } from "@/lib/db";
import { formatBerlin } from "@/lib/pricing";
import { formatEuro } from "@/lib/rates/form";
import { LegalFooter } from "../../../../_components/legal-footer";
import { AutoRefresh } from "./auto-refresh";

// Confirmation page. It is reached with the booking code, so it shows NO personal data
// (no name, e-mail, phone or plate) — only what the customer needs to see right after booking.
// Rate limiting for pages that open with the code alone comes in PR 4.

export const metadata: Metadata = { title: "Buchung bestätigt" };
export const dynamic = "force-dynamic";

export default async function BookedPage({ params }: { params: Promise<{ brand: string; code: string }> }) {
  const { brand: slug, code: rawCode } = await params;
  const code = normalizeBookingCode(rawCode);
  if (!isValidBookingCode(code)) notFound();

  const booking = await db.booking.findFirst({
    where: { code, brand: { slug } },
    select: {
      code: true,
      status: true,
      arrivalAt: true,
      departureAt: true,
      adults: true,
      kids: true,
      priceCents: true,
      paymentMethod: true,
      paid: true,
      rate: { select: { name: true } },
      brand: { select: { name: true, impressumUrl: true, privacyUrl: true, termsUrl: true } },
    },
  });
  if (!booking) notFound();

  const persons = booking.adults + booking.kids;
  const online = booking.paymentMethod === "ONLINE";
  // Online booking that is not confirmed yet: either Stripe's confirmation is on its way or nothing was paid
  const waitingForPayment = online && booking.status === "unconfirmed";
  return (
    <main className="pub-wrap">
      <header className="pub-head"><h1>{booking.brand.name}</h1></header>

      <section className="pub-card">
        <h2>
          {booking.status === "cancelled"
            ? "Diese Buchung wurde storniert"
            : waitingForPayment
              ? "Ihre Zahlung wird bestätigt …"
              : "Vielen Dank – Ihre Buchung ist bestätigt"}
        </h2>
        {waitingForPayment && (
          <>
            <AutoRefresh />
            <p className="pub-muted" style={{ margin: 0 }}>
              Das dauert normalerweise nur wenige Sekunden. Die Seite aktualisiert sich automatisch.
              Wenn Sie die Zahlung nicht abgeschlossen haben, können Sie sie hier fortsetzen.
            </p>
            <a className="pub-btn" href={`/book/${slug}/pay/${booking.code}`}>Zahlung öffnen</a>
          </>
        )}
        <div>
          <span className="pub-muted">Ihr Buchungscode</span>
          <div className="pub-code">{booking.code}</div>
        </div>
        <div className="pub-sum">
          <span>Tarif: {booking.rate.name}</span>
          <span>Anreise: {formatBerlin(booking.arrivalAt)} Uhr</span>
          <span>Abreise: {formatBerlin(booking.departureAt)} Uhr</span>
          <span>{persons} {persons === 1 ? "Person" : "Personen"}</span>
          <span>Gesamtpreis (inkl. MwSt.): {formatEuro(booking.priceCents)} €</span>
          {booking.paymentMethod === "CASH" && <span>Zahlung: Barzahlung bei Ankunft</span>}
          {online && booking.paid && <span>Zahlung: online bezahlt</span>}
        </div>
        <p className="pub-muted" style={{ margin: 0 }}>
          {waitingForPayment ? "Ihr Code wird mit der bestätigten Zahlung gültig." : "Bitte notieren Sie den Code – Sie brauchen ihn bei der Anreise."}
        </p>
      </section>

      <LegalFooter brand={booking.brand} />
    </main>
  );
}
