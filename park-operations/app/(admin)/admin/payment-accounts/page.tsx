import Link from "next/link";
import { createPaymentAccountAction, updatePaymentAccountAction } from "@/app/actions/payment-accounts";
import { db } from "@/lib/db";
import { envNamesFor, keyStatus } from "@/lib/stripe/env";
import { requireRole } from "@/lib/session";
import { Check, Field, Message } from "../rates/ui";

// Zahlungskonten (admin only). Shows WHICH environment variables each account needs and whether they are
// present on the server (yes/no only — values are never shown or stored here), and whether online payment is
// possible for the brands that use the account.
export default async function PaymentAccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  await requireRole("admin");
  const sp = await searchParams;
  const accounts = await db.paymentAccount.findMany({
    orderBy: { name: "asc" },
    include: { brands: { select: { name: true }, orderBy: { name: "asc" } } },
  });

  return (
    <div className="page">
      <div className="ui-ph">
        <div>
          <h1>Zahlungskonten</h1>
          <p>
            Jedes Konto ist ein Stripe-Konto. Mehrere Marken können sich ein Konto teilen. Die geheimen Schlüssel stehen nur
            in den Umgebungsvariablen des Servers, nie hier.
          </p>
        </div>
        <Link className="btn soft" href="/admin/rates">Zuordnung zu Marken →</Link>
      </div>
      <Message saved={sp.saved} error={sp.error} />

      {accounts.length === 0 && (
        <div className="ui-banner">
          Noch kein Zahlungskonto. Ohne Konto gibt es nur Barzahlung. Unten „Neues Zahlungskonto“ ausfüllen (z. B. Park Gruppe, park-gruppe, DEFAULT).
        </div>
      )}

      {accounts.map((a) => {
        const names = envNamesFor(a.envKey);
        const st = keyStatus(a.envKey, process.env);
        const secret = process.env[names.secretKey] ?? "";
        const mode = secret.startsWith("sk_test_") ? "Testmodus" : secret.startsWith("sk_live_") ? "Livemodus" : "unbekannt";
        const allKeys = st.secretKey && st.webhookSecret && st.publishableKey;
        const ready = allKeys && a.active && a.brands.length > 0;
        const row = (label: string, varName: string, ok: boolean) => (
          <div className="ui-kv" key={varName}>
            <span>{ok ? "✅" : "❌"} <code>{varName}</code></span>
            <span className="ui-meta">{label}</span>
          </div>
        );
        return (
          <section key={a.id} className="card pad ui-stack">
            <div className="ui-sec-t" style={{ marginBottom: 0 }}>
              <span className="big">{a.name}</span>
              <span className="ui-chips" style={{ marginTop: 0 }}>
                <span className={`ui-chip ${a.active ? "ok" : "warn"}`}>{a.active ? "aktiv" : "inaktiv"}</span>
                <span className="ui-chip">{mode}</span>
                <span className={`ui-chip ${ready ? "ok" : "warn"}`}>{ready ? "Online-Zahlung bereit" : "noch nicht bereit"}</span>
              </span>
            </div>
            <span className="ui-meta">Marken mit diesem Konto: {a.brands.length ? a.brands.map((b) => b.name).join(", ") : "keine — in Tarife & Preise unter „Zahlung & Absender“ zuordnen"}</span>

            <div className="ui-stack" style={{ gap: 6 }}>
              {row("Secret Key (sk_test_… / sk_live_…)", names.secretKey, st.secretKey)}
              {row("Webhook-Signing-Secret (whsec_…)", names.webhookSecret, st.webhookSecret)}
              {row("Publishable Key (pk_test_… / pk_live_…)", names.publishableKey, st.publishableKey)}
            </div>
            {!allKeys && (
              <div className="ui-banner">
                Online-Zahlung bleibt aus, bis alle drei Variablen ✅ sind. Das Webhook-Secret bekommen Sie in Stripe unter
                Entwickler → Webhooks, nachdem Sie die Adresse unten angelegt haben.
              </div>
            )}

            <div className="ui-meta">
              Zahlarten für Kunden: Karte (Visa, Mastercard, Amex, Apple Pay, Google Pay){a.paypalEnabled ? " · PayPal" : " · PayPal aus"}
            </div>
            <div className="ui-meta">
              Webhook-Adresse für Stripe (Events <code>payment_intent.succeeded</code> und <code>payment_intent.canceled</code>):{" "}
              <code>/api/stripe/webhook/{a.slug}</code> auf Ihrer Domain.
            </div>

            <details className="ui-details">
              <summary>Bearbeiten</summary>
              <form action={updatePaymentAccountAction} className="ui-stack" style={{ paddingTop: 12 }}>
                <input type="hidden" name="id" value={a.id} />
                <div className="ui-kgrid">
                  <Field text label="Name" name="name" defaultValue={a.name} />
                  <Field text label="Kürzel (Webhook-URL)" name="slug" defaultValue={a.slug} />
                  <Field text label="Schlüssel-Name (Umgebung)" name="envKey" defaultValue={a.envKey} hint="DEFAULT oder z. B. ACME" />
                </div>
                <Check label="Aktiv" name="active" checked={a.active} />
                <Check label="PayPal anbieten (nur ankreuzen, wenn PayPal im Stripe-Dashboard aktiviert ist)" name="paypalEnabled" checked={a.paypalEnabled} />
                <div><button className="btn" type="submit">Speichern</button></div>
              </form>
            </details>
          </section>
        );
      })}

      <section className="card pad ui-stack">
        <div className="ui-sec-t">Neues Zahlungskonto</div>
        <form action={createPaymentAccountAction} className="ui-stack">
          <div className="ui-kgrid">
            <Field text label="Name" name="name" hint="z. B. Park Gruppe" />
            <Field text label="Kürzel (Webhook-URL)" name="slug" hint="z. B. park-gruppe" />
            <Field text label="Schlüssel-Name (Umgebung)" name="envKey" defaultValue="DEFAULT" hint="DEFAULT = STRIPE_SECRET_KEY …" />
          </div>
          <div><button className="btn go" type="submit">Anlegen</button></div>
        </form>
      </section>
    </div>
  );
}
