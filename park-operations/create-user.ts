/**
 * Create or update a staff login (no passwords in code — CLAUDE.md rule 1).
 *
 * Usage:
 *   npm run user:create -- --email=ali@firma.de --name="Ali" --role=fahrer [--password=...]
 *   npm run user:create -- --email=ali@firma.de --reset            (new password for an existing user)
 *   npm run user:create -- --email=ali@firma.de --deactivate       (block login; use --activate to undo)
 *
 * Without --password a random one is generated and printed ONCE.
 * Needs DATABASE_URL (for Render: the *External* database URL, only in your own terminal).
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";

const db = new PrismaClient();
const ROLES = ["admin", "dispo", "fahrer"] as const;

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return undefined;
  return hit.includes("=") ? hit.slice(hit.indexOf("=") + 1) : "true";
}

async function main() {
  const email = arg("email")?.trim().toLowerCase();
  if (!email || !email.includes("@")) throw new Error("--email is required");

  const existing = await db.user.findUnique({ where: { email } });

  if (arg("deactivate") || arg("activate")) {
    if (!existing) throw new Error(`No user ${email}`);
    await db.user.update({ where: { email }, data: { active: !arg("deactivate") } });
    console.log(`${email} is now ${arg("deactivate") ? "DEACTIVATED" : "ACTIVE"}`);
    return;
  }

  const password = arg("password") ?? randomBytes(9).toString("base64url");
  if (password.length < 10) throw new Error("Password must have at least 10 characters");
  const passwordHash = await bcrypt.hash(password, 12);

  if (arg("reset")) {
    if (!existing) throw new Error(`No user ${email}`);
    await db.user.update({ where: { email }, data: { passwordHash } });
  } else {
    const role = arg("role") as (typeof ROLES)[number] | undefined;
    const name = arg("name")?.trim();
    if (!role || !ROLES.includes(role)) throw new Error(`--role must be one of: ${ROLES.join(", ")}`);
    if (!name) throw new Error("--name is required");
    await db.user.upsert({
      where: { email },
      update: { name, role, passwordHash, active: true },
      create: { email, name, role, passwordHash },
    });
  }
  console.log(`OK: ${email}`);
  if (!arg("password")) console.log("Generated password (shown once):", password);
}

main()
  .catch((e) => { console.error("Error:", e.message); process.exitCode = 1; })
  .finally(() => db.$disconnect());
