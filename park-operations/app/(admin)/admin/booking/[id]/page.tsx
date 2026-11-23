import Link from "next/link";
import { notFound } from "next/navigation";
import { allowedBrandIds, brandAllowed, requireOffice } from "@/lib/booking/auth";
import { db } from "@/lib/db";
import { formatBerlin } from "@/lib/pricing";
import { formatEuro } from "@/lib/rates/form";
import { Message } from "../../rates/ui";

const STATUS = { unconfirmed: "Unbestätigt", confirmed: "Bestätigt", cancelled: "Storniert" } as const;
const SOURCE = { WEBSITE: "Website", PHONE: "Telefon / WhatsApp", PARTNER_PORTAL: "Partner-Portal", XPARK: "X-Park" } as const;
const PAY = { CASH: "Bar", EC: "EC-Karte", ONLINE: "Online (Stripe)", PARTNER: "Partner" } as const;

type Breakdown = { lines?: { label: string; quantity: number; totalCents: number }[] } | null;

function show(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  return typeof v === "object" ? JSON.stringify(v) : String(v);
}

// Booking detail (read-only in this step; editing and cancelling follow in the next PR).
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

  const bd = b.priceBreakdown as unknown as Breakdown;
  const persons = b.adults + b.kids;
  const seats = b.seatBaby + b.seatKind + b.seatBoost;

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
        <span style={{ display: "flex", justifyContent: "space-between", gap: 12, fontWeight: 600, borderTop: "1px solid rgba(128,128,128,.25)", paddingTop: 6 }}>
          <span>Gesamt</span>
          <span>{formatEuro(b.priceCents)} €</span>
        </span>
        <span className="muted">
          {b.paid ? `Bezahlt${b.paymentMethod ? ` (${PAY[b.paymentMethod]})` : ""}` : `Offen${b.paymentMethod ? ` · ${PAY[b.paymentMethod]}` : ""}`}
          {" · "}Quelle: {SOURCE[b.source]}{b.externalRef ? ` (${b.externalRef})` : ""}
          {b.coupon ? ` · Gutschein ${b.coupon.code}` : ""}
        </span>
      </section>

      <section className="card pad" style={{ display: "grid", gap: 6 }}>
        <b>Notizen</b>
        <span><span className="muted">Kunde:</span> {b.customerNote ?? "—"}</span>
        <span><span className="muted">Intern:</span> {b.internalNote ?? "—"}</span>
      </section>

      <section className="card pad" style={{ display: "grid", gap: 8 }}>
        <b>Verlauf</b>
        {b.activity.length === 0 && <span className="muted">Noch keine Einträge.</span>}
        {b.activity.map((a) => {
          const changes = (a.changes ?? {}) as Record<string, { from: unknown; to: unknown }>;
          return (
            <div key={a.id} style={{ borderTop: "1px solid rgba(128,128,128,.25)", paddingTop: 8 }}>
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
