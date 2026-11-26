// Why online payment is (not) offered for a brand. Pure: no database, no secrets — only "present or not".
import { readStripeKeys, type EnvLike } from "../stripe/env";

export type OnlineStatus = "ok" | "no_account" | "inactive" | "missing_keys";

export function onlineStatus(account: { active: boolean; envKey: string } | null, env: EnvLike): OnlineStatus {
  if (!account) return "no_account";
  if (!account.active) return "inactive";
  return readStripeKeys(account.envKey, env) ? "ok" : "missing_keys";
}

/** Shown to logged-in staff only, so a test booking explains why "Online" is missing. */
export const ONLINE_HINT: Record<Exclude<OnlineStatus, "ok">, string> = {
  no_account: "Nur für Mitarbeiter sichtbar: Online-Zahlung ist aus, weil dieser Marke kein Zahlungskonto zugeordnet ist (Tarife & Preise → Zahlung & Absender).",
  inactive: "Nur für Mitarbeiter sichtbar: Online-Zahlung ist aus, weil das Zahlungskonto inaktiv ist (Zahlungskonten).",
  missing_keys: "Nur für Mitarbeiter sichtbar: Online-Zahlung ist aus, weil Schlüssel-Variablen fehlen oder ungültig sind (Zahlungskonten: ❌ prüfen).",
};
