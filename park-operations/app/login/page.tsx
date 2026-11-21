import { LoginForm } from "./login-form";

export const metadata = { title: "Anmelden · Operations" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <div className="login page-login">
      <div className="box">
        <div className="logo" style={{ fontSize: 18 }}>
          <span className="m">P</span>Park Operations
        </div>
        <div>
          <h1>Anmelden</h1>
          <p className="muted" style={{ margin: "4px 0 0" }}>
            Jeder Mitarbeiter meldet sich mit seiner eigenen E-Mail an. Die Schicht startet automatisch.
          </p>
        </div>
        <LoginForm initialError={error === "inactive" ? "Dieser Zugang ist deaktiviert." : undefined} />
      </div>
    </div>
  );
}
