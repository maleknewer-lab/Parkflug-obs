import "./public.css";

// Shell for the public customer pages (booking form, later "manage booking").
// Neutral theme for now; per-brand colours are applied by the pages themselves (Phase 3, CLAUDE.md §8).
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <div className="pub">{children}</div>;
}
