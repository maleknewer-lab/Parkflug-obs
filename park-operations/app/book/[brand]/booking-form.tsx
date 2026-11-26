"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createPublicBookingAction, type CheckoutState } from "@/app/actions/public-booking";
import { quotePublicAction, type PublicQuoteView } from "@/app/actions/public-quote";
import { formatEuro } from "@/lib/rates/form";

// Public booking form: one page with six steps and a live summary — the layout of the approved prototype.
// The price shown comes from the server (quotePublicAction); the final price is calculated again when the
// booking is created, so nothing the browser shows can change what is charged.

export type RateOpt = { id: string; name: string; service: "SHUTTLE" | "VALET"; lotType: "GARAGE" | "OUTDOOR" };
export type ExtraOpt = { id: string; name: string; priceCents: number };

const TIMES = Array.from({ length: 96 }, (_, i) => `${String(Math.floor(i / 4)).padStart(2, "0")}:${String((i % 4) * 15).padStart(2, "0")}`);
const SERVICE = { SHUTTLE: "Shuttle", VALET: "Valet" } as const;
const LOT = { GARAGE: "Parkhaus", OUTDOOR: "Außenparkplatz" } as const;
const QUICK = ["Kinderwagen", "Sperrgepäck", "Skiausrüstung", "Golftasche", "Rollstuhl", "Hund in Box"];

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

function RateIcon({ service }: { service: "SHUTTLE" | "VALET" }) {
  return service === "VALET" ? (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 17h14M6 17l1.5-6h9L18 17M8 17v2M16 17v2M9 11l1-3h4l1 3" />
    </svg>
  ) : (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="12" rx="2" /><path d="M3 11h18M7 17v2M17 17v2" /><circle cx="7.5" cy="14" r=".6" /><circle cx="16.5" cy="14" r=".6" />
    </svg>
  );
}

export function BookingForm(props: {
  brandSlug: string;
  rates: RateOpt[];
  extras: ExtraOpt[];
  showSeats: boolean;
  freeCancelHours: number;
  onlineAvailable: boolean;
  onlineHint: string | null; // only given to logged-in staff
  checkoutKey: string;
  termsUrl: string | null;
  privacyUrl: string | null;
  defaults: { arrDate: string; depDate: string; arrTime: string; depTime: string };
}) {
  const { brandSlug, rates, extras, showSeats } = props;
  const [state, action, pending] = useActionState<CheckoutState, FormData>(createPublicBookingAction, {});
  const v = (name: string) => state.values?.[name] ?? "";

  // Trip data (drives the live price)
  const [rateId, setRateId] = useState(rates[0]?.id ?? "");
  const [arrDate, setArrDate] = useState(props.defaults.arrDate);
  const [arrTime, setArrTime] = useState(props.defaults.arrTime);
  const [depDate, setDepDate] = useState(props.defaults.depDate);
  const [depTime, setDepTime] = useState(props.defaults.depTime);
  const [adults, setAdults] = useState("2");
  const [kids, setKids] = useState("0");
  const [seatBaby, setSeatBaby] = useState("0");
  const [seatKind, setSeatKind] = useState("0");
  const [seatBoost, setSeatBoost] = useState("0");
  const [oversize, setOversize] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [coupon, setCoupon] = useState("");

  // Choices that must survive a reset of the form after an error
  const [payment, setPayment] = useState<"ONLINE" | "CASH">(props.onlineAvailable ? "ONLINE" : "CASH");
  const [terms, setTerms] = useState(false);
  const [sms, setSms] = useState(false);

  const [quote, setQuote] = useState<PublicQuoteView | null>(null);
  const [loading, setLoading] = useState(false);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  const arrivalAt = `${arrDate}T${arrTime}`;
  const departureAt = `${depDate}T${depTime}`;
  const extrasKey = [...picked].sort().join(",");

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      const fields: Record<string, string> = {
        rateId, arrivalAt, departureAt, adults, kids, seatBaby, seatKind, seatBoost,
        oversize: oversize ? "on" : "", couponCode: coupon,
      };
      for (const id of picked) fields[`extra_${id}`] = "1";
      const res = await quotePublicAction({ slug: brandSlug, fields });
      if (!cancelled) {
        setQuote(res);
        setLoading(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandSlug, rateId, arrivalAt, departureAt, adults, kids, seatBaby, seatKind, seatBoost, oversize, extrasKey, coupon]);

  const toggleExtra = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const addQuick = (text: string) => {
    const el = noteRef.current;
    if (!el) return;
    el.value = (el.value ? el.value.replace(/[,\s]+$/, "") + ", " : "") + text;
    el.focus();
  };

  const totals = quote?.rateTotals ?? {};
  const cheapest = Object.values(totals).length ? Math.min(...Object.values(totals)) : null;

  return (
    <form action={action} className="pub-bk">
      <input type="hidden" name="brandSlug" value={brandSlug} />
      <input type="hidden" name="checkoutKey" value={props.checkoutKey} />
      <input type="hidden" name="arrivalAt" value={arrivalAt} />
      <input type="hidden" name="departureAt" value={departureAt} />

      <div className="pub-card pub-steps" style={{ gap: 22 }}>
        {/* 1 · Reise */}
        <section>
          <div className="pub-step-h"><span>1</span>Reise</div>
          <div className="pub-g2">
            <label className="pub-field">Ankunft am Parkplatz
              <input className="pub-inp" type="date" value={arrDate} onChange={(e) => setArrDate(e.target.value)} required />
            </label>
            <label className="pub-field">Uhrzeit
              <select className="pub-inp pub-mono" value={arrTime} onChange={(e) => setArrTime(e.target.value)}>
                {TIMES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </label>
            <label className="pub-field">Rückkehr (Landung)
              <input className="pub-inp" type="date" value={depDate} onChange={(e) => setDepDate(e.target.value)} required />
            </label>
            <label className="pub-field">Landezeit
              <select className="pub-inp pub-mono" value={depTime} onChange={(e) => setDepTime(e.target.value)}>
                {TIMES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </label>
            <label className="pub-field">Flugnummer Hinflug
              <input className="pub-inp pub-mono" name="outboundFlight" placeholder="EW9580" defaultValue={v("outboundFlight")} maxLength={12} autoCapitalize="characters" />
            </label>
            <label className="pub-field">Flugnummer Rückflug
              <input className="pub-inp pub-mono" name="returnFlight" placeholder="EW9581" defaultValue={v("returnFlight")} maxLength={12} autoCapitalize="characters" />
              <span className="pub-meta">Damit wir Verspätungen sehen und pünktlich abholen.</span>
            </label>
          </div>
          <div className={`pub-banner${quote && !quote.ok ? " warn" : ""}`} style={{ marginTop: 12 }} aria-live="polite">
            {loading && !quote
              ? "Preis wird berechnet …"
              : quote && !quote.ok
                ? quote.error
                : cheapest !== null && quote?.ok
                  ? `${Object.keys(totals).length} Tarife frei · ab ${formatEuro(cheapest)} € für ${quote.days} ${quote.days === 1 ? "Tag" : "Tage"}`
                  : "Bitte Reisedaten angeben"}
          </div>
        </section>

        {/* 2 · Tarif */}
        <section>
          <div className="pub-step-h"><span>2</span>Tarif</div>
          <div className="pub-rates">
            {rates.map((r) => (
              <label key={r.id} className="pub-rate">
                <input type="radio" name="rateId" value={r.id} checked={rateId === r.id} onChange={() => setRateId(r.id)} />
                <span className="ic"><RateIcon service={r.service} /></span>
                <span><b>{r.name}</b><span className="sub">{SERVICE[r.service]} · {LOT[r.lotType]}</span></span>
                <span className="pr">{totals[r.id] !== undefined ? `${formatEuro(totals[r.id])} €` : "–"}</span>
              </label>
            ))}
          </div>
        </section>

        {/* 3 · Ihre Daten */}
        <section>
          <div className="pub-step-h"><span>3</span>Ihre Daten</div>
          <div className="pub-g2">
            <label className="pub-field">Vorname
              <input className="pub-inp" name="firstName" autoComplete="given-name" defaultValue={v("firstName")} required maxLength={60} />
            </label>
            <label className="pub-field">Nachname
              <input className="pub-inp" name="lastName" autoComplete="family-name" defaultValue={v("lastName")} required maxLength={60} />
            </label>
            <label className="pub-field">E-Mail
              <input className="pub-inp" name="email" type="email" autoComplete="email" defaultValue={v("email")} required maxLength={120} />
            </label>
            <label className="pub-field">Mobilnummer
              <input className="pub-inp pub-mono" name="phone" type="tel" autoComplete="tel" placeholder="+49 170 1234567" defaultValue={v("phone")} required maxLength={40} />
            </label>
            <label className="pub-field">Kfz-Kennzeichen
              <input className="pub-inp pub-mono" name="plate" placeholder="D-XP 123" defaultValue={v("plate")} required maxLength={15} autoCapitalize="characters" />
            </label>
            <label className="pub-field">Fahrzeug (optional)
              <input className="pub-inp" name="vehicle" placeholder="Marke / Modell" defaultValue={v("vehicle")} maxLength={60} />
            </label>
          </div>
          <div className="pub-field" style={{ marginTop: 12 }}>Personen &amp; Kindersitze</div>
          <div className="pub-g2" style={{ marginTop: 6 }}>
            <label className="pub-field">Erwachsene
              <select className="pub-inp" name="adults" value={adults} onChange={(e) => setAdults(e.target.value)}>
                {range(1, 12).map((n) => <option key={n}>{n}</option>)}
              </select>
            </label>
            <label className="pub-field">Kinder (bis 12 J.)
              <select className="pub-inp" name="kids" value={kids} onChange={(e) => setKids(e.target.value)}>
                {range(0, 12).map((n) => <option key={n}>{n}</option>)}
              </select>
            </label>
            {showSeats && (
              <>
                <label className="pub-field">Babyschale (0–15 Mon.)
                  <select className="pub-inp" name="seatBaby" value={seatBaby} onChange={(e) => setSeatBaby(e.target.value)}>
                    {range(0, 4).map((n) => <option key={n}>{n}</option>)}
                  </select>
                </label>
                <label className="pub-field">Kindersitz (1–4 J.)
                  <select className="pub-inp" name="seatKind" value={seatKind} onChange={(e) => setSeatKind(e.target.value)}>
                    {range(0, 4).map((n) => <option key={n}>{n}</option>)}
                  </select>
                </label>
                <label className="pub-field">Sitzerhöhung (4–12 J.)
                  <select className="pub-inp" name="seatBoost" value={seatBoost} onChange={(e) => setSeatBoost(e.target.value)}>
                    {range(0, 4).map((n) => <option key={n}>{n}</option>)}
                  </select>
                </label>
              </>
            )}
          </div>
          <label className="pub-check" style={{ marginTop: 12 }}>
            <input type="checkbox" name="oversize" checked={oversize} onChange={(e) => setOversize(e.target.checked)} />
            <span>Übergroßes Fahrzeug (z. B. Van, länger als 5 m)</span>
          </label>
        </section>

        {/* 4 · Hinweis */}
        <section>
          <div className="pub-step-h"><span>4</span>Was bringen Sie mit?</div>
          <label className="pub-field">Hinweis für unser Team
            <textarea ref={noteRef} className="pub-inp" name="customerNote" maxLength={1000} defaultValue={v("customerNote")}
              placeholder="z. B. Kinderwagen, Golftasche, Rollstuhl, Hund in Box …" />
          </label>
          <div className="pub-quick" style={{ marginTop: 8 }}>
            {QUICK.map((q) => <button type="button" key={q} onClick={() => addQuick(q)}>{q}</button>)}
          </div>
        </section>

        {/* 5 · Extras */}
        <section>
          <div className="pub-step-h"><span>5</span>Extras</div>
          {extras.length > 0 && (
            <div style={{ display: "grid", gap: 8 }}>
              {extras.map((e) => (
                <label key={e.id} className="pub-check">
                  <input type="checkbox" name={`extra_${e.id}`} value="1" checked={picked.has(e.id)} onChange={() => toggleExtra(e.id)} />
                  <span>{e.name}</span>
                  <span className="r">{formatEuro(e.priceCents)} €</span>
                </label>
              ))}
            </div>
          )}
          <label className="pub-field" style={{ marginTop: 10 }}>Gutschein
            <input className="pub-inp pub-mono" name="couponCode" autoComplete="off" placeholder="Code" value={coupon}
              onChange={(e) => setCoupon(e.target.value)} maxLength={40} />
          </label>
        </section>

        {/* 6 · Zahlung */}
        <section>
          <div className="pub-step-h"><span>6</span>Zahlung</div>
          <div className="pub-pay">
            {props.onlineAvailable && (
              <label>
                <input type="radio" name="payment" value="ONLINE" checked={payment === "ONLINE"} onChange={() => setPayment("ONLINE")} />
                Online · Karte, PayPal, Apple Pay
              </label>
            )}
            <label>
              <input type="radio" name="payment" value="CASH" checked={payment === "CASH"} onChange={() => setPayment("CASH")} />
              Bar vor Ort
            </label>
          </div>
          {props.onlineHint && <div className="pub-banner warn" style={{ marginTop: 10 }}>{props.onlineHint}</div>}

          <label className="pub-check" style={{ marginTop: 12 }}>
            <input type="checkbox" name="smsOptIn" checked={sms} onChange={(e) => setSms(e.target.checked)} />
            <span>Ja, ich möchte Angebote und Rabatte per SMS/WhatsApp erhalten (jederzeit abbestellbar).</span>
          </label>
          <p className="pub-meta" style={{ margin: "6px 2px 0" }}>
            Wir informieren Sie per E-Mail über ähnliche Angebote. Sie können dem jederzeit widersprechen, z. B. über den Link in jeder E-Mail.
          </p>
          <label className="pub-check" style={{ marginTop: 12 }}>
            <input type="checkbox" name="termsAccepted" checked={terms} onChange={(e) => setTerms(e.target.checked)} required />
            <span>
              Ich akzeptiere{" "}
              {props.termsUrl ? <a href={props.termsUrl} target="_blank" rel="noopener noreferrer">AGB</a> : "AGB"} und{" "}
              {props.privacyUrl ? <a href={props.privacyUrl} target="_blank" rel="noopener noreferrer">Datenschutz</a> : "Datenschutz"}.
            </span>
          </label>

          {state.error && <div className="pub-error" role="alert" style={{ marginTop: 12 }}>⚠ {state.error}</div>}
          <button type="submit" className="pub-btn go lg" disabled={pending} style={{ marginTop: 12 }}>
            {pending ? "Bitte warten …" : payment === "ONLINE" ? "Weiter zur Zahlung" : "Verbindlich buchen"}
          </button>
        </section>
      </div>

      {/* Live summary */}
      <aside className="pub-card pub-sum-card" aria-live="polite">
        <div className="pub-sec-t">Ihre Buchung</div>
        {quote?.ok ? (
          <>
            {quote.lines.map((l, i) => (
              <div className="pub-srow" key={i}>
                <span>{l.label}{l.quantity > 1 ? ` × ${l.quantity}` : ""}</span>
                <span>{l.totalCents < 0 ? "−" : ""}{formatEuro(Math.abs(l.totalCents))} €</span>
              </div>
            ))}
            <div className="pub-srow muted"><span>{quote.rateName}</span><span>{quote.days} {quote.days === 1 ? "Tag" : "Tage"}</span></div>
            <div className="pub-srow pub-stot"><span>Gesamt (inkl. MwSt.)</span><span>{formatEuro(quote.totalCents)} €</span></div>
          </>
        ) : (
          <div className="pub-meta">{loading ? "Preis wird berechnet …" : "Der Preis erscheint, sobald die Reisedaten stimmen."}</div>
        )}
        <div className="pub-banner">Kostenlos stornieren bis {props.freeCancelHours} Std. vor Ankunft.</div>
      </aside>
    </form>
  );
}
