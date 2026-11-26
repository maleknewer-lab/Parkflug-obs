import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadPublicBrand } from "@/lib/booking/public-quote";
import { ONLINE_HINT, onlineStatus } from "@/lib/payments/status";
import { toBerlinLocalInput } from "@/lib/pricing";
import { optionalStaff } from "@/lib/staff-optional";
import { LegalFooter } from "@/app/book/_components/legal-footer";
import { BookingForm } from "./booking-form";

// Public booking page: one page with six steps and a live price (layout of the approved prototype).
// The price always comes from the server (lib/pricing); creating the booking is createPublicBookingAction.

export const metadata: Metadata = { title: "Parkplatz buchen" };
export const dynamic = "force-dynamic";

const DAY = 86_400_000;

export default async function PublicBookingPage({ params }: { params: Promise<{ brand: string }> }) {
  const { brand: slug } = await params;
  const brand = await loadPublicBrand(slug);
  if (!brand) notFound();

  const staff = await optionalStaff();
  const status = onlineStatus(brand.paymentAccount, process.env);

  const now = Date.now();
  const dayOf = (n: number) => toBerlinLocalInput(new Date(now + n * DAY)).slice(0, 10);

  return (
    <main className="pub-wrap">
      <div className="pub-ph">
        <h1>Parken am Flughafen Düsseldorf</h1>
        <p>Parkplatz online buchen – Preis sofort, kostenlos stornieren bis {brand.freeCancelHours} Std. vor Ankunft.</p>
      </div>

      {brand.rates.length === 0 ? (
        <div className="pub-card">Online-Buchungen sind zurzeit nicht möglich. Bitte kontaktieren Sie uns direkt.</div>
      ) : (
        <BookingForm
          brandSlug={brand.slug}
          rates={brand.rates.map((r) => ({ id: r.id, name: r.name, service: r.service, lotType: r.lotType }))}
          extras={brand.extras}
          showSeats={brand.rates.some((r) => r.seatsEnabled ?? brand.seatsEnabled)}
          freeCancelHours={brand.freeCancelHours}
          onlineAvailable={status === "ok"}
          onlineHint={staff && status !== "ok" ? ONLINE_HINT[status] : null}
          checkoutKey={crypto.randomUUID()}
          termsUrl={brand.termsUrl}
          privacyUrl={brand.privacyUrl}
          defaults={{ arrDate: dayOf(5), depDate: dayOf(12), arrTime: "06:30", depTime: "18:00" }}
        />
      )}

      <LegalFooter brand={brand} />
    </main>
  );
}
