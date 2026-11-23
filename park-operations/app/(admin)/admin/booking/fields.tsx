import type { ReactNode } from "react";
import { Check, Field, grid, inputStyle } from "../rates/ui";
import { formatEuro } from "@/lib/rates/form";

// Booking form fields, shared by "new" and (next step) "edit". Server component, no client JS.
// `v` = default values by field name (empty for a new booking).

function Area(props: { label: string; name: string; value?: string; hint?: string }) {
  return (
    <label style={{ display: "grid", gap: 4 }}>
      <span>{props.label}</span>
      <textarea name={props.name} defaultValue={props.value} rows={3} maxLength={1000} style={inputStyle} />
      {props.hint && <span className="muted" style={{ fontSize: 12 }}>{props.hint}</span>}
    </label>
  );
}

function DateTime(props: { label: string; name: string; value?: string }) {
  return (
    <label style={{ display: "grid", gap: 4 }}>
      <span>{props.label}</span>
      <input type="datetime-local" name={props.name} defaultValue={props.value} required step={60} style={inputStyle} />
    </label>
  );
}

function Select(props: { label: string; name: string; value?: string; options: [string, string][] }) {
  return (
    <label style={{ display: "grid", gap: 4 }}>
      <span>{props.label}</span>
      <select name={props.name} defaultValue={props.value ?? props.options[0][0]} style={inputStyle}>
        {props.options.map(([value, label]) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </select>
    </label>
  );
}

const Group = ({ title, children }: { title: string; children: ReactNode }) => (
  <div style={{ display: "grid", gap: 12 }}>
    <b>{title}</b>
    {children}
  </div>
);

export function BookingFields(props: {
  seatsEnabled: boolean;
  extras: { id: string; name: string; priceCents: number }[];
  v?: Record<string, string>;
}) {
  const v = props.v ?? {};
  return (
    <>
      <Group title="Kunde">
        <div style={grid}>
          <Field text label="Vorname" name="firstName" defaultValue={v.firstName} required />
          <Field text label="Nachname" name="lastName" defaultValue={v.lastName} required />
          <Field text label="E-Mail" name="email" defaultValue={v.email} required />
          <Field text label="Telefon" name="phone" defaultValue={v.phone} />
          <Field text label="Firma (optional)" name="company" defaultValue={v.company} />
        </div>
      </Group>

      <Group title="Reise">
        <div style={grid}>
          <DateTime label="Anreise (Parkplatz)" name="arrivalAt" value={v.arrivalAt} />
          <DateTime label="Abreise (Abholung)" name="departureAt" value={v.departureAt} />
          <Field text label="Hinflug" name="outboundFlight" defaultValue={v.outboundFlight} hint="z. B. EW9421" />
          <Field text label="Rückflug" name="returnFlight" defaultValue={v.returnFlight} />
        </div>
      </Group>

      <Group title="Fahrzeug">
        <div style={grid}>
          <Field text label="Kennzeichen" name="plate" defaultValue={v.plate} required />
          <Field text label="Fahrzeug (Marke/Modell)" name="vehicle" defaultValue={v.vehicle} />
        </div>
        <Check label="Übergroßes Fahrzeug (Van, > 5 m)" name="oversize" checked={v.oversize === "on"} />
      </Group>

      <Group title="Personen">
        <div style={grid}>
          <Field label="Erwachsene" name="adults" defaultValue={v.adults ?? "1"} required />
          <Field label="Kinder (bis 12 J.)" name="kids" defaultValue={v.kids ?? "0"} />
          {props.seatsEnabled && (
            <>
              <Field label="Babyschale (0–15 Mon.)" name="seatBaby" defaultValue={v.seatBaby ?? "0"} />
              <Field label="Kindersitz (1–4 J.)" name="seatKind" defaultValue={v.seatKind ?? "0"} />
              <Field label="Sitzerhöhung (4–12 J.)" name="seatBoost" defaultValue={v.seatBoost ?? "0"} />
            </>
          )}
        </div>
      </Group>

      {props.extras.length > 0 && (
        <Group title="Extras">
          <div style={grid}>
            {props.extras.map((e) => (
              <Field
                key={e.id}
                label={`${e.name} (${formatEuro(e.priceCents)} €) – Menge`}
                name={`extra_${e.id}`}
                defaultValue={v[`extra_${e.id}`] ?? "0"}
              />
            ))}
          </div>
        </Group>
      )}

      <Group title="Preis, Zahlung & Quelle">
        <div style={grid}>
          <Field text label="Gutscheincode" name="couponCode" defaultValue={v.couponCode} />
          <Field label="Manueller Preis (€, optional)" name="manualPrice" defaultValue={v.manualPrice} hint="Leer = berechneter Preis" />
          <Select label="Status" name="status" value={v.status} options={[["confirmed", "Bestätigt"], ["unconfirmed", "Unbestätigt"]]} />
          <Select
            label="Zahlart"
            name="paymentMethod"
            value={v.paymentMethod ?? ""}
            options={[["", "— noch offen —"], ["CASH", "Bar"], ["EC", "EC-Karte"], ["PARTNER", "Partner"]]}
          />
          <Select
            label="Quelle"
            name="source"
            value={v.source}
            options={[["PHONE", "Telefon / WhatsApp"], ["PARTNER_PORTAL", "Partner-Portal"], ["XPARK", "X-Park"]]}
          />
          <Field text label="Externe Buchungsnr. (Portal)" name="externalRef" defaultValue={v.externalRef} />
          <Field label="Provision (€, nur Auswertung)" name="commission" defaultValue={v.commission} />
        </div>
        <Check label="Bereits bezahlt" name="paid" checked={v.paid === "on"} />
      </Group>

      <Group title="Notizen">
        <Area label="Kundenhinweis (vom Kunden)" name="customerNote" value={v.customerNote} hint="z. B. Kinderwagen, Skier, Hundebox" />
        <Area label="Interne Notiz (nie für den Kunden sichtbar)" name="internalNote" value={v.internalNote} />
      </Group>

      <details>
        <summary style={{ cursor: "pointer", minHeight: 44, display: "flex", alignItems: "center" }}>
          <b>Rechnungsdaten (Firmenkunden)</b>
        </summary>
        <div style={{ ...grid, paddingTop: 8 }}>
          <Field text label="Firma" name="billingCompany" defaultValue={v.billingCompany} />
          <Field text label="z. Hd." name="billingContact" defaultValue={v.billingContact} />
          <Field text label="Adresse" name="billingAddress" defaultValue={v.billingAddress} />
          <Field text label="USt-IdNr." name="billingVatId" defaultValue={v.billingVatId} />
        </div>
      </details>
    </>
  );
}
