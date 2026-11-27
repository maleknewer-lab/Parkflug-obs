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
import { Pager } from "./pager";

const STATUS = { unconfirmed: "Unbestätigt", confirmed: "Bestätigt", cancelled: "Storniert" } as const;
const STATUS_CHIP = { unconfirmed: "amber", confirmed: "ok", cancelled: "warn" } as const;
const SOURCE = { WEBSITE: "Website", PHONE: "Telefon / WhatsApp", PARTNER_PORTAL: "Partner-Portal", XPARK: "X-Park" } as const;
const TABS: [string, string][] = [["", "Alle"], ["confirmed", "Bestätigt"], ["unconfirmed", "Unbestätigt"], ["cancelled", "Storniert"]];

// Bookings list (admin + dispo), laid out like the prototype: header with "+ Neue Buchung", search + status tabs,
// one table. Default view = upcoming bookings. Server component, no client JS.
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

  // Filters that are kept when paging or switching the status tab
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
  const tabHref = (status: string) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...keep, status: status || null })) if (v) qs.set(k, v);
    const s = qs.toString();
    return s ? `/admin/bookings?${s}` : "/admin/bookings";
  };
  const moreOpen = Boolean(f.brandId || f.paid || f.from || f.to || f.dateField === "departure");

  return (
    <div className="page">
      <div className="ui-ph">
        <div>
          <h1>Buchungen</h1>
          <p>{total} {total === 1 ? "Buchung" : "Buchungen"}</p>
        </div>
        <Link className="btn go" href="/admin/bookings/new">+ Neue Buchung</Link>
      </div>

      {customer && (
        <div className="ui-banner" style={{ background: "var(--brand-soft, #e6eaf2)", color: "var(--brand, #2f4a7d)" }}>
          Kunde: <b>{customer.firstName} {customer.lastName}</b> · <Link href="/admin/bookings">Filter entfernen</Link>
        </div>
      )}

      <form method="get" className="ui-stack">
        {f.customerId && <input type="hidden" name="customer" value={f.customerId} />}
        {f.status && <input type="hidden" name="status" value={f.status} />}
        <div className="ui-bar">
          <input className="ui-inp ui-search" type="search" name="q" defaultValue={f.q} aria-label="Suche"
            placeholder="Suchen: Code, Name, Kennzeichen, E-Mail, Telefon" />
          <select className="ui-inp" name="scope" defaultValue={f.scope} aria-label="Zeitraum" style={{ width: "auto" }}>
            <option value="upcoming">Anstehend (ab heute)</option>
            <option value="past">Vergangen</option>
            <option value="all">Alle</option>
          </select>
          <button className="btn" type="submit">Suchen</button>
          <Link className="btn soft" href="/admin/bookings">Zurücksetzen</Link>
        </div>

        <details className="ui-details card pad" open={moreOpen}>
          <summary>Mehr Filter</summary>
          <div className="ui-kgrid" style={{ paddingTop: 10 }}>
            {brands.length > 1 && (
              <label className="ui-field">
                <span>Marke</span>
                <select className="ui-inp" name="brand" defaultValue={f.brandId ?? ""}>
                  <option value="">Alle</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </label>
            )}
            <label className="ui-field">
              <span>Zahlung</span>
              <select className="ui-inp" name="paid" defaultValue={f.paid ?? ""}>
                <option value="">Alle</option>
                <option value="paid">Bezahlt</option>
                <option value="open">Offen</option>
              </select>
            </label>
            <label className="ui-field">
              <span>Datum bezieht sich auf</span>
              <select className="ui-inp" name="field" defaultValue={f.dateField}>
                <option value="arrival">Anreise</option>
                <option value="departure">Abreise</option>
              </select>
            </label>
            <label className="ui-field">
              <span>Von</span>
              <input className="ui-inp" type="date" name="from" defaultValue={f.from ?? ""} />
            </label>
            <label className="ui-field">
              <span>Bis</span>
              <input className="ui-inp" type="date" name="to" defaultValue={f.to ?? ""} />
            </label>
          </div>
        </details>
      </form>

      <nav className="ui-seg" aria-label="Status">
        {TABS.map(([k, label]) => (
          <Link key={k || "all"} href={tabHref(k)} className={(f.status ?? "") === k ? "on" : ""}>{label}</Link>
        ))}
      </nav>

      <div className="card ui-scroll">
        <table className="ui-tbl">
          <thead>
            <tr>
              <th>Nr.</th>
              <th>Kunde</th>
              <th>Fahrzeug</th>
              <th>Zeitraum</th>
              <th>Tarif · Quelle</th>
              <th>Status</th>
              <th className="r">Preis</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={7} className="ui-meta" style={{ padding: 18 }}>Keine Buchungen gefunden.</td></tr>
            )}
            {rows.map((b) => (
              <tr key={b.id} className={b.status === "cancelled" ? "ui-dim" : ""}>
                <td>
                  <Link className="open ui-code" href={`/admin/bookings/${b.id}`}>{b.code}</Link>
                  <div className="ui-meta">{formatBerlin(b.createdAt)}</div>
                </td>
                <td>
                  <b>{b.customer.firstName} {b.customer.lastName}</b>
                  {b.customer.phone && <div><a className="tel" href={`tel:${b.customer.phone}`}>{b.customer.phone}</a></div>}
                  {(b.customerNote || b.internalNote) && (
                    <div className="ui-chips">
                      {b.customerNote && <span className="ui-chip amber">Kunden-Hinweis</span>}
                      {b.internalNote && <span className="ui-chip violet">Intern</span>}
                    </div>
                  )}
                </td>
                <td>
                  <span className="ui-plate">{b.plate}</span>
                  <div className="ui-meta">
                    {b.adults + b.kids} {b.adults + b.kids === 1 ? "Person" : "Personen"}
                    {b.seatBaby + b.seatKind + b.seatBoost > 0 ? ` · ${b.seatBaby + b.seatKind + b.seatBoost} Sitz(e)` : ""}
                  </div>
                </td>
                <td style={{ whiteSpace: "nowrap", fontSize: 13 }} className="ui-mono">
                  {formatBerlin(b.arrivalAt)}
                  <br />
                  <span className="ui-meta">{formatBerlin(b.departureAt)}</span>
                </td>
                <td>
                  {b.rate.name}
                  <div className="ui-meta">{b.brand.name} · {SOURCE[b.source]}</div>
                </td>
                <td>
                  <span className={`ui-chip ${STATUS_CHIP[b.status]}`}>{STATUS[b.status]}</span>
                  {b.paid && <div className="ui-chips"><span className="ui-chip ok">bezahlt</span></div>}
                </td>
                <td className="r ui-price">{formatEuro(b.priceCents)} €</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pager basePath="/admin/bookings" params={keep} page={f.page} total={total} pageSize={PAGE_SIZE} />
    </div>
  );
}
