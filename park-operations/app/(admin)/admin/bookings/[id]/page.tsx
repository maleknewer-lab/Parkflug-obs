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
import { Check, Field, Message } from "../../rates/ui";
import { BookingFields } from "../fields";

const STATUS = { unconfirmed: "Unbestätigt", confirmed: "Bestätigt", cancelled: "Storniert" } as const;
const STATUS_CHIP = { unconfirmed: "amber", confirmed: "ok", cancelled: "warn" } as const;
const SOURCE = { WEBSITE: "Website", PHONE: "Telefon / WhatsApp", PARTNER_PORTAL: "Partner-Portal", XPARK: "X-Park" } as const;
const PAY = { CASH: "Bar", EC: "EC-Karte", ONLINE: "Online (Stripe)", PARTNER: "Partner" } as const;

type Breakdown = { lines?: { label: string; quantity: number; totalCents: number }[] } | null;

function show(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  return typeof v === "object" ? JSON.stringify(v) : String(v);
}

// Booking page, laid out like the prototype: header with status chips, cards for customer, trip, price, notes,
// then price check, edit, cancel and history.
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
      <div className="ui-ph">
        <div>
          <Link href="/admin/bookings" className="ui-back">← Buchungen</Link>
          <h1 className="ui-code">{b.code}</h1>
          <p>{b.brand.name} · {b.rate.name}</p>
        </div>
        <span className="ui-chips" style={{ marginTop: 0 }}>
          <span className={`ui-chip ${STATUS_CHIP[b.status]}`}>{STATUS[b.status]}</span>
          <span className={`ui-chip ${b.paid ? "ok" : "amber"}`}>{b.paid ? "bezahlt" : "offen"}</span>
        </span>
      </div>

      <Message saved={sp.saved} error={sp.error} />

      {cancelled && (
        <div className="ui-banner">
          Storniert{b.cancelledAt ? ` am ${formatBerlin(b.cancelledAt)}` : ""} –{" "}
          {b.cancelFree ? "kostenlos" : "nach Frist, der volle Preis bleibt fällig"}.
        </div>
      )}

      <section className="card pad ui-stack" style={{ gap: 8 }}>
        <div className="ui-sec-t">Kunde</div>
        <b>{b.customer.firstName} {b.customer.lastName}{b.customer.company ? ` · ${b.customer.company}` : ""}</b>
        <span className="ui-meta">{b.customer.email}</span>
        {b.customer.phone && <a href={`tel:${b.customer.phone}`}>{b.customer.phone}</a>}
      </section>

      <section className="card pad ui-stack" style={{ gap: 8 }}>
        <div className="ui-sec-t">Reise &amp; Fahrzeug</div>
        <div className="ui-kv"><span>Anreise</span><span>{formatBerlin(b.arrivalAt)}{b.outboundFlight ? ` · Flug ${b.outboundFlight}` : ""}</span></div>
        <div className="ui-kv"><span>Abreise</span><span>{formatBerlin(b.departureAt)}{b.returnFlight ? ` · Flug ${b.returnFlight}` : ""}</span></div>
        <div className="ui-kv">
          <span>Fahrzeug</span>
          <span><span className="ui-plate">{b.plate}</span>{b.vehicle ? ` · ${b.vehicle}` : ""}{b.oversize ? " · übergroß" : ""}</span>
        </div>
        <div className="ui-kv">
          <span>Personen</span>
          <span>
            {persons} ({b.adults} Erw., {b.kids} Kinder)
            {seats > 0 ? ` · Sitze: ${b.seatBaby} Baby, ${b.seatKind} Kind, ${b.seatBoost} Erhöhung` : ""}
          </span>
        </div>
        {b.extras.length > 0 && (
          <div className="ui-kv"><span>Extras</span><span>{b.extras.map((e) => `${e.quantity}× ${e.extra.name}`).join(", ")}</span></div>
        )}
      </section>

      <section className="card pad ui-stack" style={{ gap: 8 }}>
        <div className="ui-sec-t">Preis</div>
        {bd?.lines?.map((l, i) => (
          <div className="ui-kv" key={i}>
            <span>{l.quantity > 1 ? `${l.quantity}× ` : ""}{l.label}</span>
            <span className="ui-price">{formatEuro(l.totalCents)} €</span>
          </div>
        ))}
        <div className="ui-kv tot">
          <span>Gesamt{manual !== null ? " (manuell)" : ""}</span>
          <span className="ui-price">{formatEuro(b.priceCents)} €</span>
        </div>
        <span className="ui-meta">
          {b.paid ? `Bezahlt${b.paymentMethod ? ` (${PAY[b.paymentMethod]})` : ""}` : `Offen${b.paymentMethod ? ` · ${PAY[b.paymentMethod]}` : ""}`}
          {" · "}Quelle: {SOURCE[b.source]}{b.externalRef ? ` (${b.externalRef})` : ""}
          {b.coupon ? ` · Gutschein ${b.coupon.code}` : ""}
        </span>
      </section>

      {!cancelled && (
        <section className="card pad ui-stack" style={{ gap: 8 }}>
          <div className="ui-sec-t">Preisprüfung</div>
          {calc && !calc.ok && <div className="ui-banner">⚠ Prüfung nicht möglich: {calc.error}</div>}
          {calc?.ok && calcDiff && (
            <>
              <span className="ui-meta">Berechnet mit der aktuellen Preisliste, Daten und Optionen dieser Buchung.</span>
              <div className="ui-kv"><span>Neu berechnet</span><span className="ui-price">{formatEuro(calc.result.totalCents)} €</span></div>
              <div className="ui-kv"><span>Gespeichert</span><span className="ui-price">{formatEuro(b.priceCents)} €</span></div>
              {calcDiff.kind === "none" && manual === null ? (
                <span className="ui-chip ok" style={{ alignSelf: "flex-start" }}>✓ Der Preis entspricht der Berechnung</span>
              ) : (
                <>
                  {calcDiff.kind !== "none" && (
                    <b>
                      Differenz: {calcDiff.differenceCents > 0 ? "+" : ""}{formatEuro(calcDiff.differenceCents)} € (
                      {calcDiff.kind === "extra_payment" ? "Nachzahlung" : "Erstattung"})
                    </b>
                  )}
                  {b.paid && calcDiff.kind !== "none" && (
                    <span className="ui-meta">Die Buchung ist als bezahlt markiert – die Differenz muss nachkassiert bzw. erstattet werden.</span>
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

      <section className="card pad ui-stack" style={{ gap: 8 }}>
        <div className="ui-sec-t">Notizen</div>
        <div className="ui-kv"><span className="ui-meta">Kunde</span><span>{b.customerNote ?? "—"}</span></div>
        <div className="ui-kv"><span className="ui-meta">Intern</span><span>{b.internalNote ?? "—"}</span></div>
      </section>

      {!cancelled && (
        <section className="card pad">
          <details className="ui-details">
            <summary>Buchung bearbeiten</summary>
            <form action={updateBookingAction} className="ui-steps" style={{ paddingTop: 12 }}>
              <input type="hidden" name="id" value={b.id} />
              <label className="ui-field">
                <span>Tarif</span>
                <select className="ui-inp" name="rateId" defaultValue={b.rateId}>
                  {rates.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </label>
              <BookingFields seatsEnabled={seatsEnabled} extras={extras} v={v} />
              <span className="ui-meta">
                Der Preis ändert sich beim Speichern nicht automatisch – danach zeigt die Preisprüfung die Differenz.
                Nur ein eingetragener manueller Preis wird sofort übernommen.
              </span>
              <div><button className="btn go" type="submit">Änderungen speichern</button></div>
            </form>
          </details>
        </section>
      )}

      {canCancel && (
        <section className="card pad">
          <details className="ui-details">
            <summary>Buchung stornieren</summary>
            <form action={cancelBookingAction} className="ui-stack" style={{ paddingTop: 12 }}>
              <input type="hidden" name="id" value={b.id} />
              <span>
                {policy.free
                  ? `Kostenlose Stornierung möglich bis ${formatBerlin(policy.deadline)}.`
                  : `Die Frist ist abgelaufen (${formatBerlin(policy.deadline)}): voller Preis, keine Erstattung.`}
              </span>
              {!policy.free && <Check label="Kulanz: trotzdem kostenlos stornieren" name="waive" checked={false} />}
              <Field text label="Grund (optional)" name="reason" />
              <div><button className="btn" type="submit">Jetzt stornieren</button></div>
            </form>
          </details>
        </section>
      )}

      <section className="card pad ui-stack" style={{ gap: 8 }}>
        <div className="ui-sec-t">Verlauf</div>
        {b.activity.length === 0 && <span className="ui-meta">Noch keine Einträge.</span>}
        {b.activity.map((a) => {
          const changes = (a.changes ?? {}) as Record<string, { from: unknown; to: unknown }>;
          const who = a.user?.name ?? (b.source === "WEBSITE" ? "Kunde (Website)" : "System");
          return (
            <div key={a.id} className="ui-hist">
              <span className="ui-meta">{formatBerlin(a.createdAt)} · {who} · {a.action}</span>
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
