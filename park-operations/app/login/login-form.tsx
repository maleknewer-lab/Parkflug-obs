"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "@/app/actions/auth";

export function LoginForm({ initialError }: { initialError?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, { error: initialError });

  return (
    <form action={action} className="card pad" style={{ display: "grid", gap: 10 }}>
      <label className="field">
        E-Mail
        <input className="inp" id="lgMail" name="email" type="email" autoComplete="username" placeholder="name@parkflug.de" required />
      </label>
      <label className="field">
        Passwort
        <input className="inp" id="lgPw" name="password" type="password" autoComplete="current-password" placeholder="••••••••" required />
      </label>
      <div className="err" role="alert">{state.error}</div>
      <button className="btn lg" type="submit" disabled={pending}>
        {pending ? "Anmelden …" : "Anmelden"}
      </button>
    </form>
  );
}
