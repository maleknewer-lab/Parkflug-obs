import { randomBytes } from "node:crypto";
import { z } from "zod";
import { ROLES } from "@/lib/permissions";

export const MIN_PASSWORD_LENGTH = 10;

/** Random password, shown once to the admin (never stored in clear text). */
export function generatePassword(): string {
  return randomBytes(9).toString("base64url"); // 12 chars
}

export const createStaffSchema = z.object({
  name: z.string().trim().min(2, "Name fehlt."),
  email: z.string().trim().toLowerCase().email("E-Mail ist ungültig."),
  role: z.enum(ROLES as [string, ...string[]], { message: "Rolle ungültig." }),
  password: z
    .string()
    .optional()
    .transform((v) => (v ?? "").trim())
    .refine((v) => v === "" || v.length >= MIN_PASSWORD_LENGTH, `Passwort: mindestens ${MIN_PASSWORD_LENGTH} Zeichen.`),
});
