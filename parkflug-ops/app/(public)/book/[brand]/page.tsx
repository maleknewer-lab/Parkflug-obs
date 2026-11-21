export default async function BookPage({ params }: { params: Promise<{ brand: string }> }) {
  const { brand } = await params;
  return (
    <main className="mx-auto max-w-md p-6">
      <div className="rounded-xl border border-border bg-card p-6">
        <h1 className="text-lg font-semibold">Buchung · {brand}</h1>
        <p className="mt-2 text-sm opacity-70">Platzhalter — Buchungsformular kommt in Phase 3.</p>
      </div>
    </main>
  );
}
