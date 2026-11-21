/**
 * Role permissions — pure functions, no framework imports.
 * Used by the middleware (edge), by server components and by API handlers.
 * See CLAUDE.md §3 "Staff, roles & attendance". Deny by default.
 */

export type Role = "admin" | "dispo" | "fahrer";
export const ROLES: readonly Role[] = ["admin", "dispo", "fahrer"];

/** Where each role lands after login / when it opens a forbidden route. */
export const ROLE_HOME: Record<Role, string> = {
  admin: "/admin",
  dispo: "/admin",
  fahrer: "/driver",
};

const ALL: Role[] = ["admin", "dispo", "fahrer"];
const OFFICE: Role[] = ["admin", "dispo"];
const ADMIN: Role[] = ["admin"];

/** Exact-or-prefix rules (segment boundary). First match with the longest prefix wins. */
const ROUTE_RULES: { prefix: string; roles: Role[]; exact?: boolean }[] = [
  // Dashboard only (dispo sees it without total revenue). Exact, so unknown /admin/* stays admin-only.
  { prefix: "/admin", roles: OFFICE, exact: true },
  { prefix: "/admin/transfers", roles: ALL },
  { prefix: "/admin/cash", roles: ALL }, // scope differs per role, see cashScope()
  { prefix: "/admin/bookings", roles: OFFICE },
  { prefix: "/admin/customers", roles: OFFICE },
  { prefix: "/admin/occupancy", roles: OFFICE },
  { prefix: "/admin/marketing", roles: ADMIN },
  { prefix: "/admin/invoices", roles: ADMIN },
  { prefix: "/admin/reports", roles: ADMIN },
  { prefix: "/admin/rates", roles: ADMIN },
  { prefix: "/admin/staff", roles: ADMIN },
  { prefix: "/driver", roles: ALL },
  { prefix: "/account", roles: ALL },
];

/** Reachable without login. Everything else needs a session. */
const PUBLIC_PREFIXES = [
  "/login",
  "/logout",
  "/book", // customer booking pages (Phase 3)
  "/manage", // customer cancel/view page (Phase 3)
  "/api/auth",
  "/api/stripe/webhook", // verified by Stripe signature
  "/api/cron", // protected by its own secret
];

function matches(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(prefix + "/");
}

export function isPublicPath(path: string): boolean {
  return PUBLIC_PREFIXES.some((p) => matches(path, p));
}

/**
 * May this role open this path? (Path = URL pathname, no query.)
 * - "/" is allowed for everyone logged in; the page itself redirects to ROLE_HOME.
 * - "/api/*" is allowed for any logged-in user here; each handler MUST still call
 *   requireRole()/requireApiRole() — the middleware is only the first gate.
 * - Unknown paths under /admin or /driver: admin only (deny by default).
 */
export function canAccess(role: Role, rawPath: string): boolean {
  const path = rawPath.length > 1 ? rawPath.replace(/\/+$/, "") : rawPath;
  if (path === "/") return true;
  if (matches(path, "/api")) return true;
  if (isPublicPath(path)) return true;

  let best: (typeof ROUTE_RULES)[number] | undefined;
  for (const rule of ROUTE_RULES) {
    const hit = rule.exact ? path === rule.prefix : matches(path, rule.prefix);
    if (hit && (!best || rule.prefix.length > best.prefix.length)) {
      best = rule;
    }
  }
  if (best) return best.roles.includes(role);
  return role === "admin";
}

/** Cash register (Tageskasse): which data a role may see. */
export type CashScope = "any-day" | "today" | "own-today";
export function cashScope(role: Role): CashScope {
  return role === "admin" ? "any-day" : role === "dispo" ? "today" : "own-today";
}

/** Total revenue and revenue chart: owner only. */
export function canSeeRevenue(role: Role): boolean {
  return role === "admin";
}

/** Menu entries per role. `key` matches the data-r keys of the approved UI. */
export type NavItem = {
  key: string;
  label: string;
  href: string;
  group: "Betrieb" | "Verwaltung" | "Kunde";
  roles?: Role[]; // extra restriction for links to public pages (route rules cannot express it)
};

export const NAV_ITEMS: NavItem[] = [
  { key: "uebersicht", label: "Übersicht", href: "/admin", group: "Betrieb" },
  { key: "transfers", label: "Transferliste", href: "/admin/transfers", group: "Betrieb" },
  { key: "fahrer", label: "Fahrer-App", href: "/driver", group: "Betrieb" },
  { key: "kasse", label: "Tageskasse", href: "/admin/cash", group: "Betrieb" },
  { key: "buchungen", label: "Buchungen", href: "/admin/bookings", group: "Verwaltung" },
  { key: "kunden", label: "Kunden", href: "/admin/customers", group: "Verwaltung" },
  { key: "marketing", label: "Angebote senden", href: "/admin/marketing", group: "Verwaltung" },
  { key: "belegung", label: "Belegung", href: "/admin/occupancy", group: "Verwaltung" },
  { key: "rechnungen", label: "Rechnungen", href: "/admin/invoices", group: "Verwaltung" },
  { key: "auswertung", label: "Auswertung", href: "/admin/reports", group: "Verwaltung" },
  { key: "tarife", label: "Tarife & Preise", href: "/admin/rates", group: "Verwaltung" },
  { key: "mitarbeiter", label: "Mitarbeiter & Rechte", href: "/admin/staff", group: "Verwaltung" },
  { key: "buchen", label: "Online buchen (Website)", href: "/book/parkflug", group: "Kunde", roles: OFFICE },
];

/** Menu = exactly the items the role may open (same rules as the server). */
export function navFor(role: Role): NavItem[] {
  return NAV_ITEMS.filter((i) => canAccess(role, i.href) && (!i.roles || i.roles.includes(role)));
}
