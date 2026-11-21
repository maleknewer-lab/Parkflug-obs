import { AppShell } from "@/components/app-shell";
import { logoutAction } from "@/app/actions/auth";
import { navFor } from "@/lib/permissions";
import { ROLE_LABEL } from "@/lib/roles";
import { requireUser } from "@/lib/session";

// Shell for all staff pages (admin, driver, account). Menu = exactly what the role may open.
// Each page additionally calls requirePath()/requireRole() — hiding menu items is never the only protection.
export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <AppShell user={{ name: user.name, roleLabel: ROLE_LABEL[user.role] }} nav={navFor(user.role)} logout={logoutAction}>
      {children}
    </AppShell>
  );
}
