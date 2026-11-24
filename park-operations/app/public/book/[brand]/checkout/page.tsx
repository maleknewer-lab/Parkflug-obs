import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadPublicBrand, quoteForBrand } from "@/lib/booking/public-quote";
import { quoteQueryString } from "@/lib/booking/quote";
import { formatBerlin } from "@/lib/pricing";
import { formatEuro } from "@/lib/rates/form";
import { LegalFooter } from "../../../_components/legal-footer";
import { CheckoutForm } from "./checkout-form";

// Public booking, step 2 of 2: re-checks the trip data and price on the server, then asks for the
// customer's data. Trip data arrives in the URL (no personal data); customer data is sent by POST.

export const metadata: Metadata = { title: "Buchung abschließen" };
export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function CheckoutPage({
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
  const extraIds = brand.extras.map((e) => e.id);
  const qs = quoteQueryString(get, extraIds);
  const quote = await quoteForBrand(brand, get, new Date());
  const backHref = `/book/${brand.slug}${qs ? `?${qs}` : ""}`;

  if (quote.state !== "ok") {
    return (
      <main className="pub-wrap">
        <header className="pub-head"><h1>{brand.name}</h1></header>
        <div className="pub-error" role="alert">
          ⚠ {quote.state === "error" ? quote.error : "Bitte zuerst Reisedaten angeben und den Preis berechnen."}
        </div>
        <a className="pub-btn" href={backHref}>Zurück zur Preisberechnung</a>
        <LegalFooter brand={brand} />
      </main>
    );
  }

  const { data, result } = quote;
  const carried = [...new URLSearchParams(qs).entries()] as [string, string][];

  return (
    <main className="pub-wrap">
      <header className="pub-head"><h1>{brand.name}</h1></header>

      <section className="pub-card">
        <h2>Ihre Buchung · {quote.rateName}</h2>
        <div className="pub-sum">
          <span>Anreise: {formatBerlin(data.arrivalAt)} Uhr</span>
          <span>Abreise: {formatBerlin(data.departureAt)} Uhr</span>
          <span className="pub-muted">
            {result.days} {result.days === 1 ? "Tag" : "Tage"} · {data.adults + data.kids} {data.adults + data.kids === 1 ? "Person" : "Personen"}
          </span>
        </div>
        <table className="pub-lines">
          <tbody>
            {result.lines.map((l, i) => (
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
              <td>{formatEuro(result.totalCents)} €</td>
            </tr>
          </tbody>
        </table>
        <a href={backHref} className="pub-muted">Reisedaten ändern</a>
      </section>

      <CheckoutForm brandSlug={brand.slug} checkoutKey={crypto.randomUUID()} carried={carried} />

      <LegalFooter brand={brand} />
    </main>
  );
}
