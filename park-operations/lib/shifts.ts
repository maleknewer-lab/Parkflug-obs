import { db } from "@/lib/db";

/** A shift starts automatically at login. Keeps an already open shift (e.g. second device). */
export async function startShift(userId: string) {
  const open = await db.shift.findFirst({ where: { userId, endedAt: null } });
  return open ?? db.shift.create({ data: { userId } });
}

/** "End shift & log out", and when the admin deactivates a login. */
export async function endShift(userId: string) {
  await db.shift.updateMany({ where: { userId, endedAt: null }, data: { endedAt: new Date() } });
}
