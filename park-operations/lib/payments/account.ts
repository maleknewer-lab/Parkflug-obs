// Which Stripe account takes a brand's payments. Read from the database (PaymentAccount), secrets from
// the environment. Today ParkFlug and DUS Valet share one account ("Park Gruppe"); when the system is
// offered to other companies, each company gets its own account row and nothing here changes.
import { db } from "@/lib/db";
import { readStripeKeys, type StripeKeys } from "@/lib/stripe/env";

export type AccountRef = { id: string; slug: string; name: string; envKey: string; active: boolean };

/** Is online payment possible for this account right now? (account active AND all three keys present) */
export function onlineAvailable(account: Pick<AccountRef, "active" | "envKey"> | null): boolean {
  return !!account && account.active && readStripeKeys(account.envKey, process.env) !== null;
}

export function keysFor(account: Pick<AccountRef, "envKey">): StripeKeys | null {
  return readStripeKeys(account.envKey, process.env);
}

export async function loadAccountById(id: string): Promise<(AccountRef & { keys: StripeKeys | null }) | null> {
  const a = await db.paymentAccount.findUnique({ where: { id } });
  return a ? { ...a, keys: keysFor(a) } : null;
}
