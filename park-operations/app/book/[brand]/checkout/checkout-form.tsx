"use client";

import { useActionState, useState } from "react";
import { createPublicBookingAction, type CheckoutState } from "@/app/actions/public-booking";

// Step 2: customer data. Errors come back WITHOUT a page reload and the typed values are kept
// (React 19 resets forms after an action, so the values are given back and used as defaults).
export function CheckoutForm({
  brandSlug,
  checkoutKey,
  carried,
  onlineAvailable,
}: {
  brandSlug: string;
  checkoutKey: string;
  carried: [string, string][]; // non-personal trip data from the price page
  onlineAvailable: boolean; // the brand has an active payment account with all keys configured
}) {
  const [payment, setPayment] = useState<"ONLINE" | "CASH">(onlineAvailable ? "ONLINE" : "CASH");
  const [state, action, pending] = useActionState<CheckoutState, FormData>(createPublicBookingAction, {});
  const v = (name: string) => state.values?.[name] ?? "";

  return (
    <form action={action} className="pub-card" style={{ gap: 20 }}>
      <input type="hidden" name="brandSlug" value={brandSlug} />
      <input type="hidden" name="checkoutKey" value={checkoutKey} />
      {carried.map(([k, val]) => (
        <input key={k} type="hidden" name={k} value={val} />
      ))}

      <h2>Ihre Daten</h2>
      <div className="pub-grid">
        <label className="pub-field">
          <span>Vorname *</span>
          <input name="firstName" autoComplete="given-name" defaultValue={v("firstName")} required maxLength={60} />
        </label>
        <label className="pub-field">
          <span>Nachname *</span>
          <input name="lastName" autoComplete="family-name" defaultValue={v("lastName")} required maxLength={60} />
        </label>
        <label className="pub-field">
          <span>E-Mail *</span>
          <input name="email" type="email" autoComplete="email" defaultValue={v("email")} required maxLength={120} />
        </label>
        <label className="pub-field">
          <span>Mobiltelefon *</span>
          <input name="phone" type="tel" autoComplete="tel" defaultValue={v("phone")} required maxLength={40} />
        </label>
      </div>

      <h2>Fahrzeug &amp; Flüge</h2>
      <div className="pub-grid">
        <label className="pub-field">
          <span>Kennzeichen *</span>
          <input name="plate" autoCapitalize="characters" defaultValue={v("plate")} required maxLength={15} />
        </label>
        <label className="pub-field">
          <span>Fahrzeug (Marke/Modell)</span>
          <input name="vehicle" defaultValue={v("vehicle")} maxLength={60} />
        </label>
        <label className="pub-field">
          <span>Hinflug (optional)</span>
          <input name="outboundFlight" autoCapitalize="characters" placeholder="z. B. EW9421" defaultValue={v("outboundFlight")} maxLength={12} />
        </label>
        <label className="pub-field">
          <span>Rückflug (optional)</span>
          <input name="returnFlight" autoCapitalize="characters" placeholder="z. B. EW9422" defaultValue={v("returnFlight")} maxLength={12} />
        </label>
      </div>

      <label className="pub-field">
        <span>Hinweis an uns (optional)</span>
        <textarea name="customerNote" defaultValue={v("customerNote")} maxLength={1000} placeholder="z. B. Kinderwagen, sperriges Gepäck, Skier, Golfbag, Rollstuhl, Hundebox" />
      </label>

      <details>
        <summary style={{ cursor: "pointer", minHeight: 44, display: "flex", alignItems: "center" }}>
          Rechnung auf eine Firma (optional)
        </summary>
        <div className="pub-grid" style={{ paddingTop: 8 }}>
          <label className="pub-field">
            <span>Firma</span>
            <input name="billingCompany" defaultValue={v("billingCompany")} maxLength={100} />
          </label>
          <label className="pub-field">
            <span>z. Hd.</span>
            <input name="billingContact" defaultValue={v("billingContact")} maxLength={100} />
          </label>
          <label className="pub-field">
            <span>Rechnungsadresse</span>
            <input name="billingAddress" defaultValue={v("billingAddress")} maxLength={300} />
          </label>
          <label className="pub-field">
            <span>USt-IdNr.</span>
            <input name="billingVatId" placeholder="DE123456789" defaultValue={v("billingVatId")} maxLength={20} />
          </label>
        </div>
      </details>

      <fieldset className="pub-fieldset">
        <legend>Zahlung</legend>
        {onlineAvailable && (
          <label className="pub-rate">
            <input type="radio" name="payment" value="ONLINE" checked={payment === "ONLINE"} onChange={() => setPayment("ONLINE")} />
            <span>
              Online bezahlen
              <small>Sicher per Karte oder weiteren Zahlarten. Die Buchung gilt nach erfolgreicher Zahlung.</small>
            </span>
          </label>
        )}
        <label className="pub-rate">
          <input type="radio" name="payment" value="CASH" checked={payment === "CASH"} onChange={() => setPayment("CASH")} />
          <span>
            Barzahlung vor Ort
            <small>Sie zahlen bei Ankunft am Parkplatz.</small>
          </span>
        </label>
      </fieldset>

      {state.error && <div className="pub-error" role="alert">⚠ {state.error}</div>}

      <button type="submit" className="pub-btn" disabled={pending}>
        {pending ? "Bitte warten …" : payment === "ONLINE" ? "Weiter zur Zahlung" : "Verbindlich buchen"}
      </button>
    </form>
  );
}
