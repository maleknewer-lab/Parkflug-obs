// "Is a staff member logged in?" for PUBLIC pages. Unlike requireUser() it never redirects:
// a visitor simply gets null. Used to show the staff menu on the booking pages and diagnostics for testing.
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { navFor, type NavItem } from "@/lib/permissions";
import { ROLE_LABEL } from "@/lib/roles";

export type OptionalStaff = { name: string; roleLabel: string; nav: NavItem[] };

export async function optionalStaff(): Promise<OptionalStaff | null> {
  try {
    const session = await auth();
    if (!session?.user?.id) return null;
    const u = await db.user.findUnique({ where: { id: session.user.id }, select: { name: true, role: true, active: true } });
    if (!u || !u.active) return null;
    return { name: u.name, roleLabel: ROLE_LABEL[u.role], nav: navFor(u.role) };
  } catch {
    return null; // a broken session must never break the public page
  }
}
