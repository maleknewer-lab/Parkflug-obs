"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { endShift } from "@/lib/shifts";
import { createStaffSchema, generatePassword, MIN_PASSWORD_LENGTH } from "@/lib/staff";

export type StaffState = { error?: string; ok?: string; email?: string; password?: string };

/** Admin only (checked on the server). Creates a login; the password is returned ONCE. */
export async function createStaffAction(_prev: StaffState, formData: FormData): Promise<StaffState> {
  await requireRole("admin");
  const parsed = createStaffSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    role: formData.get("role"),
    password: formData.get("password") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, email, role } = parsed.data;
  if (await db.user.findUnique({ where: { email } })) return { error: "Diese E-Mail existiert bereits." };

  const password = parsed.data.password || generatePassword();
  await db.user.create({
    data: { name, email, role: role as "admin" | "dispo" | "fahrer", passwordHash: await bcrypt.hash(password, 12) },
  });
  revalidatePath("/admin/staff");
  return { ok: "Benutzer angelegt. Passwort jetzt notieren – es wird nur einmal angezeigt.", email, password };
}

export async function resetPasswordAction(_prev: StaffState, formData: FormData): Promise<StaffState> {
  await requireRole("admin");
  const id = String(formData.get("id") ?? "");
  const custom = String(formData.get("password") ?? "").trim();
  if (custom && custom.length < MIN_PASSWORD_LENGTH) return { error: `Passwort: mindestens ${MIN_PASSWORD_LENGTH} Zeichen.` };
  const user = await db.user.findUnique({ where: { id } });
  if (!user) return { error: "Benutzer nicht gefunden." };
  const password = custom || generatePassword();
  await db.user.update({ where: { id }, data: { passwordHash: await bcrypt.hash(password, 12) } });
  return { ok: "Neues Passwort gesetzt. Nur einmal sichtbar.", email: user.email, password };
}

export async function setActiveAction(formData: FormData) {
  const me = await requireRole("admin");
  const id = String(formData.get("id") ?? "");
  const active = formData.get("active") === "true";
  if (id === me.id) return; // admin cannot lock himself out
  await db.user.update({ where: { id }, data: { active } });
  if (!active) await endShift(id); // deactivation ends an open shift (CLAUDE.md)
  revalidatePath("/admin/staff");
}
