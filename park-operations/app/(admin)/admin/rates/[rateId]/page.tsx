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
      <div>
        <Link href="/admin/rates" className="muted">← Tarife &amp; Preise</Link>
        <h1 style={{ margin: "4px 0 0" }}>{rate.name}</h1>
        <p className="muted" style={{ margin: "4px 0 0" }}>
          {b.name} · {SERVICE_LABEL[rate.service]} · {LOT_LABEL[rate.lotType]} · {rate.location.name}
        </p>
      </div>

      <Message saved={sp.saved} error={sp.error} />

      <form action={savePriceTableAction} className="card pad" style={{ display: "grid", gap: 12 }}>
        <input type="hidden" name="id" value={rate.id} />
        <b>Preisliste (ganzjährig)</b>
        <span className="muted" style={{ fontSize: 12 }}>
          Preis für die gesamte Dauer, Anreise- und Abreisetag zählen mit. Alle 30 Felder müssen ausgefüllt sein.
        </span>
        <div style={{ ...grid, gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))" }}>
          {Array.from({ length: 30 }, (_, i) => (
            <Field
              key={i}
              label={`${i + 1} ${i === 0 ? "Tag" : "Tage"}`}
              name={`d${i + 1}`}
              defaultValue={table ? formatEuro(table.dayPriceCents[i]) : ""}
            />
          ))}
        </div>
        <Field
          label="Jeder weitere Tag ab Tag 31 (€)"
          name="extra"
          defaultValue={table ? formatEuro(table.extraDayCents) : ""}
        />
        <button className="btn" type="submit">Preise speichern</button>
      </form>

      <form action={updateRateAction} className="card pad" style={{ display: "grid", gap: 12 }}>
        <input type="hidden" name="id" value={rate.id} />
        <b>Einstellungen des Tarifs</b>
        <div style={grid}>
          <Field text label="Name" name="name" defaultValue={rate.name} required />
          <Field label="Sortierung" name="sort" defaultValue={rate.sort} />
        </div>
        <Check label="Aktiv (buchbar)" name="active" checked={rate.active} />

        <b>Abweichungen von der Marke</b>
        <span className="muted" style={{ fontSize: 12 }}>Leer lassen = Wert der Marke gilt.</span>
        <div style={grid}>
          <Field label="Inklusive Personen" name="personsIncluded" defaultValue={rate.personsIncluded ?? ""} placeholder={String(b.personsIncluded)} />
          <Field label="Preis je weitere Person (€)" name="extraPersonPrice" defaultValue={rate.extraPersonPriceCents === null ? "" : formatEuro(rate.extraPersonPriceCents)} placeholder={formatEuro(b.extraPersonPriceCents)} />
          <Field label="Preis je Kindersitz (€)" name="seatPrice" defaultValue={rate.seatPriceCents === null ? "" : formatEuro(rate.seatPriceCents)} placeholder={formatEuro(b.seatPriceCents)} />
          <Field label="Aufschlag Übergröße (%)" name="oversizeSurchargePct" defaultValue={rate.oversizeSurchargePct ?? ""} placeholder={String(b.oversizeSurchargePct)} />
          <TriSelect label="Kinder zählen als Personen" name="kidsCountAsPerson" value={rate.kidsCountAsPerson} brandValue={b.kidsCountAsPerson} />
          <TriSelect label="Kindersitze anbieten" name="seatsEnabled" value={rate.seatsEnabled} brandValue={b.seatsEnabled} />
        </div>
        <button className="btn" type="submit">Einstellungen speichern</button>
      </form>
    </div>
  );
}
