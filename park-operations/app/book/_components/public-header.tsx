import type { OptionalStaff } from "@/lib/staff-optional";
import { ThemeToggle } from "./theme-toggle";

// Topbar of the public pages: brand logo + name (same structure as the staff app).
// Logged-in staff additionally get the ☰ menu with the pages they may open, so they can move between
// the booking pages and the admin without typing addresses. Visitors see no staff elements.
export function PublicHeader({ brandName, staff }: { brandName: string; staff: OptionalStaff | null }) {
  const groups = staff ? [...new Set(staff.nav.map((n) => n.group))] : [];
  return (
    <header className="pub-top">
      {staff && (
        <details className="pub-menu">
          <summary className="pub-iconbtn" aria-label="Menü öffnen">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </summary>
          <nav aria-label="Hauptmenü">
            {groups.map((g) => (
              <div key={g}>
                <div className="grp">{g}</div>
                {staff.nav.filter((n) => n.group === g).map((n) => (
                  <a key={n.key} href={n.href}>{n.label}</a>
                ))}
              </div>
            ))}
          </nav>
        </details>
      )}
      <div className="pub-logo">
        <span className="m">{brandName.slice(0, 1).toUpperCase()}</span>
        {brandName}
      </div>
      <span className="sp" />
      {staff && <span className="pub-pill">{staff.name} · {staff.roleLabel}</span>}
      <ThemeToggle />
    </header>
  );
}
