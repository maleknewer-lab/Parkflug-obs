import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isValidBookingCode, normalizeBookingCode } from "@/lib/booking/code";
import { db } from "@/lib/db";
import { formatBerlin } from "@/lib/pricing";
import { formatEuro } from "@/lib/rates/form";
import { LegalFooter } from "../../../../_components/legal-footer";

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
      rate: { select: { name: true } },
      brand: { select: { name: true, impressumUrl: true, privacyUrl: true, termsUrl: true } },
    },
  });
  if (!booking) notFound();

  const persons = booking.adults + booking.kids;
  return (
    <main className="pub-wrap">
      <header className="pub-head"><h1>{booking.brand.name}</h1></header>

      <section className="pub-card">
        <h2>{booking.status === "cancelled" ? "Diese Buchung wurde storniert" : "Vielen Dank – Ihre Buchung ist bestätigt"}</h2>
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
        </div>
        <p className="pub-muted" style={{ margin: 0 }}>
          Bitte notieren Sie den Code – Sie brauchen ihn bei der Anreise.
        </p>
      </section>

      <LegalFooter brand={booking.brand} />
    </main>
  );
}
