"use client";

// Light/dark switch. Uses the same storage key ("theme") and attribute (html[data-theme]) as the staff app,
// so the choice is shared; without a choice the system setting applies.
export function ThemeToggle() {
  function toggle() {
    const el = document.documentElement;
    const current = el.dataset.theme ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = current === "dark" ? "light" : "dark";
    el.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* storage blocked: the switch still works for this visit */
    }
  }
  return (
    <button type="button" className="pub-iconbtn" onClick={toggle} aria-label="Hell/Dunkel umschalten">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
      </svg>
    </button>
  );
}
