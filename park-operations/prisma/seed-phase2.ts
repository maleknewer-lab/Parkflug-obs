// prisma/seed-phase2.ts
// Phase 2 seed: brands, lots, rates, base price tables, extras.
// ALL PRICES ARE PLACEHOLDERS (names start with "[PLACEHOLDER]") — replace in /admin before real use.
// Idempotent: safe to run more than once. Run: npx tsx prisma/seed-phase2.ts
import { PrismaClient, LotType, Service } from "@prisma/client";

const prisma = new PrismaClient();

// PLACEHOLDER curve: days 1–7 grow fast, then slower. Integer cents.
function placeholderDayPrices(startCents: number): number[] {
  return Array.from({ length: 30 }, (_, i) => {
    const n = i + 1;
    return n <= 7
      ? startCents + (n - 1) * 700
      : startCents + 6 * 700 + (n - 7) * 500;
  });
}

async function upsertBrand(slug: string, name: string, domain: string) {
  return prisma.brand.upsert({
    where: { slug },
    update: {},
    create: { slug, name, domain },
  });
}

async function ensureLocation(brandId: string, name: string, type: LotType) {
  const found = await prisma.location.findFirst({ where: { brandId, name } });
  return (
    found ??
    prisma.location.create({ data: { brandId, name, type, capacity: 100 } })
  );
}

async function ensureRate(
  brandId: string,
  locationId: string,
  name: string,
  service: Service,
  lotType: LotType,
  startCents: number,
  sort: number,
) {
  let rate = await prisma.rate.findFirst({ where: { brandId, name } });
  if (!rate) {
    rate = await prisma.rate.create({
      data: { brandId, locationId, name, service, lotType, sort },
    });
  }
  // One base table (seasonId = null) per rate — see partial unique index in the migration.
  const base = await prisma.priceTable.findFirst({
    where: { rateId: rate.id, seasonId: null },
  });
  if (!base) {
    await prisma.priceTable.create({
      data: {
        rateId: rate.id,
        seasonId: null,
        dayPriceCents: placeholderDayPrices(startCents),
        extraDayCents: 500,
      },
    });
  }
  return rate;
}

async function ensureExtra(brandId: string, name: string, priceCents: number) {
  const found = await prisma.extra.findFirst({ where: { brandId, name } });
  return found ?? prisma.extra.create({ data: { brandId, name, priceCents } });
}

async function main() {
  const parkflug = await upsertBrand("parkflug", "ParkFlug", "parkflug.de");
  const valet = await upsertBrand("dus-valet", "DUS Valet", "dus-valet.de");

  const pfOutdoor = await ensureLocation(parkflug.id, "Außenparkplatz", LotType.OUTDOOR);
  const pfGarage = await ensureLocation(parkflug.id, "Parkhaus", LotType.GARAGE);
  const dvOutdoor = await ensureLocation(valet.id, "Außenparkplatz", LotType.OUTDOOR);

  await ensureRate(parkflug.id, pfOutdoor.id, "[PLACEHOLDER] Shuttle Außenparkplatz", Service.SHUTTLE, LotType.OUTDOOR, 1200, 1);
  await ensureRate(parkflug.id, pfGarage.id, "[PLACEHOLDER] Shuttle Parkhaus", Service.SHUTTLE, LotType.GARAGE, 1800, 2);
  await ensureRate(valet.id, dvOutdoor.id, "[PLACEHOLDER] Valet", Service.VALET, LotType.OUTDOOR, 1800, 1);

  await ensureExtra(parkflug.id, "[PLACEHOLDER] Autowäsche", 1500);
  await ensureExtra(valet.id, "[PLACEHOLDER] Autowäsche", 1500);

  console.log("Phase 2 seed done (placeholder prices).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
