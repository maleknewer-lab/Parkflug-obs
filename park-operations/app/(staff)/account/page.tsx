import { requirePath } from "@/lib/session";
import { ROLE_LABEL } from "@/lib/roles";
import { db } from "@/lib/db";
import { logoutAction } from "@/app/actions/auth";

export const metadata = { title: "Mein Konto · Operations" };

const fmt = new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Berlin" });

export default async function AccountPage() {
  const user = await requirePath("/account");
  const shift = await db.shift.findFirst({ where: { userId: user.id, endedAt: null }, orderBy: { startedAt: "desc" } });
  return (
    <div className="page">
      <h1 style={{ margin: 0 }}>Mein Konto</h1>
      <div className="card pad" style={{ display: "grid", gap: 6 }}>
        <b>{user.name}</b>
        <span className="muted">{user.email} · {ROLE_LABEL[user.role]}</span>
        <span className="muted">{shift ? `Schicht läuft seit ${fmt.format(shift.startedAt)}` : "Keine offene Schicht"}</span>
      </div>
      <form action={logoutAction}>
        <button className="btn" type="submit">Schicht beenden &amp; abmelden</button>
      </form>
    </div>
  );
}
