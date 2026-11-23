// Access helpers for the booking admin. ONE place to adapt if lib/session works differently:
// requireOffice() must (a) redirect when the user may not open /admin/bookings (admin + dispo only,
// per lib/permissions.ts) and (b) return the current user (with `id`).
import { db } from "@/lib/db";
import { requirePath } from "@/lib/session";

export async function requireOffice() {
  return requirePath("/admin/bookings");
}

/** Brands this user may work with: "all" or a list of brand ids (User.allBrands / User.brands). */
export async function allowedBrandIds(userId: string): Promise<string[] | "all"> {
  const u = await db.user.findUnique({
    where: { id: userId },
    select: { allBrands: true, brands: { select: { id: true } } },
  });
  if (!u) return [];
  return u.allBrands ? "all" : u.brands.map((b) => b.id);
}

export function brandAllowed(allowed: string[] | "all", brandId: string): boolean {
  return allowed === "all" || allowed.includes(brandId);
}
