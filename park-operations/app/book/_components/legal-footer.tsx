// Footer of the public pages: links to the brand's Impressum, Datenschutz and AGB on its WordPress site.
// The URLs are per-brand settings (admin → Preise → "Rechtliche Links"); only set ones are shown.
export function LegalFooter({
  brand,
}: {
  brand: { impressumUrl: string | null; privacyUrl: string | null; termsUrl: string | null };
}) {
  const links = [
    { label: "Impressum", href: brand.impressumUrl },
    { label: "Datenschutz", href: brand.privacyUrl },
    { label: "AGB", href: brand.termsUrl },
  ].filter((l): l is { label: string; href: string } => !!l.href);
  if (links.length === 0) return null;
  return (
    <footer className="pub-foot pub-muted">
      {links.map((l) => (
        <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer">
          {l.label}
        </a>
      ))}
    </footer>
  );
}
