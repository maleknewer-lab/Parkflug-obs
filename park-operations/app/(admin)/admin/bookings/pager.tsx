import Link from "next/link";

// Previous / next links that keep all current filters. Server component.
export function Pager(props: {
  basePath: string;
  params: Record<string, string | null | undefined>;
  page: number;
  total: number;
  pageSize: number;
}) {
  const pages = Math.max(1, Math.ceil(props.total / props.pageSize));
  const href = (page: number) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(props.params)) if (v) qs.set(k, v);
    if (page > 1) qs.set("page", String(page));
    const s = qs.toString();
    return s ? `${props.basePath}?${s}` : props.basePath;
  };
  if (pages <= 1) return null;
  return (
    <div className="ui-pager">
      {props.page > 1 ? <Link className="btn soft" href={href(props.page - 1)}>← Zurück</Link> : <span />}
      <span className="ui-meta">Seite {props.page} von {pages}</span>
      {props.page < pages ? <Link className="btn soft" href={href(props.page + 1)}>Weiter →</Link> : <span />}
    </div>
  );
}
