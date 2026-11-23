import Link from "next/link";
import { allowedBrandIds, requireOffice } from "@/lib/booking/auth";
import {
  PAGE_SIZE,
  buildBookingOrderBy,
  buildBookingWhere,
  parseListParams,
} from "@/lib/booking/list";
import { db } from "@/lib/db";
import { formatBerlin } from "@/lib/pricing";
import { formatEuro } from "@/lib/rates/form";
import { inputStyle } from "../rates/ui";
import { Pager } from "./pager";

const STATUS = { unconfirmed: "Unbestätigt", confirmed: "Bestätigt", cancelled: "Storniert" } as const;

// Bookings list (admin + dispo): search, filters, paging. Default view = upcoming bookings.
export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await requireOffice();
  const sp = await searchParams;
  const f = parseListParams(sp);
  const allowed = await allowedBrandIds(me.id);
  const where = buildBookingWhere(f, { allowedBrandIds: allowed, now: new Date() });

  const [total, rows, brands, customer] = await Promise.all([
    db.booking.count({ where }),
    db.booking.findMany({
      where,
      orderBy: buildBookingOrderBy(f),
      skip: (f.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { customer: true, brand: true, rate: { select: { name: true } } },
    }),
    db.brand.findMany({
      where: { active: true, ...(allowed === "all" ? {} : { id: { in: allowed } }) },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    f.customerId
      ? db.customer.findUnique({ where: { id: f.customerId }, select: { firstName: true, lastName: true } })
      : Promise.resolve(null),
  ]);

  // Filters that are kept when paging
  const keep = {
    q: f.q || null,
    brand: f.brandId,
    status: f.status,
    paid: f.paid,
    scope: sp.scope ? f.scope : null,
    field: f.dateField === "departure" ? "departure" : null,
    from: f.from,
    to: f.to,
    customer: f.customerId,
  };
  const moreOpen = Boolean(f.brandId || f.status || f.paid || f.from || f.to || f.dateField === "departure");

  return (
    <div className="page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <h1 style={{ margin: 0 }}>Buchungen</h1>
        <Link className="btn" href="/admin/bookings/new">+ Neue Buchung</Link>
      </div>

      {customer && (
        <div className="card pad">
          Kunde: <b>{customer.firstName} {customer.lastName}</b> · <Link href="/admin/bookings">Filter entfernen</Link>
        </div>
      )}

      <form method="get" className="card pad" style={{ display: "grid", gap: 12 }}>
        {f.customerId && <input type="hidden" name="customer" value={f.customerId} />}
        <input
          type="search"
          name="q"
          defaultValue={f.q}
          placeholder="Suche: Code, Name, Kennzeichen, E-Mail, Telefon …"
          style={inputStyle}
        />
        <label style={{ display: "grid", gap: 4 }}>
          <span>Zeitraum</span>
          <select name="scope" defaultValue={f.scope} style={inputStyle}>
            <option value="upcoming">Anstehend (ab heute)</option>
            <option value="past">Vergangen</option>
            <option value="all">Alle</option>
          </select>
        </label>
        <details open={moreOpen}>
          <summary style={{ cursor: "pointer", minHeight: 44, display: "flex", alignItems: "center" }}>Mehr Filter</summary>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, paddingTop: 8 }}>
            {brands.length > 1 && (
              <label style={{ display: "grid", gap: 4 }}>
                <span>Marke</span>
                <select name="brand" defaultValue={f.brandId ?? ""} style={inputStyle}>
                  <option value="">Alle</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </label>
            )}
            <label style={{ display: "grid", gap: 4 }}>
              <span>Status</span>
              <select name="status" defaultValue={f.status ?? ""} style={inputStyle}>
                <option value="">Alle</option>
                <option value="confirmed">Bestätigt</option>
                <option value="unconfirmed">Unbestätigt</option>
                <option value="cancelled">Storniert</option>
              </select>
            </label>
            <label style={{ display: "grid", gap: 4 }}>
              <span>Zahlung</span>
              <select name="paid" defaultValue={f.paid ?? ""} style={inputStyle}>
                <option value="">Alle</option>
                <option value="paid">Bezahlt</option>
                <option value="open">Offen</option>
              </select>
            </label>
            <label style={{ display: "grid", gap: 4 }}>
              <span>Datum bezieht sich auf</span>
              <select name="field" defaultValue={f.dateField} style={inputStyle}>
                <option value="arrival">Anreise</option>
                <option value="departure">Abreise</option>
              </select>
            </label>
            <label style={{ display: "grid", gap: 4 }}>
              <span>Von</span>
              <input type="date" name="from" defaultValue={f.from ?? ""} style={inputStyle} />
            </label>
            <label style={{ display: "grid", gap: 4 }}>
              <span>Bis</span>
              <input type="date" name="to" defaultValue={f.to ?? ""} style={inputStyle} />
            </label>
          </div>
        </details>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" type="submit">Filtern</button>
          <Link className="btn" href="/admin/bookings">Zurücksetzen</Link>
        </div>
      </form>

      <span className="muted">{total} {total === 1 ? "Buchung" : "Buchungen"}</span>

      {rows.length === 0 && <div className="card pad">Keine Buchungen gefunden.</div>}
      {rows.map((b) => (
        <Link
          key={b.id}
          href={`/admin/bookings/${b.id}`}
          className="card pad"
          style={{ display: "grid", gap: 2, opacity: b.status === "cancelled" ? 0.65 : 1 }}
        >
          <span>
            <b>{b.code}</b> · {STATUS[b.status]}{b.paid ? " · bezahlt" : ""}
          </span>
          <span>{b.customer.firstName} {b.customer.lastName} · {b.plate}</span>
          <span className="muted">{formatBerlin(b.arrivalAt)} → {formatBerlin(b.departureAt)}</span>
          <span className="muted">
            {b.brand.name} · {b.rate.name} · {b.adults + b.kids} Pers. · {formatEuro(b.priceCents)} €
          </span>
        </Link>
      ))}

      <Pager basePath="/admin/bookings" params={keep} page={f.page} total={total} pageSize={PAGE_SIZE} />
    </div>
  );
}
