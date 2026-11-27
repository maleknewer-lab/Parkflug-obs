import Link from "next/link";
import { allowedBrandIds, requireOffice } from "@/lib/booking/auth";
import {
  PAGE_SIZE,
  RETURNING_MIN_BOOKINGS,
  buildCustomerWhere,
  parsePage,
} from "@/lib/booking/list";
import { db } from "@/lib/db";
import { formatBerlin } from "@/lib/pricing";
import { Pager } from "../bookings/pager";

// Customers list (admin + dispo), laid out like the prototype: header, search, one table.
// Customers with several bookings are flagged "Stammkunde".
export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await requireOffice();
  const sp = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
  const q = first(sp.q).slice(0, 100);
  const page = parsePage(first(sp.page));

  const where = buildCustomerWhere(q, await allowedBrandIds(me.id));
  const [total, rows] = await Promise.all([
    db.customer.count({ where }),
    db.customer.findMany({
      where,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        _count: { select: { bookings: { where: { status: { not: "cancelled" } } } } },
        bookings: { orderBy: { arrivalAt: "desc" }, take: 1, select: { arrivalAt: true, plate: true } },
      },
    }),
  ]);

  return (
    <div className="page">
      <div className="ui-ph">
        <div>
          <h1>Kunden</h1>
          <p>{total} {total === 1 ? "Kunde" : "Kunden"}</p>
        </div>
      </div>

      <form method="get" className="ui-bar">
        <input className="ui-inp ui-search" type="search" name="q" defaultValue={q} aria-label="Kundensuche"
          placeholder="Suchen: Name, E-Mail, Telefon, Firma" />
        <button className="btn" type="submit">Suchen</button>
        <Link className="btn soft" href="/admin/customers">Zurücksetzen</Link>
      </form>

      <div className="card ui-scroll">
        <table className="ui-tbl">
          <thead>
            <tr>
              <th>Kunde</th>
              <th>Telefon</th>
              <th>Kennzeichen</th>
              <th>Buchungen</th>
              <th>Werbung</th>
              <th className="r"> </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={6} className="ui-meta" style={{ padding: 18 }}>Keine Kunden gefunden.</td></tr>
            )}
            {rows.map((c) => {
              const n = c._count.bookings;
              const returning = n >= RETURNING_MIN_BOOKINGS;
              const last = c.bookings[0];
              return (
                <tr key={c.id}>
                  <td>
                    <b>{c.firstName} {c.lastName}</b>{c.company ? ` · ${c.company}` : ""}
                    <div className="ui-meta">{c.email}</div>
                  </td>
                  <td>{c.phone ? <a href={`tel:${c.phone}`}>{c.phone}</a> : "—"}</td>
                  <td>{last ? <span className="ui-plate">{last.plate}</span> : "—"}</td>
                  <td>
                    {n}
                    {returning && <> <span className="ui-chip info">Stammkunde</span></>}
                    {last && <div className="ui-meta">zuletzt {formatBerlin(last.arrivalAt)}</div>}
                  </td>
                  <td>
                    <span className="ui-chips" style={{ marginTop: 0 }}>
                      {c.emailOptOutAt ? <span className="ui-chip warn">abgemeldet</span> : <span className="ui-chip ok">E-Mail</span>}
                      {c.smsOptInAt && !c.smsOptOutAt && <span className="ui-chip ok">SMS</span>}
                    </span>
                  </td>
                  <td className="r"><Link className="btn soft sm" href={`/admin/bookings?customer=${c.id}`}>Buchungen →</Link></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Pager basePath="/admin/customers" params={{ q: q || null }} page={page} total={total} pageSize={PAGE_SIZE} />
    </div>
  );
}
