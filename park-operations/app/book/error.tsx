"use client";

// Friendly fallback for the public pages. The code (digest) lets staff find the real cause in the server log.
export default function PublicError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="pub-wrap">
      <section className="pub-card">
        <h2>Es ist ein Fehler aufgetreten</h2>
        <p className="pub-muted" style={{ margin: 0 }}>
          Bitte versuchen Sie es noch einmal. Wenn das Problem bleibt, nennen Sie uns bitte diesen Code: {error.digest ?? "–"}
        </p>
        <button type="button" className="pub-btn" onClick={reset}>Erneut versuchen</button>
      </section>
    </main>
  );
}
