import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { ROLE_HOME } from "@/lib/permissions";

export default async function Home() {
  const user = await requireUser();
  redirect(ROLE_HOME[user.role]);
}
