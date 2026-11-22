import { setActiveAction } from "@/app/actions/staff";
import { db } from "@/lib/db";
import { ROLE_LABEL } from "@/lib/roles";
import { requireRole } from "@/lib/session";
import { CreateStaffForm, ResetPasswordForm } from "./forms";

// Minimal staff admin (admin only). Invitation by e-mail + attendance view follow in Phase 4.
export default async function StaffPage() {
  const me = await requireRole("admin");
  const users = await db.user.findMany({ orderBy: [{ active: "desc" }, { createdAt: "asc" }] });

  return (
    <div className="page">
      <div>
        <h1 style={{ margin: 0 }}>Mitarbeiter &amp; Rechte</h1>
        <p className="muted" style={{ margin: "4px 0 0" }}>Logins anlegen, Passwort zurücksetzen, sperren.</p>
      </div>

      <CreateStaffForm />

      {users.map((u) => (
        <div key={u.id} className="card pad" style={{ display: "grid", gap: 8, opacity: u.active ? 1 : 0.6 }}>
          <div>
            <b>{u.name}</b> · {ROLE_LABEL[u.role]} {u.active ? "" : "· gesperrt"}
            <div className="muted">{u.email}</div>
          </div>
          <ResetPasswordForm id={u.id} />
          {u.id !== me.id && (
            <form action={setActiveAction}>
              <input type="hidden" name="id" value={u.id} />
              <input type="hidden" name="active" value={String(!u.active)} />
              <button className="btn" type="submit">{u.active ? "Sperren" : "Entsperren"}</button>
            </form>
          )}
        </div>
      ))}
    </div>
  );
}
