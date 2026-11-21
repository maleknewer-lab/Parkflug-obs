# Park Operations – UI (HTML + CSS)

Static, fully styled screens of the operations system (ParkFlug · DUS Valet),
exported from the approved prototype (`docs/prototype.html`). Open `index.html`
for a list of all pages.

## Files
| Path | Purpose |
|---|---|
| `css/tokens.css` | Design tokens (colours, fonts, shadows). Light "Mist grey", dark "Graphite". Auto dark via `prefers-color-scheme`, manual via `<html data-theme="light|dark">`. |
| `css/app.css` | All components & layout (topbar, menu, cards, tables, chips, plates, forms, sheet, driver app, booking form, charts…). |
| `css/brand-parkflug.css` | Example brand theme for public pages: `<html data-brand="parkflug">`. Copy for each new brand. Colours are placeholders. |
| `js/theme.js` | Applies saved theme before paint (load in `<head>`). |
| `js/ui.js` | UI behaviour only: hamburger menu, theme toggle, side sheet close, `.seg` toggles (fires `seg:change`), `[data-href]` rows, signature pad on `canvas.sig`, `window.toast()`. No data, no business logic. |
| `img/qr-placeholder.svg` | Placeholder – replace with the real QR generated server-side. |
| `*.html` | One file per screen (see `index.html` for the proposed Next.js route of each). |

## Wiring to the backend (Next.js)
- **Use the CSS as-is**: import `tokens.css` + `app.css` globally in `app/layout.tsx`. Class names are stable – keep them in JSX (`class` → `className`, inline `style="a:b"` → `style={{a:'b'}}`).
- **Example data**: everything shown (names, plates, prices, dates, counts) is fake. Lists are cut to ~8 rows; `<!-- repeat ... per item -->` marks the element to map over.
- **IDs / names**: form fields keep the prototype IDs (`bFirst`, `bMail`, `bPlate`, …) and got a matching `name` attribute. Login posts `email` + `password` to `/api/auth/login`; booking form posts to `/api/bookings` (placeholders – adjust to the real API).
- **Links**: rows with `data-open="CODE"` have `data-href="buchung.html?code=CODE"` → becomes `/admin/bookings/[code]`. Detail panels (`buchung.html`, `rechnung.html`, `konto.html`) show the list behind an open `.sheet.on`.
- **Charts** (revenue line/candles, hourly, occupancy) are static SVG snapshots. Render them from real data (same markup structure, or a chart lib styled with the tokens).
- **Roles**: the menu shows all items (admin view). Hide items per role **and** enforce on the server (see CLAUDE.md §3 "Staff, roles & attendance").
- **Public pages** (`buchen*.html`) use their own header without the admin menu, plus the brand theme.
- Inline event handlers from the prototype were removed; all interactivity beyond `ui.js` belongs in the React components / API.
