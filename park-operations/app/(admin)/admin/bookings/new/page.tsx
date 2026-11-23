import Link from "next/link";
import { notFound } from "next/navigation";
import { createBookingAction } from "@/app/actions/bookings";
import { allowedBrandIds, requireOffice } from "@/lib/booking/auth";
import { db } from "@/lib/db";
import { LOT_LABEL, Message, SERVICE_LABEL } from "../../rates/ui";
import { BookingFields } from "../fields";

// New booking (admin + dispo). Step 1: pick the rate. Step 2: the form for that rate.
export default async function NewBookingPage({
  searchParams,
}: {
  searchParams: Promise<{ rateId?: string; error?: string }>;
}) {
  const me = await requireOffice();
  const sp = await searchParams;
  const allowed = await allowedBrandIds(me.id);

  const rates = await db.rate.findMany({
    where: {
      active: true,
      priceTables: { some: { seasonId: null } },
      ...(allowed === "all" ? {} : { brandId: { in: allowed } }),
    },
    include: { brand: true, location: true },
    orderBy: [{ brand: { name: "asc" } }, { sort: "asc" }],
  });

  const rate = sp.rateId ? rates.find((r) => r.id === sp.rateId) : undefined;
  if (sp.rateId && !rate) notFound();

  if (!rate) {
    return (
      <div className="page">
        <h1 style={{ margin: 0 }}>Neue Buchung</h1>
        <p className="muted" style={{ margin: 0 }}>Zuerst den Tarif wählen.</p>
        <Message error={sp.error} />
        {rates.length === 0 && <div className="card pad">Keine aktiven Tarife mit Preisen vorhanden.</div>}
        {rates.map((r) => (
          <Link key={r.id} href={`/admin/bookings/new?rateId=${r.id}`} className="card pad" style={{ display: "grid", gap: 2 }}>
            <b>{r.brand.name} · {r.name}</b>
            <span className="muted">{SERVICE_LABEL[r.service]} · {LOT_LABEL[r.lotType]}</span>
          </Link>
        ))}
      </div>
    );
  }

  const extras = await db.extra.findMany({
    where: { brandId: rate.brandId, active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, priceCents: true },
  });
  const seatsEnabled = rate.seatsEnabled ?? rate.brand.seatsEnabled;

  return (
    <div className="page">
      <div>
        <Link href="/admin/bookings/new" className="muted">← Anderen Tarif wählen</Link>
        <h1 style={{ margin: "4px 0 0" }}>Neue Buchung</h1>
        <p className="muted" style={{ margin: "4px 0 0" }}>
          {rate.brand.name} · {rate.name} · {SERVICE_LABEL[rate.service]} · {LOT_LABEL[rate.lotType]}
        </p>
      </div>

      <Message error={sp.error} />

      <form action={createBookingAction} className="card pad" style={{ display: "grid", gap: 20 }}>
        <input type="hidden" name="rateId" value={rate.id} />
        <BookingFields seatsEnabled={seatsEnabled} extras={extras} />
        <button className="btn" type="submit">Buchung anlegen</button>
      </form>
    </div>
  );
}
