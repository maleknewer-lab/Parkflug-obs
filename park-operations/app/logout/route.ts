import { auth, signOut } from "@/auth";
import { endShift } from "@/lib/shifts";

// Used when a deactivated user still holds a valid session cookie (see requireUser()).
export async function GET() {
  const session = await auth();
  if (session?.user?.id) await endShift(session.user.id);
  await signOut({ redirectTo: "/login?error=inactive" });
}
