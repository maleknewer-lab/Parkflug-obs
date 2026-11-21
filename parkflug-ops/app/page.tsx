import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto max-w-md p-6">
      <div className="rounded-xl border border-border bg-card p-6">
        <h1 className="text-xl font-semibold">ParkFlug Ops</h1>
        <p className="mt-2 text-sm opacity-70">Phase 1 · Foundation — das Gerüst läuft.</p>
        <nav className="mt-4 flex flex-col gap-2 text-sm text-primary">
          <Link href="/admin">Admin</Link>
          <Link href="/driver">Fahrer-App</Link>
          <Link href="/book/parkflug">Buchung (ParkFlug)</Link>
        </nav>
      </div>
    </main>
  );
}
