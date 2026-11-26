# CLAUDE.md additions (same PR as the booking-page redesign)

## Section 3 → Bookings (replace the "Public booking" bullet)
- **Public booking (website):** one page `/book/<brand slug>` with six steps (Reise, Tarif, Ihre Daten, Hinweis, Extras, Zahlung) and a live summary, as in `docs/prototype.html`. The live price comes from the server (`quotePublicAction` → `lib/pricing`); the booking recalculates it again. Price, rate, lead time and every system field (status, source, payment, paid) are decided by the server; the form only passes an allow-list of fields (`lib/booking/public-form.ts`). Phone is required. A double click returns the same booking (`Booking.checkoutKey`). A visitor never overwrites an existing customer.
- **Consent in the booking form:** AGB + Datenschutz must be ticked (stored as `Booking.termsAcceptedAt` + `termsVersion`, wording version `TERMS_VERSION` in `lib/booking/consent.ts`); the SMS/WhatsApp opt-in box is never pre-ticked and is stored on the customer (`smsOptInAt`, `smsOptInSource`) **only if the customer's phone number is the number typed in the form** (a visitor must not opt somebody else in by typing their e-mail); the e-mail objection notice (UWG §7(3)) is shown in the form. **Wording is provisional until a lawyer has checked it.**
- Public pages have the topbar (brand logo + name, light/dark switch). Logged-in staff additionally get the ☰ menu there and, while testing, see why "Online" is missing (no payment account / inactive / keys missing) — visitors never see this.

## Section 4 / Proposed code structure (admin pages)
- Admin pages live in two route groups that both map to `/admin/...`: `app/(staff)/...` (layout with the header) and `app/(admin)/admin/...` (bookings, customers, rates, payment accounts). `app/(admin)/admin/layout.tsx` gives the second group the same header/menu (`AppShell`). New admin pages go under `app/(admin)/admin/` and get the header automatically.

## Section 5 → Phase 3 row
PR 5 (terms, objection notice, SMS opt-in) is built together with the booking-page redesign; open: lawyer review of the texts, PR 3 (e-mail + QR), PR 4 (manage page + refund + rate limiting, also for the live-quote action).

## Section 9 → Decision log (add)
| 2026-11-26 | Public booking page redesigned to the prototype: one page, six steps, live summary via a server action; the old two-step checkout route redirects to it. Consent (AGB, SMS opt-in, objection notice) built in with provisional wording; terms version stored on the booking; SMS opt-in stored only for the owner of the typed phone number. |
| 2026-11-26 | Header missing on admin pages: the Phase 2 pages sit in `app/(admin)/admin/` which had no layout. Added `app/(admin)/admin/layout.tsx` (same shell as `(staff)`). Public pages get their own topbar through `app/book/[brand]/layout.tsx`; staff see the ☰ menu there. |
