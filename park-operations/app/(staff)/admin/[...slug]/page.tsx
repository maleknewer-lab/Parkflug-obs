import { notFound } from "next/navigation";
import { ComingSoon } from "@/components/coming-soon";
import { NAV_ITEMS } from "@/lib/permissions";
import { requirePath } from "@/lib/session";

const PHASE: Record<string, string> = {
  uebersicht: "Phase 4", transfers: "Phase 4", kasse: "Phase 4",
  buchungen: "Phase 2", kunden: "Phase 2", tarife: "Phase 2",
  rechnungen: "Phase 5", auswertung: "Phase 5",
  belegung: "Phase 7", marketing: "Phase 7", mitarbeiter: "Phase 4",
};

// Placeholder for admin pages that are built in later phases. The permission check is already real.
export default async function AdminPlaceholder({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const path = "/admin/" + slug.join("/");
  await requirePath(path); // wrong role → redirect to the role's home

  const item = NAV_ITEMS.find((i) => path === i.href || path.startsWith(i.href + "/"));
  if (!item) notFound();
  return <ComingSoon title={item.label} phase={`${PHASE[item.key] ?? "Später"}`} />;
}
