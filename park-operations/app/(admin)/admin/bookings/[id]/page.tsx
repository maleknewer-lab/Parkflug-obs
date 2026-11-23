import Link from "next/link";
import { notFound } from "next/navigation";
import { applyPriceAction, cancelBookingAction, updateBookingAction } from "@/app/actions/bookings";
import { cancellationPolicy } from "@/lib/booking";
import { allowedBrandIds, brandAllowed, requireOffice } from "@/lib/booking/auth";
import { recomputeStoredBooking } from "@/lib/booking/server";
import { bookingFormValues, manualPriceOf } from "@/lib/booking/values";
import { db } from "@/lib/db";
import { formatBerlin, priceDifference } from "@/lib/pricing";
import { formatEuro } from "@/lib/rates/form";
import { Check, Field, Message, inputStyle } from "../../rates/ui";
import { BookingFields } from "../fields";

const STATUS = { unconfirmed: "Unbestätigt", confirmed: "Bestätigt", cancelled: "Storniert" } as const;
const SOURCE = { WEBSITE: "Website", PHONE: "Telefon / WhatsApp", PARTNER_PORTAL: "Partner-Portal", XPARK: "X-Park" } as const;
const PAY = { CASH: "Bar", EC: "EC-Karte", ONLINE: "Online (Stripe)", PARTNER: "Partner" } as const;

type Breakdown = { lines?: { label: string; quantity: number; totalCents: number }[] } | null;

function show(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  return typeof v === "object" ? JSON.stringify(v) : String(v);
}

const rule = "1px solid rgba(128,128,128,.25)";
const summaryStyle = { cursor: "pointer", minHeight: 44, display: "flex", alignItems: "center" } as const;

// Booking page: details, price check (with difference), edit, cancel, history.
export default async function BookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const me = await requireOffice();
  const { id } = await params;
  const sp = await searchParams;

  const b = await db.booking.findUnique({
    where: { id },
    include: {
      brand: true,
      customer: true,
      rate: true,
      coupon: true,
      extras: { include: { extra: true } },
      activity: { orderBy: { createdAt: "desc" }, include: { user: { select: { name: true } } } },
    },
  });
  if (!b || !brandAllowed(await allowedBrandIds(me.id), b.brandId)) notFound();

  const cancelled = b.status === "cancelled";
  const bd = b.priceBreakdown as unknown as Breakdown;
  const manual = manualPriceOf(b.priceBreakdown);
  const persons = b.adults + b.kids;
  const seats = b.seatBaby + b.seatKind + b.seatBoost;

  // Price check against today's price list (staff decide whether to apply it)
  const calc = cancelled ? null : await recomputeStoredBooking(b);
  const calcDiff = calc?.ok ? priceDifference(b.priceCents, calc.result.totalCents) : null;

  // Edit form data
  const rates = cancelled
    ? []
    : await db.rate.findMany({
        where: { brandId: b.brandId, OR: [{ active: true }, { id: b.rateId }] },
        orderBy: [{ sort: "asc" }, { name: "asc" }],
        select: { id: true, name: true },
      });
  const extras = cancelled
    ? []
    : await db.extra.findMany({
        where: { brandId: b.brandId, OR: [{ active: true }, { id: { in: b.extras.map((e) => e.extraId) } }] },
        orderBy: { name: "asc" },
        select: { id: true, name: true, priceCents: true },
      });
  const v = bookingFormValues({ ...b, customer: b.customer, couponCode: b.coupon?.code ?? null, manualPriceCents: manual });
  const seatsEnabled = b.rate.seatsEnabled ?? b.brand.seatsEnabled;

  // Cancellation
  const policy = cancellationPolicy(b.arrivalAt, new Date(), b.brand.freeCancelHours);
  const canCancel = !cancelled && b.transferStatus === "expected";

  return (
    <div className="page">
      <div>
        <Link href="/admin/bookings" className="muted">← Buchungen</Link>
        <h1 style={{ margin: "4px 0 0" }}>{b.code}</h1>
        <p className="muted" style={{ margin: "4px 0 0" }}>
          {b.brand.name} · {b.rate.name} · {STATUS[b.status]}
        </p>
      </div>

      <Message saved={sp.saved} error={sp.error} />

      {cancelled && (
        <div className="card pad" style={{ borderColor: "#b4534f" }}>
          Storniert{b.cancelledAt ? ` am ${formatBerlin(b.cancelledAt)}` : ""} –{" "}
          {b.cancelFree ? "kostenlos" : "nach Frist, der volle Preis bleibt fällig"}.
        </div>
      )}

      <section className="card pad" style={{ display: "grid", gap: 6 }}>
        <b>Kunde</b>
        <span>{b.customer.firstName} {b.customer.lastName}{b.customer.company ? ` · ${b.customer.company}` : ""}</span>
        <span className="muted">{b.customer.email}</span>
        {b.customer.phone && <a href={`tel:${b.customer.phone}`}>{b.customer.phone}</a>}
      </section>

      <section className="card pad" style={{ display: "grid", gap: 6 }}>
        <b>Reise &amp; Fahrzeug</b>
        <span>Anreise: {formatBerlin(b.arrivalAt)}{b.outboundFlight ? ` · Flug ${b.outboundFlight}` : ""}</span>
        <span>Abreise: {formatBerlin(b.departureAt)}{b.returnFlight ? ` · Flug ${b.returnFlight}` : ""}</span>
        <span>Kennzeichen: {b.plate}{b.vehicle ? ` · ${b.vehicle}` : ""}{b.oversize ? " · übergroß" : ""}</span>
        <span>
          Personen: {persons} ({b.adults} Erw., {b.kids} Kinder)
          {seats > 0 ? ` · Sitze: ${b.seatBaby} Baby, ${b.seatKind} Kind, ${b.seatBoost} Erhöhung` : ""}
        </span>
        {b.extras.length > 0 && <span>Extras: {b.extras.map((e) => `${e.quantity}× ${e.extra.name}`).join(", ")}</span>}
      </section>

      <section className="card pad" style={{ display: "grid", gap: 6 }}>
        <b>Preis</b>
        {bd?.lines?.map((l, i) => (
          <span key={i} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <span>{l.quantity > 1 ? `${l.quantity}× ` : ""}{l.label}</span>
            <span>{formatEuro(l.totalCents)} €</span>
          </span>
        ))}
        <span style={{ display: "flex", justifyContent: "space-between", gap: 12, fontWeight: 600, borderTop: rule, paddingTop: 6 }}>
          <span>Gesamt{manual !== null ? " (manuell)" : ""}</span>
          <span>{formatEuro(b.priceCents)} €</span>
        </span>
        <span className="muted">
          {b.paid ? `Bezahlt${b.paymentMethod ? ` (${PAY[b.paymentMethod]})` : ""}` : `Offen${b.paymentMethod ? ` · ${PAY[b.paymentMethod]}` : ""}`}
          {" · "}Quelle: {SOURCE[b.source]}{b.externalRef ? ` (${b.externalRef})` : ""}
          {b.coupon ? ` · Gutschein ${b.coupon.code}` : ""}
        </span>
      </section>

      {!cancelled && (
        <section className="card pad" style={{ display: "grid", gap: 8 }}>
          <b>Preisprüfung</b>
          {calc && !calc.ok && <span>⚠ Prüfung nicht möglich: {calc.error}</span>}
          {calc?.ok && calcDiff && (
            <>
              <span className="muted">Berechnet mit der aktuellen Preisliste, Daten und Optionen dieser Buchung.</span>
              <span style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <span>Neu berechnet</span><span>{formatEuro(calc.result.totalCents)} €</span>
              </span>
              <span style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <span>Gespeichert</span><span>{formatEuro(b.priceCents)} €</span>
              </span>
              {calcDiff.kind === "none" && manual === null ? (
                <span>✓ Der Preis entspricht der Berechnung.</span>
              ) : (
                <>
                  {calcDiff.kind !== "none" && (
                    <b>
                      Differenz: {calcDiff.differenceCents > 0 ? "+" : ""}{formatEuro(calcDiff.differenceCents)} € (
                      {calcDiff.kind === "extra_payment" ? "Nachzahlung" : "Erstattung"})
                    </b>
                  )}
                  {b.paid && calcDiff.kind !== "none" && (
                    <span className="muted">Die Buchung ist als bezahlt markiert – die Differenz muss nachkassiert bzw. erstattet werden.</span>
                  )}
                  <form action={applyPriceAction}>
                    <input type="hidden" name="id" value={b.id} />
                    <button className="btn" type="submit">
                      {manual !== null ? "Manuellen Preis verwerfen, berechneten übernehmen" : "Neuen Preis übernehmen"}
                    </button>
                  </form>
                </>
              )}
            </>
          )}
        </section>
      )}

      <section className="card pad" style={{ display: "grid", gap: 6 }}>
        <b>Notizen</b>
        <span><span className="muted">Kunde:</span> {b.customerNote ?? "—"}</span>
        <span><span className="muted">Intern:</span> {b.internalNote ?? "—"}</span>
      </section>

      {!cancelled && (
        <details className="card pad">
          <summary style={summaryStyle}><b>Buchung bearbeiten</b></summary>
          <form action={updateBookingAction} style={{ display: "grid", gap: 20, paddingTop: 8 }}>
            <input type="hidden" name="id" value={b.id} />
            <label style={{ display: "grid", gap: 4 }}>
              <span>Tarif</span>
              <select name="rateId" defaultValue={b.rateId} style={inputStyle}>
                {rates.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </label>
            <BookingFields seatsEnabled={seatsEnabled} extras={extras} v={v} />
            <span className="muted" style={{ fontSize: 12 }}>
              Der Preis ändert sich beim Speichern nicht automatisch – danach zeigt die Preisprüfung die Differenz.
              Nur ein eingetragener manueller Preis wird sofort übernommen.
            </span>
            <button className="btn" type="submit">Änderungen speichern</button>
          </form>
        </details>
      )}

      {canCancel && (
        <details className="card pad">
          <summary style={summaryStyle}><b>Buchung stornieren</b></summary>
          <form action={cancelBookingAction} style={{ display: "grid", gap: 12, paddingTop: 8 }}>
            <input type="hidden" name="id" value={b.id} />
            <span>
              {policy.free
                ? `Kostenlose Stornierung möglich bis ${formatBerlin(policy.deadline)}.`
                : `Die Frist ist abgelaufen (${formatBerlin(policy.deadline)}): voller Preis, keine Erstattung.`}
            </span>
            {!policy.free && <Check label="Kulanz: trotzdem kostenlos stornieren" name="waive" checked={false} />}
            <Field text label="Grund (optional)" name="reason" />
            <button className="btn" type="submit">Jetzt stornieren</button>
          </form>
        </details>
      )}

      <section className="card pad" style={{ display: "grid", gap: 8 }}>
        <b>Verlauf</b>
        {b.activity.length === 0 && <span className="muted">Noch keine Einträge.</span>}
        {b.activity.map((a) => {
          const changes = (a.changes ?? {}) as Record<string, { from: unknown; to: unknown }>;
          return (
            <div key={a.id} style={{ borderTop: rule, paddingTop: 8 }}>
              <span className="muted">{formatBerlin(a.createdAt)} · {a.user?.name ?? "System"} · {a.action}</span>
              {Object.entries(changes).map(([field, c]) => (
                <div key={field}>{field}: {show(c.from)} → {show(c.to)}</div>
              ))}
            </div>
          );
        })}
      </section>
    </div>
  );
}
