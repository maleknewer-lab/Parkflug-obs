# CLAUDE.md additions for PR 2a (apply in the same PR)

## Section 3 → Invoices (add)
- Legal entities: a brand belongs to a Company (legal entity: name, address, tax number, VAT ID, bank). Invoice numbering (GoBD sequence) and Tageskasse/day closing are per company, not global. Today: two brands share one company, a third brand is a separate company; later every brand may become its own company.
- Prices on customer pages show "inkl. MwSt." (no rate shown).

## Section 3 → Bookings (add)
- Unpaid online bookings (Stripe payment not completed) are cancelled automatically after 30 minutes and the capacity is released (configurable per brand: `Brand.unpaidHoldMinutes`).
- Footer of the booking pages links to the brand's Impressum, Datenschutz and AGB on its WordPress site (URLs are per-brand settings: admin → Preise → "Rechtliche Links & Online-Buchung").
- Public checkout: cash bookings are confirmed at once (`confirmed`, not paid, payment CASH, source WEBSITE); online bookings stay `unconfirmed` until the Stripe webhook reports success (PR 2b). Status, source, payment method, paid flag and price are decided by the server, never by the form.

## Section 5 → Phase 3 row status
🟡 In progress — PR 1 (price page), PR 2a (checkout, cash booking, company model, legal links) done; PR 2b (Stripe), 3 (e-mail + QR), 4 (manage page + rate limiting), 5 (terms, objection notice, SMS opt-in) open. **The public pages must not be linked from any website before PR 5.**

## Section 8 → Open questions
- ADD: Company data for each legal entity and which brand belongs to which company. [Phase 5]
- REMOVE (decided): "Price wording on public pages" and "Impressum and Datenschutz URLs" from the PR 1 additions.
- KEEP from PR 1: public coupon probing is covered by the rate limiting in PR 4 (extend it to the price and checkout pages).

## Section 9 → Decision log (add)
| 2026-11-24 | Company (legal entity) model: brands belong to a company; invoice numbering and Tageskasse per company. "inkl. MwSt." without rate. Unpaid online bookings auto-cancel after 30 min. Legal links per brand point to the WordPress sites. Selling the system to other operators: keep in mind, do not build now. |
| 2026-11-24 | Phase 3, PR 2a: `Company` table added; `Brand.companyId` optional until the company data is entered (Phase 5); `Invoice` and `CashClosing` get their `companyId` when Phases 4/5 are built (the tables are still empty). New brand fields `impressumUrl`, `privacyUrl`, `unpaidHoldMinutes`; `Booking.checkoutKey` (unique) makes a double click or retry return the same booking. |
| 2026-11-24 | Public checkout `/book/[brand]/checkout`: customer fields go through the same parser as the admin (`parseBookingForm`) behind an allow-list (`lib/booking/public-form.ts`); phone is required; trip data is re-priced on the server; a visitor never overwrites an existing customer's data (an empty phone may be filled in). The confirmation page `/book/[brand]/booked/[code]` shows no personal data. |
| 2026-11-24 | Per-brand payment accounts (replaces "one Stripe account"): key NAMES per brand in Render environment variables (option A: `STRIPE_SECRET_KEY_<PREFIX>`, `STRIPE_WEBHOOK_SECRET_<PREFIX>`, `STRIPE_PUBLISHABLE_KEY_<PREFIX>`); brands without a prefix use the company account (`STRIPE_SECRET_KEY` …). Implemented in PR 2b behind `getStripeForBrand(brand)`. |
