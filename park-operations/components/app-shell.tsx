"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { NAV_ICONS } from "@/components/nav-icons";
import type { NavItem } from "@/lib/permissions";

type Props = {
  user: { name: string; roleLabel: string };
  nav: NavItem[];
  logout: () => Promise<void>;
  children: React.ReactNode;
};

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("") || "?";

/** Markup and class names are 1:1 from the approved UI (docs/ui-html/uebersicht.html). */
export function AppShell({ user, nav, logout, children }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const isActive = (href: string) => (href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(href + "/"));
  const current = nav.find((i) => isActive(i.href));
  const groups = Array.from(new Set(nav.map((i) => i.group)));

  const toggleTheme = () => {
    const r = document.documentElement;
    const dark = r.dataset.theme ? r.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    r.dataset.theme = dark ? "light" : "dark";
    try { localStorage.setItem("theme", r.dataset.theme); } catch {}
  };

  const ini = initials(user.name);

  return (
    <>
      <header className="top">
        <button className="iconbtn" id="menuBtn" aria-controls="menu" aria-expanded={open} aria-label="Menü öffnen" onClick={() => setOpen(true)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
        </button>
        <div className="logo"><span className="m">P</span>Park Operations</div>
        {current && <span className="crumb">· {current.label}</span>}
        <span className="sp" />
        <span className="live"><i />Flugdaten live · DUS</span>
        <button className="iconbtn" aria-label="Hell/Dunkel umschalten" onClick={toggleTheme}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
        </button>
        <Link className="avatar" href="/account" aria-label="Benutzer" title={`${user.name} (${user.roleLabel})`}>{ini}</Link>
      </header>

      <div className={`scrim${open ? " on" : ""}`} onClick={() => setOpen(false)} />
      <nav className={`menu${open ? " on" : ""}`} id="menu" aria-label="Hauptmenü">
        <div className="head">
          <div className="logo"><span className="m">P</span>Park Operations</div>
          <button className="iconbtn" aria-label="Menü schließen" onClick={() => setOpen(false)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        <div className="me">
          <span className="avatar">{ini}</span>
          <span style={{ flex: 1, minWidth: 0 }}><b>{user.name}</b><div className="meta">{user.roleLabel}</div></span>
        </div>
        {groups.map((g) => (
          <div key={g}>
            <div className="grp">{g}</div>
            {nav.filter((i) => i.group === g).map((i) => (
              <Link key={i.key} href={i.href} className={isActive(i.href) ? "on" : undefined}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" dangerouslySetInnerHTML={{ __html: NAV_ICONS[i.key] ?? "" }} />
                {i.label}
              </Link>
            ))}
          </div>
        ))}
        <form action={logout} style={{ marginTop: 12 }}>
          <button className="btn" type="submit" style={{ width: "100%" }}>Schicht beenden &amp; abmelden</button>
        </form>
      </nav>

      <main id="app">{children}</main>
    </>
  );
}
