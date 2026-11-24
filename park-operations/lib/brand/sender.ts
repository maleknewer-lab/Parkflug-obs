// Sender identity of a brand for e-mail and SMS. Always from the brand settings in the database,
// never hard-coded. (The SMTP password itself stays in the environment.)

const EMAIL = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]+$/;

/** "" → null, valid → lower-cased address, invalid → undefined. */
export function parseOptionalEmail(input: string): string | null | undefined {
  const v = input.trim().toLowerCase();
  if (v === "") return null;
  return v.length <= 120 && EMAIL.test(v) ? v : undefined;
}

/** Display name of the sender. No line breaks or angle brackets (header injection). */
export function parseSenderName(input: string): string | null | undefined {
  const v = input.trim();
  if (v === "") return null;
  if (v.length > 80 || /[\r\n<>"]/.test(v)) return undefined;
  return v;
}

/** SMS sender ID: 3–11 letters/digits (no spaces), at least one letter. */
export function parseSmsSender(input: string): string | null | undefined {
  const v = input.trim();
  if (v === "") return null;
  if (!/^[A-Za-z0-9]{3,11}$/.test(v) || !/[A-Za-z]/.test(v)) return undefined;
  return v;
}

/** `"ParkFlug" <buchung@parkflug.de>` — the From header value. */
export function formatMailbox(name: string | null, address: string): string {
  return name ? `"${name.replace(/(["\\])/g, "\\$1")}" <${address}>` : address;
}
