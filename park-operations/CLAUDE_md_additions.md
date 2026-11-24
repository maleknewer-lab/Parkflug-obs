## 1) Phase table (section 5) — change row 3 status to:
🟡 In progress (PR 1: public price quote at /book/[brand] — no booking or payment yet)

## 2) Decision log (section 9) — append:
| 2026-11-24 | Phase 3, PR 1: public page `/book/[brand]` (German, neutral theme scoped to `.pub`, light/dark by system setting) is step 1 of 2: a GET form for trip data (rate, dates, persons, seats, oversize, extras, coupon) that shows the price. The price always comes from the server via `computeBookingPrice` → `lib/pricing`; the rate must belong to the brand and be active with a base price table; `brand.minLeadHours` is checked (`checkLeadTime`). No personal data in the URL: name, e-mail and phone are sent by POST in step 2 (PR 2). Creates no booking. Pure parser `lib/booking/quote.ts` (unit-tested). |
| 2026-11-24 | Decision (Fawaz, 2026-11-24): per-brand payment accounts are wanted for the future (brands may use their own Stripe account). This replaces "one Stripe account, no Connect". Design for PR 2: `getStripeForBrand(brand)`, per-brand webhook `/api/stripe/webhook/[brand]`, `Payment` stores brand + Stripe account, key NAMES per brand in env vars (option A), default = the company account. |

## 3) Open questions (section 8) — add:
- Price wording on public pages: show "inkl. 19 % MwSt." (PAngV)? Needs confirmation with the tax advisor together with the transfer VAT question. [Phase 3 / 5]
- Impressum and Datenschutz URLs per brand for the public footer (legal requirement before go-live). [Phase 3 → 9]
- Public coupon check lets visitors probe codes; covered by the rate limiting that arrives in PR 4 (extend it to this page). [PR 4]
