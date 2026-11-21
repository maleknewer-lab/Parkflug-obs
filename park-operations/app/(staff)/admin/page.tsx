import { requirePath } from "@/lib/session";
import { ROLE_LABEL } from "@/lib/roles";
import { canSeeRevenue } from "@/lib/permissions";
import { ComingSoon } from "@/components/coming-soon";

export default async function AdminHome() {
  const user = await requirePath("/admin");
  return (
    <ComingSoon
      title={`Hallo ${user.name.split(" ")[0]}`}
      phase="Übersicht · Phase 4"
      note={`Angemeldet als ${ROLE_LABEL[user.role]}${canSeeRevenue(user.role) ? " · Umsatz & Diagramm sichtbar" : " · ohne Gesamtumsatz"}.`}
    />
  );
}
