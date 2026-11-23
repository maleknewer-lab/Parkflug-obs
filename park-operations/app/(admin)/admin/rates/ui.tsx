import type { CSSProperties, ReactNode } from "react";

// Small shared form pieces for the price pages (server components, no client JS needed).

export const SERVICE_LABEL = { SHUTTLE: "Shuttle", VALET: "Valet" } as const;
export const LOT_LABEL = { GARAGE: "Parkhaus", OUTDOOR: "Außenparkplatz" } as const;

export const inputStyle: CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid rgba(128,128,128,.45)",
  background: "transparent",
  color: "inherit",
  font: "inherit",
  boxSizing: "border-box",
};

export const grid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
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
    <label style={{ display: "grid", gap: 4 }}>
      <span>{props.label}</span>
      <input
        name={props.name}
        defaultValue={props.defaultValue}
        placeholder={props.placeholder}
        required={props.required}
        inputMode={props.text ? undefined : "decimal"}
        autoComplete="off"
        style={inputStyle}
      />
      {props.hint && <span className="muted" style={{ fontSize: 12 }}>{props.hint}</span>}
    </label>
  );
}

export function Check(props: { label: string; name: string; checked: boolean }) {
  return (
    <label style={{ display: "flex", gap: 8, alignItems: "center", minHeight: 44 }}>
      <input type="checkbox" name={props.name} defaultChecked={props.checked} />
      {props.label}
    </label>
  );
}

/** null = inherit from brand, true/false = override */
export function TriSelect(props: { label: string; name: string; value: boolean | null; brandValue: boolean }) {
  const current = props.value === null ? "inherit" : props.value ? "yes" : "no";
  return (
    <label style={{ display: "grid", gap: 4 }}>
      <span>{props.label}</span>
      <select name={props.name} defaultValue={current} style={inputStyle}>
        <option value="inherit">Wie Marke ({props.brandValue ? "Ja" : "Nein"})</option>
        <option value="yes">Ja</option>
        <option value="no">Nein</option>
      </select>
    </label>
  );
}

export function Message(props: { saved?: string; error?: string }): ReactNode {
  if (props.error) {
    return <div className="card pad" style={{ borderColor: "#b4534f" }}>⚠ {props.error}</div>;
  }
  if (props.saved) {
    return <div className="card pad">✓ {props.saved === "1" ? "Gespeichert" : props.saved}</div>;
  }
  return null;
}
