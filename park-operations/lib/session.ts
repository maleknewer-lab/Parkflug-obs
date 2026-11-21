import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { canAccess, ROLE_HOME, type Role } from "@/lib/permissions";

export type CurrentUser = { id: string; name: string; email: string; role: Role };

/**
 * Current user from the session, re-checked against the database on every call so that
 * a deactivated login stops working immediately (the JWT alone would stay valid).
 */
export async function requireUser(): Promise<CurrentUser> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, role: true, active: true },
  });
  if (!user || !user.active) redirect("/logout?reason=inactive");
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

/** For pages/layouts: user must be allowed to open this path, else redirect to the role's home. */
export async function requirePath(pathname: string): Promise<CurrentUser> {
  const user = await requireUser();
  if (!canAccess(user.role, pathname)) redirect(ROLE_HOME[user.role]);
  return user;
}

/** For pages/layouts: user must have one of these roles. */
export async function requireRole(...roles: Role[]): Promise<CurrentUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect(ROLE_HOME[user.role]);
  return user;
}

/** For API route handlers: returns the user, or a 401/403 Response to return immediately. */
export async function requireApiRole(...roles: Role[]): Promise<CurrentUser | Response> {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, role: true, active: true },
  });
  if (!user || !user.active) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!roles.includes(user.role)) return Response.json({ error: "forbidden" }, { status: 403 });
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}
