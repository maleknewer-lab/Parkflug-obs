"use server";

// Payment accounts (admin only). Stores NON-secret settings only: name, URL slug and the environment key
// NAME that says which environment variables hold the Stripe keys. The keys themselves never enter the database.

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { diffFields } from "@/lib/booking";
import { db } from "@/lib/db";
import { isValidEnvKey } from "@/lib/stripe/env";
import { requireRole } from "@/lib/session";

const LIST = "/admin/payment-accounts";
const text = (fd: FormData, n: string) => String(fd.get(n) ?? "").trim();

function back(kind: "saved" | "error", message: string): never {
  revalidatePath(LIST);
  revalidatePath("/admin/rates");
  redirect(`${LIST}?${kind}=${encodeURIComponent(message)}`);
}

function parseFields(fd: FormData) {
  const name = text(fd, "name");
  if (name.length < 2 || name.length > 60) back("error", "Name: 2–60 Zeichen");
  const slug = text(fd, "slug").toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,39}$/.test(slug)) back("error", "Kürzel: 2–40 Zeichen, nur a–z, 0–9 und Bindestrich");
  const envKey = text(fd, "envKey").toUpperCase();
  if (!isValidEnvKey(envKey)) back("error", "Schlüssel-Name: DEFAULT oder GROSSBUCHSTABEN/ZIFFERN/_ (2–40 Zeichen)");
  return { name, slug, envKey };
}

async function log(userId: string, id: string, action: string, changes: Record<string, { from: unknown; to: unknown }>) {
  if (Object.keys(changes).length === 0) return;
  await db.activityLog.create({
    data: { userId, entity: "PaymentAccount", entityId: id, action, changes: changes as unknown as Prisma.InputJsonObject },
  });
}

export async function createPaymentAccountAction(fd: FormData) {
  const me = await requireRole("admin");
  const f = parseFields(fd);
  if (await db.paymentAccount.findUnique({ where: { slug: f.slug }, select: { id: true } })) back("error", "Dieses Kürzel gibt es schon");
  const a = await db.paymentAccount.create({ data: f });
  await log(me.id, a.id, "create", { name: { from: null, to: f.name }, slug: { from: null, to: f.slug }, envKey: { from: null, to: f.envKey } });
  back("saved", `${f.name} angelegt`);
}

export async function updatePaymentAccountAction(fd: FormData) {
  const me = await requireRole("admin");
  const id = text(fd, "id");
  const old = await db.paymentAccount.findUnique({ where: { id } });
  if (!old) back("error", "Konto nicht gefunden");
  const f = parseFields(fd);
  const active = fd.get("active") === "on";
  const clash = await db.paymentAccount.findFirst({ where: { slug: f.slug, NOT: { id } }, select: { id: true } });
  if (clash) back("error", "Dieses Kürzel gibt es schon");
  const next = { ...f, active };
  const changes = diffFields(old, next, Object.keys(next) as (keyof typeof next)[]);
  await db.paymentAccount.update({ where: { id }, data: next });
  await log(me.id, id, "update", changes);
  back("saved", `${f.name} gespeichert`);
}
