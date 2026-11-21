import { requirePath } from "@/lib/session";
import { ComingSoon } from "@/components/coming-soon";

export default async function DriverHome() {
  await requirePath("/driver");
  return <ComingSoon title="Fahrer-App" phase="Phase 4" note="Heute: Ankünfte und Abholungen, Check-in/Check-out." />;
}
