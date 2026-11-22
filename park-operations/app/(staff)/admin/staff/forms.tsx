"use client";

import { useActionState } from "react";
import { createStaffAction, resetPasswordAction, type StaffState } from "@/app/actions/staff";

function Result({ s }: { s: StaffState }) {
  return (
    <>
      <div className="err" role="alert">{s.error}</div>
      {s.ok && (
        <div className="card pad" style={{ display: "grid", gap: 4 }}>
          <b>{s.ok}</b>
          <span>E-Mail: <code>{s.email}</code></span>
          <span>Passwort: <code style={{ fontSize: 16 }}>{s.password}</code></span>
        </div>
      )}
    </>
  );
}

export function CreateStaffForm() {
  const [state, action, pending] = useActionState<StaffState, FormData>(createStaffAction, {});
  return (
    <form action={action} className="card pad" style={{ display: "grid", gap: 10 }}>
      <b>Neuen Mitarbeiter anlegen</b>
      <label className="field">Name<input className="inp" name="name" required /></label>
      <label className="field">E-Mail<input className="inp" name="email" type="email" autoComplete="off" required /></label>
      <label className="field">Rolle
        <select className="inp" name="role" defaultValue="fahrer">
          <option value="fahrer">Fahrer</option>
          <option value="dispo">Büro</option>
          <option value="admin">Admin</option>
        </select>
      </label>
      <label className="field">Passwort (leer = automatisch erzeugen)
        <input className="inp" name="password" type="text" autoComplete="off" placeholder="mind. 10 Zeichen" />
      </label>
      <Result s={state} />
      <button className="btn" type="submit" disabled={pending}>{pending ? "Speichern …" : "Anlegen"}</button>
    </form>
  );
}

export function ResetPasswordForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState<StaffState, FormData>(resetPasswordAction, {});
  return (
    <form action={action} style={{ display: "grid", gap: 6 }}>
      <input type="hidden" name="id" value={id} />
      <input className="inp" name="password" type="text" autoComplete="off" placeholder="Neues Passwort (leer = automatisch)" />
      <button className="btn" type="submit" disabled={pending}>Passwort zurücksetzen</button>
      <Result s={state} />
    </form>
  );
}
