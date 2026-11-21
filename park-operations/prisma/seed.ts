/**
 * Seed with FAKE data only (CLAUDE.md rule 3). Dev/staging only.
 * Password: SEED_PASSWORD from .env, otherwise a random one is generated and printed once.
 * DUS Valet values are PLACEHOLDERS until Fawaz enters the real ones in the admin (open question, Phase 9).
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";

const db = new PrismaClient();

async function main() {
  const password = process.env.SEED_PASSWORD ?? randomBytes(9).toString("base64url");
  const passwordHash = await bcrypt.hash(password, 12);

  // Brands
  const parkflug = await db.brand.upsert({
    where: { slug: "parkflug" },
    update: {},
    create: { slug: "parkflug", name: "ParkFlug", domain: "parkflug.de", colors: { brand: "#1c1c1e", accent: "#e0731f" } },
  });
  const valet = await db.brand.upsert({
    where: { slug: "dus-valet" },
    update: {},
    create: { slug: "dus-valet", name: "DUS Valet", domain: "dus-valet.de" }, // placeholder rules = ParkFlug defaults
  });

  if ((await db.location.count()) > 0) {
    console.log("Lots/rates already seeded — skipping them.");
  } else {
  // Lots
  const outdoor = await db.location.create({ data: { brandId: parkflug.id, name: "Außenparkplatz", type: "OUTDOOR", capacity: 120 } });
  const garage = await db.location.create({ data: { brandId: parkflug.id, name: "Parkhaus", type: "GARAGE", capacity: 80 } });
  const valetLot = await db.location.create({ data: { brandId: valet.id, name: "Außenparkplatz (Valet)", type: "OUTDOOR", capacity: 60 } });

  // Rates + a clearly fake base price list (day n costs 8 + 3n EUR; extra day 3 EUR)
  const fakeDays = Array.from({ length: 30 }, (_, i) => (8 + 3 * (i + 1)) * 100);
  for (const [brandId, locationId, name, service, lotType] of [
    [parkflug.id, outdoor.id, "Shuttle Außenparkplatz", "SHUTTLE", "OUTDOOR"],
    [parkflug.id, garage.id, "Shuttle Parkhaus", "SHUTTLE", "GARAGE"],
    [valet.id, valetLot.id, "Valet", "VALET", "OUTDOOR"],
  ] as const) {
    const rate = await db.rate.create({ data: { brandId, locationId, name, service, lotType } });
    await db.priceTable.create({ data: { rateId: rate.id, seasonId: null, dayPriceCents: fakeDays, extraDayCents: 300 } });
  }

  }

  // One user per role (fake addresses)
  const users = [
    { email: "admin@example.test", name: "Test Admin", role: "admin" },
    { email: "dispo@example.test", name: "Test Büro", role: "dispo" },
    { email: "fahrer@example.test", name: "Test Fahrer", role: "fahrer" },
  ] as const;
  for (const u of users) {
    await db.user.upsert({ where: { email: u.email }, update: {}, create: { ...u, passwordHash } });
  }

  console.log("Seed done. Users:", users.map((u) => u.email).join(", "));
  if (!process.env.SEED_PASSWORD) console.log("Generated password (shown once):", password);
}

main().finally(() => db.$disconnect());
