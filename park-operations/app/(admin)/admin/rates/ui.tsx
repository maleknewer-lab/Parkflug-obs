import type { CSSProperties, ReactNode } from "react";

// Small shared form pieces for the price pages (server components, no client JS needed).
// Styled by the shared kit admin-ui.css (loaded by app/(admin)/admin/layout.tsx).

export const SERVICE_LABEL = { SHUTTLE: "Shuttle", VALET: "Valet" } as const;
export const LOT_LABEL = { GARAGE: "Parkhaus", OUTDOOR: "Außenparkplatz" } as const;

// Kept for pages that still pass these as inline styles
export const inputStyle: CSSProperties = {
  width: "100%",
  padding: "11px 13px",
  borderRadius: 12,
  border: "1px solid var(--line, #dfe3e8)",
  background: "var(--surface, #f8f9fa)",
  color: "inherit",
  font: "inherit",
  boxSizing: "border-box",
  minHeight: 44,
};

export const grid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
  gap: 12,
};

export function Field(props: {
  label: string;
  name: string;
  defaultValue?: string | number;
  placeholder?: string;
  hint?: string;
  required?: boolean;
  /** true = free text (name); default = numeric keypad */
  text?: boolean;
}) {
  return (
    <label className="ui-field">
      <span>{props.label}</span>
      <input
        className={`ui-inp${props.text ? "" : " ui-mono"}`}
        name={props.name}
        defaultValue={props.defaultValue}
        placeholder={props.placeholder}
        required={props.required}
        inputMode={props.text ? undefined : "decimal"}
        autoComplete="off"
      />
      {props.hint && <span className="ui-meta">{props.hint}</span>}
    </label>
  );
}

export function Check(props: { label: string; name: string; checked: boolean }) {
  return (
    <label className="ui-check">
      <input type="checkbox" name={props.name} defaultChecked={props.checked} />
      <span>{props.label}</span>
    </label>
  );
}

/** null = inherit from brand, true/false = override */
export function TriSelect(props: { label: string; name: string; value: boolean | null; brandValue: boolean }) {
  const current = props.value === null ? "inherit" : props.value ? "yes" : "no";
  return (
    <label className="ui-field">
      <span>{props.label}</span>
      <select className="ui-inp" name={props.name} defaultValue={current}>
        <option value="inherit">Wie Marke ({props.brandValue ? "Ja" : "Nein"})</option>
        <option value="yes">Ja</option>
        <option value="no">Nein</option>
      </select>
    </label>
  );
}

export function Message(props: { saved?: string; error?: string }): ReactNode {
  if (props.error) return <div className="ui-msg err" role="alert">⚠ {props.error}</div>;
  if (props.saved) return <div className="ui-msg ok">✓ {props.saved === "1" ? "Gespeichert" : props.saved}</div>;
  return null;
}
