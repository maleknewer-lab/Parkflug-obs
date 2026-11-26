import { AppShell } from "@/components/app-shell";
import { logoutAction } from "@/app/actions/auth";
import { navFor } from "@/lib/permissions";
import { ROLE_LABEL } from "@/lib/roles";
import { requireUser } from "@/lib/session";

// Header + menu for the admin pages in this folder (bookings, customers, rates, payment accounts).
// Same shell as app/(staff)/layout.tsx. Each page still checks its own permission on the server.
export default async function AdminPagesLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <AppShell user={{ name: user.name, roleLabel: ROLE_LABEL[user.role] }} nav={navFor(user.role)} logout={logoutAction}>
      {children}
    </AppShell>
  );
}
