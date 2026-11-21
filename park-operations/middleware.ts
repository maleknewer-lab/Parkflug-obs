import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// First gate only. Server components and API handlers must still call requireRole()/requirePath().
export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|img/|.*\\.(?:svg|png|jpg|jpeg|webp|ico|css|js)$).*)"],
};
