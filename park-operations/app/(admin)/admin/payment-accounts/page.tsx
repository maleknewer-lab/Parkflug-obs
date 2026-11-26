import Link from "next/link";
import { createPaymentAccountAction, updatePaymentAccountAction } from "@/app/actions/payment-accounts";
import { db } from "@/lib/db";
import { envNamesFor, keyStatus } from "@/lib/stripe/env";
import { requireRole } from "@/lib/session";
import { Field, Message, grid } from "../rates/ui";

// Zahlungskonten (admin only). Shows WHICH environment variables each account needs and whether they are
// present on the server (yes/no only — values are never shown or stored here).
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
      <div>
        <h1 style={{ margin: 0 }}>Zahlungskonten</h1>
        <p className="muted" style={{ margin: "4px 0 0" }}>
          Jedes Konto ist ein Stripe-Konto. Mehrere Marken können sich ein Konto teilen. Die geheimen Schlüssel stehen
          nur in den Umgebungsvariablen des Servers, nie hier. <Link href="/admin/rates">Zuordnung zu Marken: Tarife &amp; Preise</Link>
        </p>
      </div>
      <Message saved={sp.saved} error={sp.error} />

      {accounts.map((a) => {
        const names = envNamesFor(a.envKey);
        const st = keyStatus(a.envKey, process.env);
        const row = (label: string, varName: string, ok: boolean) => (
          <li key={varName}>
            {ok ? "✅" : "❌"} <code>{varName}</code> <span className="muted">({label})</span>
          </li>
        );
        return (
          <section key={a.id} className="card pad" style={{ display: "grid", gap: 12 }}>
            <h2 style={{ margin: 0 }}>{a.name}{a.active ? "" : " (inaktiv)"}</h2>
            <span className="muted">Marken: {a.brands.length ? a.brands.map((b) => b.name).join(", ") : "keine"}</span>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {row("Secret Key", names.secretKey, st.secretKey)}
              {row("Webhook-Secret", names.webhookSecret, st.webhookSecret)}
              {row("Publishable Key", names.publishableKey, st.publishableKey)}
            </ul>
            <span className="muted">
              Zahlarten für Kunden: Karte (Visa, Mastercard, Amex, Apple Pay, Google Pay){a.paypalEnabled ? " · PayPal" : " · PayPal aus"}
            </span>
            <span className="muted">
              Webhook-Adresse für Stripe (Events: <code>payment_intent.succeeded</code>, <code>payment_intent.canceled</code>):{" "}
              <code>/api/stripe/webhook/{a.slug}</code> auf Ihrer Domain.
            </span>
            <details>
              <summary style={{ cursor: "pointer", minHeight: 44, display: "flex", alignItems: "center" }}>Bearbeiten</summary>
              <form action={updatePaymentAccountAction} style={{ display: "grid", gap: 12, paddingTop: 8 }}>
                <input type="hidden" name="id" value={a.id} />
                <div style={grid}>
                  <Field text label="Name" name="name" defaultValue={a.name} />
                  <Field text label="Kürzel (Webhook-URL)" name="slug" defaultValue={a.slug} />
                  <Field text label="Schlüssel-Name (Umgebung)" name="envKey" defaultValue={a.envKey} hint="DEFAULT oder z. B. ACME" />
                </div>
                <label style={{ display: "flex", gap: 8, alignItems: "center", minHeight: 44 }}>
                  <input type="checkbox" name="active" defaultChecked={a.active} /> Aktiv
                </label>
                <label style={{ display: "flex", gap: 8, alignItems: "center", minHeight: 44 }}>
                  <input type="checkbox" name="paypalEnabled" defaultChecked={a.paypalEnabled} /> PayPal anbieten (nur ankreuzen, wenn PayPal im Stripe-Dashboard aktiviert ist)
                </label>
                <button className="btn" type="submit">Speichern</button>
              </form>
            </details>
          </section>
        );
      })}

      <section className="card pad" style={{ display: "grid", gap: 12 }}>
        <h2 style={{ margin: 0 }}>Neues Zahlungskonto</h2>
        <form action={createPaymentAccountAction} style={{ display: "grid", gap: 12 }}>
          <div style={grid}>
            <Field text label="Name" name="name" hint="z. B. Park Gruppe" />
            <Field text label="Kürzel (Webhook-URL)" name="slug" hint="z. B. park-gruppe" />
            <Field text label="Schlüssel-Name (Umgebung)" name="envKey" defaultValue="DEFAULT" hint="DEFAULT = STRIPE_SECRET_KEY …" />
          </div>
          <button className="btn" type="submit">Anlegen</button>
        </form>
      </section>
    </div>
  );
}
