import Link from "next/link";
import {
  createExtraAction,
  createRateAction,
  saveExtraAction,
  updateBrandSettingsAction, updateBrandLinksAction, updateBrandPaymentSenderAction } from "@/app/actions/rates";
import { db } from "@/lib/db";
import { formatEuro } from "@/lib/rates/form";
import { requireRole } from "@/lib/session";
import { Check, Field, LOT_LABEL, Message, SERVICE_LABEL, grid, inputStyle } from "./ui";

// Tarife & Preise (admin only): brand settings, rates with their price tables, extras.
export default async function RatesPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  await requireRole("admin");
  const sp = await searchParams;
  const accounts = await db.paymentAccount.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, active: true } });

  const brands = await db.brand.findMany({
    orderBy: { name: "asc" },
    include: {
      locations: { orderBy: { name: "asc" } },
      rates: {
        orderBy: [{ sort: "asc" }, { name: "asc" }],
        include: { location: true, priceTables: { where: { seasonId: null } } },
      },
      extras: { orderBy: { name: "asc" } },
    },
  });

  return (
    <div className="page">
      <div>
        <h1 style={{ margin: 0 }}>Tarife &amp; Preise</h1>
        <p className="muted" style={{ margin: "4px 0 0" }}>
          Alle Preise und Regeln gelten pro Marke bzw. Tarif. Preise in Euro, z. B. 12,50.
        </p>
      </div>

      <Message saved={sp.saved} error={sp.error} />

      {brands.map((b) => (
        <section key={b.id} className="card pad" style={{ display: "grid", gap: 16 }}>
          <h2 style={{ margin: 0 }}>{b.name}</h2>

          {/* Tarife */}
          <div style={{ display: "grid", gap: 8 }}>
            <b>Tarife</b>
            {b.rates.length === 0 && <span className="muted">Noch kein Tarif.</span>}
            {b.rates.map((r) => {
              const t = r.priceTables[0];
              return (
                <Link
                  key={r.id}
                  href={`/admin/rates/${r.id}`}
                  style={{ display: "grid", gap: 2, padding: "10px 0", borderTop: "1px solid rgba(128,128,128,.25)", opacity: r.active ? 1 : 0.65 }}
                >
                  <span>
                    <b>{r.name}</b> · {SERVICE_LABEL[r.service]} · {LOT_LABEL[r.lotType]}
                    {r.active ? "" : " · inaktiv"}
                  </span>
                  <span className="muted">
                    {t
                      ? `1 Tag ${formatEuro(t.dayPriceCents[0])} € · 7 Tage ${formatEuro(t.dayPriceCents[6])} € · 30 Tage ${formatEuro(t.dayPriceCents[29])} €`
                      : "⚠ Noch keine Preise"}
                    {" · Bearbeiten →"}
                  </span>
                </Link>
              );
            })}

            <details>
              <summary style={{ cursor: "pointer", minHeight: 44, display: "flex", alignItems: "center" }}>+ Neuen Tarif anlegen</summary>
              <form action={createRateAction} style={{ display: "grid", gap: 12, paddingTop: 8 }}>
                <input type="hidden" name="brandId" value={b.id} />
                <div style={grid}>
                  <Field text label="Name" name="name" required />
                  <label style={{ display: "grid", gap: 4 }}>
                    <span>Standort</span>
                    <select name="locationId" style={inputStyle} required>
                      {b.locations.map((l) => (
                        <option key={l.id} value={l.id}>{l.name} ({LOT_LABEL[l.type]})</option>
                      ))}
                    </select>
                  </label>
                  <label style={{ display: "grid", gap: 4 }}>
                    <span>Service</span>
                    <select name="service" style={inputStyle}>
                      <option value="SHUTTLE">Shuttle</option>
                      <option value="VALET">Valet</option>
                    </select>
                  </label>
                </div>
                <span className="muted" style={{ fontSize: 12 }}>Neue Tarife sind inaktiv, bis Preise gespeichert und der Tarif aktiviert wurde.</span>
                <button className="btn" type="submit">Tarif anlegen</button>
              </form>
            </details>
          </div>

          {/* Marken-Einstellungen */}
          <details>
            <summary style={{ cursor: "pointer", minHeight: 44, display: "flex", alignItems: "center" }}><b>Regeln &amp; Zuschläge der Marke</b></summary>
            <form action={updateBrandSettingsAction} style={{ display: "grid", gap: 12, paddingTop: 8 }}>
              <input type="hidden" name="id" value={b.id} />
              <div style={grid}>
                <Field label="Inklusive Personen" name="personsIncluded" defaultValue={b.personsIncluded} />
                <Field label="Preis je weitere Person (€)" name="extraPersonPrice" defaultValue={formatEuro(b.extraPersonPriceCents)} />
                <Field label="Preis je Kindersitz (€)" name="seatPrice" defaultValue={formatEuro(b.seatPriceCents)} />
                <Field label="Aufschlag Übergröße (%)" name="oversizeSurchargePct" defaultValue={b.oversizeSurchargePct} hint="auf den Parkpreis" />
                <Field label="Mindestvorlauf (Std.)" name="minLeadHours" defaultValue={b.minLeadHours} />
                <Field label="Kostenlos stornieren bis (Std. vor Anreise)" name="freeCancelHours" defaultValue={b.freeCancelHours} />
                <Field label="Überziehung Parkhaus (€/Tag)" name="overstayFeeGarage" defaultValue={formatEuro(b.overstayFeeGarageCents)} />
                <Field label="Überziehung Außenparkplatz (€/Tag)" name="overstayFeeOutdoor" defaultValue={formatEuro(b.overstayFeeOutdoorCents)} />
                <Field label="Stammkunden-Rabatt (%)" name="returningDiscountPct" defaultValue={b.returningDiscountPct} />
              </div>
              <Check label="Kinder zählen als Personen" name="kidsCountAsPerson" checked={b.kidsCountAsPerson} />
              <Check label="Kindersitze anbieten" name="seatsEnabled" checked={b.seatsEnabled} />
              <button className="btn" type="submit">Speichern</button>
            </form>
          </details>

          {/* Rechtliche Links & Online-Buchung */}
          <details>
            <summary style={{ cursor: "pointer", minHeight: 44, display: "flex", alignItems: "center" }}><b>Rechtliche Links &amp; Online-Buchung</b></summary>
            <form action={updateBrandLinksAction} style={{ display: "grid", gap: 12, paddingTop: 8 }}>
              <input type="hidden" name="id" value={b.id} />
              <div style={grid}>
                <Field text label="Impressum (URL)" name="impressumUrl" defaultValue={b.impressumUrl ?? ""} hint="https://… (WordPress-Seite der Marke)" />
                <Field text label="Datenschutz (URL)" name="privacyUrl" defaultValue={b.privacyUrl ?? ""} hint="https://…" />
                <Field text label="AGB (URL)" name="termsUrl" defaultValue={b.termsUrl ?? ""} hint="https://…" />
                <Field label="Unbezahlte Online-Buchung stornieren nach (Min.)" name="unpaidHoldMinutes" defaultValue={b.unpaidHoldMinutes} hint="Standard 30" />
              </div>
              <button className="btn" type="submit">Speichern</button>
            </form>
          </details>

          {/* Zahlung & Absender */}
          <details>
            <summary style={{ cursor: "pointer", minHeight: 44, display: "flex", alignItems: "center" }}><b>Zahlung &amp; Absender</b></summary>
            <form action={updateBrandPaymentSenderAction} style={{ display: "grid", gap: 12, paddingTop: 8 }}>
              <input type="hidden" name="id" value={b.id} />
              <div style={grid}>
                <label style={{ display: "grid", gap: 4 }}>
                  <span>Zahlungskonto (Stripe)</span>
                  <select name="paymentAccountId" defaultValue={b.paymentAccountId ?? ""} style={inputStyle}>
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
              <p className="muted" style={{ margin: 0 }}>
                Zahlungskonten und ihre Schlüssel-Variablen: <Link href="/admin/payment-accounts">Zahlungskonten</Link>.
              </p>
              <button className="btn" type="submit">Speichern</button>
            </form>
          </details>

          {/* Extras */}
          <details>
            <summary style={{ cursor: "pointer", minHeight: 44, display: "flex", alignItems: "center" }}><b>Extras ({b.extras.length})</b></summary>
            <div style={{ display: "grid", gap: 12, paddingTop: 8 }}>
              {b.extras.map((e) => (
                <form key={e.id} action={saveExtraAction} style={{ display: "grid", gap: 8, opacity: e.active ? 1 : 0.65 }}>
                  <input type="hidden" name="id" value={e.id} />
                  <div style={grid}>
                    <Field text label="Name" name="name" defaultValue={e.name} />
                    <Field label="Preis (€)" name="price" defaultValue={formatEuro(e.priceCents)} />
                  </div>
                  <Check label="Aktiv" name="active" checked={e.active} />
                  <button className="btn" type="submit">Speichern</button>
                </form>
              ))}
              <form action={createExtraAction} style={{ display: "grid", gap: 8, borderTop: "1px solid rgba(128,128,128,.25)", paddingTop: 12 }}>
                <input type="hidden" name="brandId" value={b.id} />
                <b>Neues Extra</b>
                <div style={grid}>
                  <Field text label="Name" name="name" required />
                  <Field label="Preis (€)" name="price" required />
                </div>
                <button className="btn" type="submit">Extra anlegen</button>
              </form>
            </div>
          </details>
        </section>
      ))}
    </div>
  );
}
