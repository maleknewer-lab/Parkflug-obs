// Edge-safe part of the Auth.js config (no database, no bcrypt). Used by the middleware.
import type { NextAuthConfig } from "next-auth";
import { canAccess, isPublicPath, ROLE_HOME, type Role } from "@/lib/permissions";

export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 12 * 60 * 60 }, // one working day
  providers: [], // added in auth.ts
  callbacks: {
    // First gate for every request: login required + role check. Pages/handlers re-check on the server.
    authorized({ auth, request: { nextUrl } }) {
      const path = nextUrl.pathname;
      const user = auth?.user;

      if (isPublicPath(path)) {
        if (path === "/login" && user) {
          return Response.redirect(new URL(ROLE_HOME[user.role], nextUrl));
        }
        return true;
      }
      if (!user) return false; // → /login
      if (!canAccess(user.role, path)) {
        return Response.redirect(new URL(ROLE_HOME[user.role], nextUrl));
      }
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token?.id) {
        session.user.id = String(token.id);
      }
      session.user.role = token.role as Role;
      return session;
    },
    
  },
} satisfies NextAuthConfig;
