// Which environment variables hold a payment account's secrets. The DATABASE only stores the key NAME
// (PaymentAccount.envKey); the secret values exist only in the server environment (CLAUDE.md §7 rule 1).

export type StripeKeys = { secretKey: string; webhookSecret: string; publishableKey: string };
export type EnvLike = Record<string, string | undefined>;

/** "DEFAULT" or UPPER_SNAKE_CASE. Strict on purpose: the value is used to build env variable names. */
export function isValidEnvKey(envKey: string): boolean {
  return /^[A-Z][A-Z0-9_]{1,39}$/.test(envKey);
}

export function envNamesFor(envKey: string): { secretKey: string; webhookSecret: string; publishableKey: string } {
  if (!isValidEnvKey(envKey)) throw new Error("Invalid envKey");
  if (envKey === "DEFAULT") {
    // The names already used in Render today
    return {
      secretKey: "STRIPE_SECRET_KEY",
      webhookSecret: "STRIPE_WEBHOOK_SECRET",
      publishableKey: "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
    };
  }
  return {
    secretKey: `STRIPE_SECRET_KEY_${envKey}`,
    webhookSecret: `STRIPE_WEBHOOK_SECRET_${envKey}`,
    publishableKey: `STRIPE_PUBLISHABLE_KEY_${envKey}`,
  };
}

export type KeyStatus = { secretKey: boolean; webhookSecret: boolean; publishableKey: boolean };

/** Which of the three variables are present and well-formed. Returns booleans only, never values. */
export function keyStatus(envKey: string, env: EnvLike): KeyStatus {
  const n = envNamesFor(envKey);
  return {
    secretKey: /^(sk|rk)_(test|live)_[A-Za-z0-9]+$/.test(env[n.secretKey] ?? ""),
    webhookSecret: /^whsec_[A-Za-z0-9]+$/.test(env[n.webhookSecret] ?? ""),
    publishableKey: /^pk_(test|live)_[A-Za-z0-9]+$/.test(env[n.publishableKey] ?? ""),
  };
}

/** The keys, or null when any is missing or malformed. */
export function readStripeKeys(envKey: string, env: EnvLike): StripeKeys | null {
  const st = keyStatus(envKey, env);
  if (!st.secretKey || !st.webhookSecret || !st.publishableKey) return null;
  const n = envNamesFor(envKey);
  return {
    secretKey: env[n.secretKey]!,
    webhookSecret: env[n.webhookSecret]!,
    publishableKey: env[n.publishableKey]!,
  };
}
