"use server";

// Price administration (admin only). Every action re-checks the role on the server,
// validates the input, writes an ActivityLog entry (old → new) and redirects back with a message.

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { diffFields } from "@/lib/booking";
import { parseOptionalHttpsUrl } from "@/lib/booking/legal-links";
import { db } from "@/lib/db";
import {
  parseEuro,
  parseIntIn,
  parseOptionalEuro,
  parseOptionalInt,
  parsePriceTable,
  parseTriBool,
} from "@/lib/rates/form";
import { requireRole } from "@/lib/session";

const LIST = "/admin/rates";

function text(fd: FormData, name: string): string {
  return String(fd.get(name) ?? "").trim();
}

function back(path: string, kind: "saved" | "error", message = "1"): never {
  revalidatePath(LIST);
  revalidatePath(path);
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}${kind}=${encodeURIComponent(message)}`);
}

async function log(
  userId: string,
  entity: string,
  entityId: string,
  action: string,
  changes: Record<string, { from: unknown; to: unknown }>,
) {
  if (Object.keys(changes).length === 0) return;
  await db.activityLog.create({
    data: { userId, entity, entityId, action, changes: changes as unknown as Prisma.InputJsonObject },
  });
}

// ───────── Brand settings ─────────
const BRAND_LABELS = {
  personsIncluded: "Inklusive Personen",
  extraPersonPriceCents: "Preis je weitere Person",
  seatPriceCents: "Preis je Kindersitz",
  oversizeSurchargePct: "Aufschlag Übergröße",
  minLeadHours: "Mindestvorlauf (Stunden)",
  freeCancelHours: "Kostenlose Stornierung (Stunden)",
  overstayFeeGarageCents: "Überziehung Parkhaus",
  overstayFeeOutdoorCents: "Überziehung Außenparkplatz",
  returningDiscountPct: "Stammkunden-Rabatt",
} as const;

export async function updateBrandSettingsAction(fd: FormData) {
  const me = await requireRole("admin");
  const id = text(fd, "id");
  const brand = await db.brand.findUnique({ where: { id } });
  if (!brand) back(LIST, "error", "Marke nicht gefunden");

  const parsed = {
    personsIncluded: parseIntIn(text(fd, "personsIncluded"), 1, 20),
    extraPersonPriceCents: parseEuro(text(fd, "extraPersonPrice")),
    seatPriceCents: parseEuro(text(fd, "seatPrice")),
    oversizeSurchargePct: parseIntIn(text(fd, "oversizeSurchargePct"), 0, 100),
    minLeadHours: parseIntIn(text(fd, "minLeadHours"), 0, 168),
    freeCancelHours: parseIntIn(text(fd, "freeCancelHours"), 0, 720),
    overstayFeeGarageCents: parseEuro(text(fd, "overstayFeeGarage")),
    overstayFeeOutdoorCents: parseEuro(text(fd, "overstayFeeOutdoor")),
    returningDiscountPct: parseIntIn(text(fd, "returningDiscountPct"), 0, 100),
  };
  const invalid = (Object.keys(parsed) as (keyof typeof parsed)[]).find((k) => parsed[k] === null);
  if (invalid) back(LIST, "error", `${brand.name}: ungültiger Wert bei „${BRAND_LABELS[invalid]}“`);

  const next = {
    ...(parsed as Record<keyof typeof parsed, number>),
    kidsCountAsPerson: fd.get("kidsCountAsPerson") === "on",
    seatsEnabled: fd.get("seatsEnabled") === "on",
  };

  const changes = diffFields(brand, next, Object.keys(next) as (keyof typeof next)[]);
  await db.brand.update({ where: { id }, data: next });
  await log(me.id, "Brand", id, "update_settings", changes);
  back(LIST, "saved", `${brand.name} gespeichert`);
}

// ───────── Brand: legal links & online booking ─────────
// AGB / Impressum / Datenschutz live on the brand's WordPress site; the public booking pages link to them.
export async function updateBrandLinksAction(fd: FormData) {
  const me = await requireRole("admin");
  const id = text(fd, "id");
  const brand = await db.brand.findUnique({ where: { id } });
  if (!brand) back(LIST, "error", "Marke nicht gefunden");

  const urls = {
    impressumUrl: parseOptionalHttpsUrl(text(fd, "impressumUrl")),
    privacyUrl: parseOptionalHttpsUrl(text(fd, "privacyUrl")),
    termsUrl: parseOptionalHttpsUrl(text(fd, "termsUrl")),
  };
  const labels = { impressumUrl: "Impressum", privacyUrl: "Datenschutz", termsUrl: "AGB" } as const;
  const badUrl = (Object.keys(urls) as (keyof typeof urls)[]).find((k) => urls[k] === undefined);
  if (badUrl) back(LIST, "error", `${brand.name}: „${labels[badUrl]}“ muss eine vollständige https://-Adresse sein`);

  const hold = parseIntIn(text(fd, "unpaidHoldMinutes"), 5, 1440);
  if (hold === null) back(LIST, "error", `${brand.name}: Frist für unbezahlte Online-Buchungen: 5–1440 Minuten`);

  const next = {
    impressumUrl: urls.impressumUrl as string | null,
    privacyUrl: urls.privacyUrl as string | null,
    termsUrl: urls.termsUrl as string | null,
    unpaidHoldMinutes: hold,
  };
  const changes = diffFields(brand, next, Object.keys(next) as (keyof typeof next)[]);
  await db.brand.update({ where: { id }, data: next });
  await log(me.id, "Brand", id, "update_links", changes);
  back(LIST, "saved", `${brand.name}: Links gespeichert`);
}

// ───────── Rates ─────────
export async function createRateAction(fd: FormData) {
  const me = await requireRole("admin");
  const brandId = text(fd, "brandId");
  const locationId = text(fd, "locationId");
  const name = text(fd, "name");
  const service = text(fd, "service");

  if (name.length < 2 || name.length > 80) back(LIST, "error", "Name des Tarifs: 2–80 Zeichen");
  const serviceValue = service === "SHUTTLE" ? "SHUTTLE" : service === "VALET" ? "VALET" : null;
  if (!serviceValue) back(LIST, "error", "Service ungültig");
  const location = await db.location.findFirst({ where: { id: locationId, brandId } });
  if (!location) back(LIST, "error", "Standort gehört nicht zu dieser Marke");

  const count = await db.rate.count({ where: { brandId } });
  // New rates start INACTIVE and without prices: they cannot be sold until prices are saved.
  const rate = await db.rate.create({
    data: { brandId, locationId, name, service: serviceValue, lotType: location.type, active: false, sort: count + 1 },
  });
  await log(me.id, "Rate", rate.id, "create", { name: { from: null, to: name } });
  back(`${LIST}/${rate.id}`, "saved", "Tarif angelegt – jetzt Preise eintragen");
}

export async function updateRateAction(fd: FormData) {
  const me = await requireRole("admin");
  const id = text(fd, "id");
  const path = `${LIST}/${id}`;
  const rate = await db.rate.findUnique({
    where: { id },
    include: { priceTables: { where: { seasonId: null } } },
  });
  if (!rate) back(LIST, "error", "Tarif nicht gefunden");

  const name = text(fd, "name");
  const sort = parseIntIn(text(fd, "sort"), 0, 999);
  const overrides = {
    personsIncluded: parseOptionalInt(text(fd, "personsIncluded"), 1, 20),
    extraPersonPriceCents: parseOptionalEuro(text(fd, "extraPersonPrice")),
    seatPriceCents: parseOptionalEuro(text(fd, "seatPrice")),
    oversizeSurchargePct: parseOptionalInt(text(fd, "oversizeSurchargePct"), 0, 100),
    kidsCountAsPerson: parseTriBool(text(fd, "kidsCountAsPerson")),
    seatsEnabled: parseTriBool(text(fd, "seatsEnabled")),
  };
  if (name.length < 2 || name.length > 80) back(path, "error", "Name: 2–80 Zeichen");
  if (sort === null) back(path, "error", "Sortierung: Zahl 0–999");
  const { personsIncluded, extraPersonPriceCents, seatPriceCents, oversizeSurchargePct, kidsCountAsPerson, seatsEnabled } = overrides;
  if (
    personsIncluded === undefined ||
    extraPersonPriceCents === undefined ||
    seatPriceCents === undefined ||
    oversizeSurchargePct === undefined ||
    kidsCountAsPerson === undefined ||
    seatsEnabled === undefined
  ) {
    back(path, "error", "Ungültiger Wert bei den Abweichungen");
  }

  const active = fd.get("active") === "on";
  if (active && rate.priceTables.length === 0) {
    back(path, "error", "Zuerst Preise speichern, dann aktivieren");
  }

  const next = {
    name,
    sort,
    active,
    personsIncluded,
    extraPersonPriceCents,
    seatPriceCents,
    oversizeSurchargePct,
    kidsCountAsPerson,
    seatsEnabled,
  };
  const changes = diffFields(rate, next, Object.keys(next) as (keyof typeof next)[]);
  await db.rate.update({ where: { id }, data: next });
  await log(me.id, "Rate", id, "update", changes);
  back(path, "saved", "Tarif gespeichert");
}

export async function savePriceTableAction(fd: FormData) {
  const me = await requireRole("admin");
  const id = text(fd, "id");
  const path = `${LIST}/${id}`;
  const rate = await db.rate.findUnique({
    where: { id },
    include: { priceTables: { where: { seasonId: null } } },
  });
  if (!rate) back(LIST, "error", "Tarif nicht gefunden");

  const parsed = parsePriceTable((n) => text(fd, n));
  if (!parsed.ok) back(path, "error", parsed.error);

  const data = { dayPriceCents: parsed.dayPriceCents, extraDayCents: parsed.extraDayCents };
  const existing = rate.priceTables[0];
  if (existing) {
    const changes = diffFields(existing, data, ["dayPriceCents", "extraDayCents"]);
    await db.priceTable.update({ where: { id: existing.id }, data });
    await log(me.id, "Rate", id, "update_prices", changes);
  } else {
    await db.priceTable.create({ data: { rateId: id, seasonId: null, ...data } });
    await log(me.id, "Rate", id, "create_prices", { dayPriceCents: { from: null, to: data.dayPriceCents } });
  }
  back(path, "saved", "Preise gespeichert");
}

// ───────── Extras ─────────
export async function createExtraAction(fd: FormData) {
  const me = await requireRole("admin");
  const brandId = text(fd, "brandId");
  const name = text(fd, "name");
  const price = parseEuro(text(fd, "price"));
  if (!(await db.brand.findUnique({ where: { id: brandId } }))) back(LIST, "error", "Marke nicht gefunden");
  if (name.length < 2 || name.length > 80) back(LIST, "error", "Extra: Name 2–80 Zeichen");
  if (price === null) back(LIST, "error", "Extra: ungültiger Preis");

  const extra = await db.extra.create({ data: { brandId, name, priceCents: price } });
  await log(me.id, "Extra", extra.id, "create", { name: { from: null, to: name }, priceCents: { from: null, to: price } });
  back(LIST, "saved", `Extra „${name}“ angelegt`);
}

export async function saveExtraAction(fd: FormData) {
  const me = await requireRole("admin");
  const id = text(fd, "id");
  const extra = await db.extra.findUnique({ where: { id } });
  if (!extra) back(LIST, "error", "Extra nicht gefunden");

  const name = text(fd, "name");
  const price = parseEuro(text(fd, "price"));
  if (name.length < 2 || name.length > 80) back(LIST, "error", "Extra: Name 2–80 Zeichen");
  if (price === null) back(LIST, "error", "Extra: ungültiger Preis");

  // Extras used by bookings are never deleted, only deactivated.
  const next = { name, priceCents: price, active: fd.get("active") === "on" };
  const changes = diffFields(extra, next, ["name", "priceCents", "active"]);
  await db.extra.update({ where: { id }, data: next });
  await log(me.id, "Extra", id, "update", changes);
  back(LIST, "saved", `Extra „${name}“ gespeichert`);
}
