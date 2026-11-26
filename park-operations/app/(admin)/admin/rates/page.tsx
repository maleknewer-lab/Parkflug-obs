import Link from "next/link";
import {
  createExtraAction,
  createRateAction,
  savePriceTableAction,
  saveExtraAction,
  updateBrandLinksAction,
  updateBrandPaymentSenderAction,
  updateBrandSettingsAction,
} from "@/app/actions/rates";
import { db } from "@/lib/db";
import { formatEuro } from "@/lib/rates/form";
import { requireRole } from "@/lib/session";
import { Check, Field, LOT_LABEL, Message, SERVICE_LABEL } from "./ui";

// Tarife & Preise (admin only), laid out like the approved prototype:
// header → brand switch → Personen & Kindersitze / Regeln → one card per rate with its price grid → extras → links, payment.
// Seasons and occupancy pricing come in Phase 7. Every form sends `returnBrand` so saving stays on the same brand.
export default async function RatesPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string; brand?: string }>;
}) {
  await requireRole("admin");
  const sp = await searchParams;

  const [brands, accounts] = await Promise.all([
    db.brand.findMany({
      orderBy: { name: "asc" },
      include: {
        locations: { orderBy: { name: "asc" } },
        rates: {
          orderBy: [{ sort: "asc" }, { name: "asc" }],
          include: { location: true, priceTables: { where: { seasonId: null } } },
        },
        extras: { orderBy: { name: "asc" } },
        paymentAccount: { select: { name: true } },
      },
    }),
    db.paymentAccount.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, active: true } }),
  ]);

  const b = brands.find((x) => x.id === sp.brand) ?? brands[0];

  const head = (
    <div className="rt-ph">
      <h1>Tarife &amp; Preise</h1>
      <p>Grundpreis gilt das ganze Jahr. Alle Preise in Euro, z. B. 12,50. Saisonpreise und Preisautomatik folgen in Phase 7.</p>
    </div>
  );
  if (!b) {
    return (
      <div className="page">
        {head}
        <div className="card pad">Noch keine Marke angelegt.</div>
      </div>
    );
  }

  // Example line like in the prototype: 2 adults + 2 children + 1 seat
  const persons = 2 + (b.kidsCountAsPerson ? 2 : 0);
  const exampleCents =
    Math.max(0, persons - b.personsIncluded) * b.extraPersonPriceCents + (b.seatsEnabled ? b.seatPriceCents : 0);
  const hidden = <input type="hidden" name="returnBrand" value={b.id} />;
  const activeRates = b.rates.filter((r) => r.active).length;

  return (
    <div className="page">
      {head}
      <Message saved={sp.saved} error={sp.error} />

      {brands.length > 1 && (
        <nav className="rt-seg" aria-label="Marke wählen">
          {brands.map((x) => (
            <Link key={x.id} href={`/admin/rates?brand=${x.id}`} className={x.id === b.id ? "on" : ""}>
              {x.name}
            </Link>
          ))}
        </nav>
      )}

      {/* Marke: Status */}
      <section className="card pad rt-stack">
        <div className="rt-sec-t">
          <span className="big">{b.name}</span>
          <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <span className={`rt-chip ${b.active ? "ok" : "warn"}`}>{b.active ? "aktiv" : "inaktiv"}</span>
            <span className={`rt-chip ${activeRates > 0 ? "ok" : "warn"}`}>{activeRates} aktive Tarife</span>
            <span className="rt-chip">{b.paymentAccount ? `Zahlung: ${b.paymentAccount.name}` : "nur Barzahlung"}</span>
          </span>
        </div>
        <div className="rt-meta">
          Buchungsseite: <Link href={`/book/${b.slug}`}>/book/{b.slug}</Link>
          {b.active ? "" : " · Marke ist inaktiv, die Seite ist nicht erreichbar"}
        </div>
      </section>

      {/* Personen, Kindersitze & Regeln */}
      <form action={updateBrandSettingsAction} className="card pad rt-stack">
        <input type="hidden" name="id" value={b.id} />
        {hidden}
        <div className="rt-sec-t">Personen &amp; Kindersitze</div>
        <div className="rt-kgrid">
          <Check label="Kindersitze anbieten" name="seatsEnabled" checked={b.seatsEnabled} />
          <Check label="Kinder zählen als Person" name="kidsCountAsPerson" checked={b.kidsCountAsPerson} />
          <Field label="Personen inklusive" name="personsIncluded" defaultValue={b.personsIncluded} />
          <Field label="Preis je weitere Person (€)" name="extraPersonPrice" defaultValue={formatEuro(b.extraPersonPriceCents)} />
          <Field label="Preis je Kindersitz (€, 0 = kostenlos)" name="seatPrice" defaultValue={formatEuro(b.seatPriceCents)} />
        </div>
        <div className="rt-meta">
          Beispiel: 2 Erwachsene + 2 Kinder + 1 Kindersitz = {formatEuro(exampleCents)} € Aufpreis. Sitzarten: Babyschale (0–15 Monate), Kindersitz (1–4 Jahre), Sitzerhöhung (4–12 Jahre).
        </div>

        <div className="rt-sec-t" style={{ marginTop: 6 }}>Regeln &amp; Zuschläge</div>
        <div className="rt-kgrid">
          <Field label="Aufschlag Übergröße (%)" name="oversizeSurchargePct" defaultValue={b.oversizeSurchargePct} hint="auf den Parkpreis" />
          <Field label="Mindestvorlauf Online-Buchung (Std.)" name="minLeadHours" defaultValue={b.minLeadHours} />
          <Field label="Kostenlos stornieren bis (Std. vor Anreise)" name="freeCancelHours" defaultValue={b.freeCancelHours} />
          <Field label="Überziehung Parkhaus (€/Tag)" name="overstayFeeGarage" defaultValue={formatEuro(b.overstayFeeGarageCents)} />
          <Field label="Überziehung Außenparkplatz (€/Tag)" name="overstayFeeOutdoor" defaultValue={formatEuro(b.overstayFeeOutdoorCents)} />
          <Field label="Stammkunden-Rabatt (%)" name="returningDiscountPct" defaultValue={b.returningDiscountPct} />
        </div>
        <div><button className="btn" type="submit">Speichern</button></div>
      </form>

      {/* Tarife: eine Karte je Tarif mit Preisgitter */}
      {b.rates.length === 0 && <div className="card pad rt-meta">Noch kein Tarif für diese Marke.</div>}
      {b.rates.map((r) => {
        const t = r.priceTables[0];
        return (
          <form key={r.id} action={savePriceTableAction} className="card pad rt-stack" style={{ opacity: r.active ? 1 : 0.8 }}>
            <input type="hidden" name="id" value={r.id} />
            <input type="hidden" name="from" value="list" />
            {hidden}
            <div className="rt-sec-t" style={{ marginBottom: 0 }}>
              <div>
                <div className="big">{r.name}</div>
                <div className="rt-meta">
                  {SERVICE_LABEL[r.service]} · {LOT_LABEL[r.lotType]} · {r.location.name}
                </div>
              </div>
              <span style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <span className={`rt-chip ${r.active ? "ok" : "warn"}`}>{r.active ? "aktiv" : "inaktiv"}</span>
                <Link className="btn soft sm" href={`/admin/rates/${r.id}`}>Einstellungen</Link>
              </span>
            </div>
            <div className="rt-meta">Grundpreis: gilt immer, wenn keine Saison zutrifft. Preis für die gesamte Dauer, Anreise- und Abreisetag zählen mit.</div>
            {!t && <div className="rt-banner">Noch keine Preise: alle 30 Felder ausfüllen, danach kann der Tarif aktiviert werden.</div>}
            <div className="rt-ptable">
              {Array.from({ length: 30 }, (_, i) => (
                <label key={i}>
                  {i + 1} {i === 0 ? "Tag" : "Tage"}
                  <input name={`d${i + 1}`} inputMode="decimal" autoComplete="off" defaultValue={t ? formatEuro(t.dayPriceCents[i]) : ""} />
                </label>
              ))}
              <label>
                Jeder weitere
                <input name="extra" inputMode="decimal" autoComplete="off" defaultValue={t ? formatEuro(t.extraDayCents) : ""} />
              </label>
            </div>
            <div><button className="btn" type="submit">Preise speichern</button></div>
          </form>
        );
      })}

      {/* Neuer Tarif */}
      <section className="card pad">
        <details>
          <summary className="rt-sec-t" style={{ cursor: "pointer", marginBottom: 0 }}>+ Neuen Tarif anlegen</summary>
          <form action={createRateAction} className="rt-stack" style={{ paddingTop: 12 }}>
            <input type="hidden" name="brandId" value={b.id} />
            {hidden}
            <div className="rt-kgrid">
              <Field text label="Name" name="name" required />
              <label className="rt-field">
                <span>Standort</span>
                <select className="rt-inp" name="locationId" required>
                  {b.locations.map((l) => (
                    <option key={l.id} value={l.id}>{l.name} ({LOT_LABEL[l.type]})</option>
                  ))}
                </select>
              </label>
              <label className="rt-field">
                <span>Service</span>
                <select className="rt-inp" name="service">
                  <option value="SHUTTLE">Shuttle</option>
                  <option value="VALET">Valet</option>
                </select>
              </label>
            </div>
            <div className="rt-meta">Neue Tarife sind inaktiv, bis Preise gespeichert und der Tarif aktiviert wurde.</div>
            <div><button className="btn" type="submit">Tarif anlegen</button></div>
          </form>
        </details>
      </section>

      {/* Extras */}
      <section className="card pad rt-stack">
        <div className="rt-sec-t">Extras ({b.extras.length})</div>
        <div className="rt-rows">
          {b.extras.map((e) => (
            <form key={e.id} action={saveExtraAction} className="rt-row" style={{ opacity: e.active ? 1 : 0.7 }}>
              <input type="hidden" name="id" value={e.id} />
              {hidden}
              <input className="rt-inp" name="name" defaultValue={e.name} aria-label="Name" />
              <input className="rt-inp rt-mono" name="price" inputMode="decimal" defaultValue={formatEuro(e.priceCents)} aria-label="Preis in Euro" />
              <label className="rt-check"><input type="checkbox" name="active" defaultChecked={e.active} /><span>aktiv</span></label>
              <button className="btn soft sm" type="submit">Speichern</button>
            </form>
          ))}
        </div>
        <form action={createExtraAction} className="rt-row" style={{ borderTop: "1px solid var(--line, #dfe3e8)", paddingTop: 12 }}>
          <input type="hidden" name="brandId" value={b.id} />
          {hidden}
          <input className="rt-inp" name="name" placeholder="Neues Extra, z. B. Autowäsche" required aria-label="Name" />
          <input className="rt-inp rt-mono" name="price" inputMode="decimal" placeholder="Preis €" required aria-label="Preis in Euro" />
          <span />
          <button className="btn soft sm" type="submit">+ Extra anlegen</button>
        </form>
      </section>

      {/* Rechtliche Links & Online-Buchung */}
      <form action={updateBrandLinksAction} className="card pad rt-stack">
        <input type="hidden" name="id" value={b.id} />
        {hidden}
        <div className="rt-sec-t">Rechtliche Links &amp; Online-Buchung</div>
        <div className="rt-kgrid">
          <Field text label="Impressum (URL)" name="impressumUrl" defaultValue={b.impressumUrl ?? ""} hint="https://… (WordPress-Seite der Marke)" />
          <Field text label="Datenschutz (URL)" name="privacyUrl" defaultValue={b.privacyUrl ?? ""} hint="https://…" />
          <Field text label="AGB (URL)" name="termsUrl" defaultValue={b.termsUrl ?? ""} hint="https://…" />
          <Field label="Unbezahlte Online-Buchung stornieren nach (Min.)" name="unpaidHoldMinutes" defaultValue={b.unpaidHoldMinutes} hint="Standard 30" />
        </div>
        <div><button className="btn" type="submit">Speichern</button></div>
      </form>

      {/* Zahlung & Absender */}
      <form action={updateBrandPaymentSenderAction} className="card pad rt-stack">
        <input type="hidden" name="id" value={b.id} />
        {hidden}
        <div className="rt-sec-t">Zahlung &amp; Absender</div>
        <div className="rt-kgrid">
          <label className="rt-field">
            <span>Zahlungskonto (Stripe)</span>
            <select className="rt-inp" name="paymentAccountId" defaultValue={b.paymentAccountId ?? ""}>
              <option value="">– keine Online-Zahlung –</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}{a.active ? "" : " (inaktiv)"}</option>
              ))}
            </select>
          </label>
          <Field text label="Text auf dem Kontoauszug" name="statementDescriptor" defaultValue={b.statementDescriptor ?? ""} hint="z. B. PARKFLUG (max. 12 Zeichen)" />
          <Field text label="E-Mail: Absendername" name="emailFromName" defaultValue={b.emailFromName ?? ""} hint="z. B. ParkFlug" />
          <Field text label="E-Mail: Absenderadresse" name="emailFromAddress" defaultValue={b.emailFromAddress ?? ""} hint="buchung@…" />
          <Field text label="E-Mail: Antwort an" name="emailReplyTo" defaultValue={b.emailReplyTo ?? ""} hint="optional" />
          <Field text label="SMS-Absendername" name="smsSenderName" defaultValue={b.smsSenderName ?? ""} hint="3–11 Zeichen, z. B. ParkFlug" />
        </div>
        <div className="rt-meta">
          Zahlungskonten und ihre Schlüssel-Variablen: <Link href="/admin/payment-accounts">Zahlungskonten</Link>
        </div>
        <div><button className="btn" type="submit">Speichern</button></div>
      </form>
    </div>
  );
}
