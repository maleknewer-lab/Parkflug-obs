import Link from "next/link";
import { notFound } from "next/navigation";
import { savePriceTableAction, updateRateAction } from "@/app/actions/rates";
import { db } from "@/lib/db";
import { formatEuro } from "@/lib/rates/form";
import { requireRole } from "@/lib/session";
import { Check, Field, LOT_LABEL, Message, SERVICE_LABEL, TriSelect, grid } from "../ui";

// One rate: its settings and its base price table (1–30 days + price per extra day).
// Season price lists come in Phase 7; the table structure already allows them.
export default async function RatePage({
  params,
  searchParams,
}: {
  params: Promise<{ rateId: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  await requireRole("admin");
  const { rateId } = await params;
  const sp = await searchParams;

  const rate = await db.rate.findUnique({
    where: { id: rateId },
    include: { brand: true, location: true, priceTables: { where: { seasonId: null } } },
  });
  if (!rate) notFound();
  const table = rate.priceTables[0];
  const b = rate.brand;

  return (
    <div className="page">
      <div className="ui-ph">
        <div>
          <Link href={`/admin/rates?brand=${b.id}`} className="ui-back">← Tarife &amp; Preise</Link>
          <h1>{rate.name}</h1>
          <p>{b.name} · {SERVICE_LABEL[rate.service]} · {LOT_LABEL[rate.lotType]} · {rate.location.name}</p>
        </div>
        <span className={`ui-chip ${rate.active ? "ok" : "warn"}`}>{rate.active ? "aktiv" : "inaktiv"}</span>
      </div>

      <Message saved={sp.saved} error={sp.error} />

      <form action={savePriceTableAction} className="card pad ui-stack">
        <input type="hidden" name="id" value={rate.id} />
        <div className="ui-sec-t">Preisliste (ganzjährig)</div>
        <span className="ui-meta">
          Preis für die gesamte Dauer, Anreise- und Abreisetag zählen mit. Alle 30 Felder müssen ausgefüllt sein.
        </span>
        <div className="ui-ptable">
          {Array.from({ length: 30 }, (_, i) => (
            <label key={i}>
              {i + 1} {i === 0 ? "Tag" : "Tage"}
              <input name={`d${i + 1}`} inputMode="decimal" autoComplete="off" defaultValue={table ? formatEuro(table.dayPriceCents[i]) : ""} />
            </label>
          ))}
          <label>
            Jeder weitere
            <input name="extra" inputMode="decimal" autoComplete="off" defaultValue={table ? formatEuro(table.extraDayCents) : ""} />
          </label>
        </div>
        <div><button className="btn" type="submit">Preise speichern</button></div>
      </form>

      <form action={updateRateAction} className="card pad ui-stack">
        <input type="hidden" name="id" value={rate.id} />
        <div className="ui-sec-t">Einstellungen des Tarifs</div>
        <div className="ui-kgrid">
          <Field text label="Name" name="name" defaultValue={rate.name} required />
          <Field label="Sortierung" name="sort" defaultValue={rate.sort} />
          <Check label="Aktiv (buchbar)" name="active" checked={rate.active} />
        </div>

        <div className="ui-sec-t" style={{ marginTop: 6 }}>Abweichungen von der Marke</div>
        <span className="ui-meta">Leer lassen = Wert der Marke gilt.</span>
        <div style={grid}>
          <Field label="Inklusive Personen" name="personsIncluded" defaultValue={rate.personsIncluded ?? ""} placeholder={String(b.personsIncluded)} />
          <Field label="Preis je weitere Person (€)" name="extraPersonPrice" defaultValue={rate.extraPersonPriceCents === null ? "" : formatEuro(rate.extraPersonPriceCents)} placeholder={formatEuro(b.extraPersonPriceCents)} />
          <Field label="Preis je Kindersitz (€)" name="seatPrice" defaultValue={rate.seatPriceCents === null ? "" : formatEuro(rate.seatPriceCents)} placeholder={formatEuro(b.seatPriceCents)} />
          <Field label="Aufschlag Übergröße (%)" name="oversizeSurchargePct" defaultValue={rate.oversizeSurchargePct ?? ""} placeholder={String(b.oversizeSurchargePct)} />
          <TriSelect label="Kinder zählen als Personen" name="kidsCountAsPerson" value={rate.kidsCountAsPerson} brandValue={b.kidsCountAsPerson} />
          <TriSelect label="Kindersitze anbieten" name="seatsEnabled" value={rate.seatsEnabled} brandValue={b.seatsEnabled} />
        </div>
        <div><button className="btn" type="submit">Einstellungen speichern</button></div>
      </form>
    </div>
  );
}
