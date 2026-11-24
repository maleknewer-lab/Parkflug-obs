// Brand legal links (AGB, Impressum, Datenschutz) point to the brand's WordPress pages.
// They are admin settings, so only plain https URLs are accepted (no javascript:, data:, http:).

/** "" → null (empty is allowed), valid https URL → normalised string, anything else → undefined (invalid). */
export function parseOptionalHttpsUrl(input: string): string | null | undefined {
  const v = input.trim();
  if (v === "") return null;
  if (v.length > 300) return undefined;
  let u: URL;
  try {
    u = new URL(v);
  } catch {
    return undefined;
  }
  if (u.protocol !== "https:" || u.username !== "" || u.password !== "" || u.hostname === "") return undefined;
  return u.href;
}
