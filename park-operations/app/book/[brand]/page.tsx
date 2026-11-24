import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadPublicBrand, quoteForBrand } from "@/lib/booking/public-quote";
import { quoteQueryString } from "@/lib/booking/quote";
import { formatEuro } from "@/lib/rates/form";
import { LegalFooter } from "@/app/book/_components/legal-footer";

// Public booking page, step 1 of 2 (Phase 3, PR 1): trip data → live price.
// A plain GET form: no JavaScript needed, and NO personal data in the URL (name, e-mail and phone
// come in step 2 by POST, PR 2). The price always comes from the server (lib/pricing).
// The checkout (customer data + booking) is /book/[brand]/checkout.

export const metadata: Metadata = { title: "Parkplatz buchen" };
export const dynamic = "force-dynamic";

const SERVICE_LABEL = { SHUTTLE: "Shuttle", VALET: "Valet" } as const;
const LOT_LABEL = { GARAGE: "Parkhaus", OUTDOOR: "Außenparkplatz" } as const;

type SearchParams = Record<string, string | string[] | undefined>;

export default async function PublicBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ brand: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { brand: slug } = await params;
  const brand = await loadPublicBrand(slug);
  if (!brand) notFound();

  const sp = await searchParams;
  const get = (name: string) => {
    const v = sp[name];
    return (Array.isArray(v) ? v[0] : v) ?? "";
  };
  const quote = await quoteForBrand(brand, get, new Date());

  const showSeats = brand.rates.some((r) => r.seatsEnabled ?? brand.seatsEnabled);
  const selectedRate = get("rateId");

  return (
    <main className="pub-wrap">
      <header className="pub-head">
        <h1>{brand.name}</h1>
      </header>

      {brand.rates.length === 0 ? (
        <div className="pub-card">Online-Buchungen sind zurzeit nicht möglich. Bitte kontaktieren Sie uns direkt.</div>
      ) : (
        <form method="get" className="pub-card" style={{ gap: 20 }}>
          <h2>Ihre Reise</h2>

          <fieldset style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: 8 }}>
            <legend style={{ fontWeight: 600, marginBottom: 8 }}>Tarif</legend>
            {brand.rates.map((r, i) => (
              <label key={r.id} className="pub-rate">
                <input
                  type="radio"
                  name="rateId"
                  value={r.id}
                  defaultChecked={selectedRate ? selectedRate === r.id : i === 0}
                  required
                />
                <span>
                  {r.name}
                  <small>{SERVICE_LABEL[r.service]} · {LOT_LABEL[r.lotType]}</small>
                </span>
              </label>
            ))}
          </fieldset>

          <div className="pub-grid">
            <label className="pub-field">
              <span>Anreise (Parkplatz)</span>
              <input type="datetime-local" name="arrivalAt" defaultValue={get("arrivalAt")} required step={60} />
            </label>
            <label className="pub-field">
              <span>Abreise (Abholung)</span>
              <input type="datetime-local" name="departureAt" defaultValue={get("departureAt")} required step={60} />
            </label>
          </div>
          <p className="pub-muted" style={{ margin: 0 }}>
            Alle Zeiten in deutscher Ortszeit. Anreise- und Abreisetag zählen als volle Tage.
          </p>

          <div className="pub-grid">
            <label className="pub-field">
              <span>Erwachsene</span>
              <input name="adults" inputMode="numeric" defaultValue={get("adults") || "1"} required />
            </label>
            <label className="pub-field">
              <span>Kinder (bis 12 J.)</span>
              <input name="kids" inputMode="numeric" defaultValue={get("kids") || "0"} />
            </label>
            {showSeats && (
              <>
                <label className="pub-field">
                  <span>Babyschale (0–15 Mon.)</span>
                  <input name="seatBaby" inputMode="numeric" defaultValue={get("seatBaby") || "0"} />
                </label>
                <label className="pub-field">
                  <span>Kindersitz (1–4 J.)</span>
                  <input name="seatKind" inputMode="numeric" defaultValue={get("seatKind") || "0"} />
                </label>
                <label className="pub-field">
                  <span>Sitzerhöhung (4–12 J.)</span>
                  <input name="seatBoost" inputMode="numeric" defaultValue={get("seatBoost") || "0"} />
                </label>
              </>
            )}
          </div>

          <label className="pub-check">
            <input type="checkbox" name="oversize" defaultChecked={get("oversize") === "on"} />
            Übergroßes Fahrzeug (z. B. Van, länger als 5 m)
          </label>

          {brand.extras.length > 0 && (
            <div className="pub-grid">
              {brand.extras.map((e) => (
                <label key={e.id} className="pub-field">
                  <span>{e.name} ({formatEuro(e.priceCents)} €) – Anzahl</span>
                  <input name={`extra_${e.id}`} inputMode="numeric" defaultValue={get(`extra_${e.id}`) || "0"} />
                </label>
              ))}
            </div>
          )}

          <label className="pub-field">
            <span>Gutscheincode (optional)</span>
            <input name="couponCode" autoComplete="off" defaultValue={get("couponCode")} maxLength={40} />
          </label>

          <button type="submit" className="pub-btn">Preis berechnen</button>
        </form>
      )}

      {quote.state === "error" && (
        <div className="pub-error" role="alert">⚠ {quote.error}</div>
      )}

      {quote.state === "ok" && (
        <section className="pub-card" aria-live="polite">
          <h2>Ihr Preis · {quote.rateName}</h2>
          <table className="pub-lines">
            <tbody>
              {quote.result.lines.map((l, i) => (
                <tr key={i}>
                  <td>
                    {l.label}
                    {l.quantity > 1 && <span className="pub-muted"> × {l.quantity}</span>}
                  </td>
                  <td>{l.totalCents < 0 ? "−" : ""}{formatEuro(Math.abs(l.totalCents))} €</td>
                </tr>
              ))}
              <tr className="pub-total">
                <td>Gesamtpreis (inkl. MwSt.)</td>
                <td>{formatEuro(quote.result.totalCents)} €</td>
              </tr>
            </tbody>
          </table>
          <a
            className="pub-btn"
            href={`/book/${brand.slug}/checkout?${quoteQueryString(get, brand.extras.map((e) => e.id))}`}
          >
            Weiter zur Buchung
          </a>
        </section>
      )}

      <LegalFooter brand={brand} />
    </main>
  );
}
