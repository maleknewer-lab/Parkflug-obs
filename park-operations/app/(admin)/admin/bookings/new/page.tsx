import Link from "next/link";
import { notFound } from "next/navigation";
import { createBookingAction } from "@/app/actions/bookings";
import { allowedBrandIds, requireOffice } from "@/lib/booking/auth";
import { db } from "@/lib/db";
import { LOT_LABEL, Message, SERVICE_LABEL } from "../../rates/ui";
import { BookingFields } from "../fields";

function RateIcon({ service }: { service: "SHUTTLE" | "VALET" }) {
  return service === "VALET" ? (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 17h14M6 17l1.5-6h9L18 17M8 17v2M16 17v2M9 11l1-3h4l1 3" />
    </svg>
  ) : (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="12" rx="2" /><path d="M3 11h18M7 17v2M17 17v2" />
    </svg>
  );
}

// New booking (admin + dispo), laid out like the prototype. Step 1: pick the rate. Step 2: the form for that rate.
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
        <div className="ui-ph">
          <div>
            <Link href="/admin/bookings" className="ui-back">← Buchungen</Link>
            <h1>Neue Buchung</h1>
            <p>Zuerst den Tarif wählen.</p>
          </div>
        </div>
        <Message error={sp.error} />
        <div className="card pad">
          <div className="ui-step-h" style={{ counterReset: "step" }}>Tarif</div>
          {rates.length === 0 && <div className="ui-meta">Keine aktiven Tarife mit Preisen vorhanden.</div>}
          <div className="ui-ratecards">
            {rates.map((r) => (
              <Link key={r.id} href={`/admin/bookings/new?rateId=${r.id}`} className="ui-ratecard">
                <span className="ic"><RateIcon service={r.service} /></span>
                <span>
                  <b>{r.name}</b>
                  <span className="sub">{r.brand.name} · {SERVICE_LABEL[r.service]} · {LOT_LABEL[r.lotType]}</span>
                </span>
                <span className="ui-meta">Wählen →</span>
              </Link>
            ))}
          </div>
        </div>
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
      <div className="ui-ph">
        <div>
          <Link href="/admin/bookings/new" className="ui-back">← Anderen Tarif wählen</Link>
          <h1>Neue Buchung</h1>
          <p>{rate.brand.name} · {rate.name} · {SERVICE_LABEL[rate.service]} · {LOT_LABEL[rate.lotType]}</p>
        </div>
      </div>

      <Message error={sp.error} />

      <form action={createBookingAction} className="card pad ui-steps">
        <input type="hidden" name="rateId" value={rate.id} />
        <BookingFields seatsEnabled={seatsEnabled} extras={extras} />
        <div className="ui-btn-row">
          <button className="btn go" type="submit">Buchung anlegen</button>
          <Link className="btn soft" href="/admin/bookings">Abbrechen</Link>
        </div>
      </form>
    </div>
  );
}
