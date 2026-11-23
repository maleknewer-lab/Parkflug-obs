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
import { inputStyle } from "../rates/ui";
import { Pager } from "../bookings/pager";

// Customers list (admin + dispo). Customers with several bookings are flagged "Stammkunde".
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
        bookings: { orderBy: { arrivalAt: "desc" }, take: 1, select: { arrivalAt: true } },
      },
    }),
  ]);

  return (
    <div className="page">
      <h1 style={{ margin: 0 }}>Kunden</h1>

      <form method="get" className="card pad" style={{ display: "grid", gap: 12 }}>
        <input type="search" name="q" defaultValue={q} placeholder="Suche: Name, E-Mail, Telefon, Firma …" style={inputStyle} />
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" type="submit">Suchen</button>
          <Link className="btn" href="/admin/customers">Zurücksetzen</Link>
        </div>
      </form>

      <span className="muted">{total} {total === 1 ? "Kunde" : "Kunden"}</span>

      {rows.length === 0 && <div className="card pad">Keine Kunden gefunden.</div>}
      {rows.map((c) => {
        const n = c._count.bookings;
        const returning = n >= RETURNING_MIN_BOOKINGS;
        return (
          <div key={c.id} className="card pad" style={{ display: "grid", gap: 2 }}>
            <span>
              <b>{c.firstName} {c.lastName}</b>{c.company ? ` · ${c.company}` : ""}
            </span>
            <span className="muted">{c.email}</span>
            {c.phone && <a href={`tel:${c.phone}`}>{c.phone}</a>}
            <span className="muted">
              {returning ? `Stammkunde · ${n} Buchungen` : `${n} ${n === 1 ? "Buchung" : "Buchungen"}`}
              {c.bookings[0] ? ` · zuletzt ${formatBerlin(c.bookings[0].arrivalAt)}` : ""}
            </span>
            <Link href={`/admin/bookings?customer=${c.id}`}>Buchungen anzeigen →</Link>
          </div>
        );
      })}

      <Pager basePath="/admin/customers" params={{ q: q || null }} page={page} total={total} pageSize={PAGE_SIZE} />
    </div>
  );
}
