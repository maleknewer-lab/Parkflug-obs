export function ComingSoon({ title, phase, note }: { title: string; phase: string; note?: string }) {
  return (
    <div className="page">
      <div>
        <h1 style={{ margin: 0 }}>{title}</h1>
        <p className="muted" style={{ margin: "4px 0 0" }}>{note ?? "Diese Seite wird in einer späteren Phase gebaut."}</p>
      </div>
      <div className="card pad">
        <b>{phase}</b>
        <p className="muted" style={{ margin: "6px 0 0" }}>
          Das fertige Layout liegt in <code>docs/ui-html</code>. Der Zugriff ist bereits serverseitig geschützt.
        </p>
      </div>
    </div>
  );
}
