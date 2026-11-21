import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authConfig } from "@/auth.config";
import { db } from "@/lib/db";
import { startShift } from "@/lib/shifts";

const credentialsSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(1).max(200),
});

// Compared when the e-mail is unknown, so response time does not reveal which e-mails exist.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 12);

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const email = parsed.data.email.trim().toLowerCase();

        const user = await db.user.findUnique({ where: { email } });
        const ok = await bcrypt.compare(parsed.data.password, user?.passwordHash ?? DUMMY_HASH);
        if (!user || !ok || !user.active) return null; // deactivated logins cannot sign in

        return { id: user.id, name: user.name, email: user.email, role: user.role };
      },
    }),
  ],
  events: {
    // The shift starts automatically at login.
    async signIn({ user }) {
      if (user?.id) await startShift(user.id);
    },
  },
});
