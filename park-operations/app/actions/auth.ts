"use server";

import { AuthError } from "next-auth";
import { auth, signIn, signOut } from "@/auth";
import { endShift } from "@/lib/shifts";

export type LoginState = { error?: string };

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  try {
    await signIn("credentials", {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      redirectTo: "/", // "/" sends each role to its own home page
    });
  } catch (e) {
    if (e instanceof AuthError) return { error: "E-Mail oder Passwort ist falsch." };
    throw e; // the redirect after a successful login is thrown too — must pass through
  }
  return {};
}

/** "Schicht beenden & abmelden". */
export async function logoutAction() {
  const session = await auth();
  if (session?.user?.id) await endShift(session.user.id);
  await signOut({ redirectTo: "/login" });
}
