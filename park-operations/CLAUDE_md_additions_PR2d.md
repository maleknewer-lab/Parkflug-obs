# CLAUDE.md additions (same PR as the rates-page redesign and payment-method choice)

## Section 3 → Payment (add)
- **The customer chooses the payment method first** (booking form, step 6): Karte (Visa, Mastercard, Amex, Apple Pay, Google Pay), PayPal, or Bar vor Ort. For an online choice the Stripe payment intent is created for exactly that method (`payment_method_types` = `["card"]` or `["paypal"]`); the pay page then shows only that method. PayPal is offered only when the payment account has `paypalEnabled` (switch in `/admin/payment-accounts`, to be ticked only after PayPal is activated in the Stripe dashboard). Choice rules: `lib/payments/methods.ts`.
- The coupon field ("Gutscheincode einlösen") sits in the booking summary, not next to the payment step.

## Section 3 → Admin UI (add)
- **Tarife & Preise** follows the prototype: header, brand switch (`?brand=`), "Personen & Kindersitze" + "Regeln & Zuschläge", one card per rate with its 1–30 day price grid and "Jeder weitere", extras, legal links, payment & sender. Every form sends `returnBrand` so saving returns to the same brand. Seasons and occupancy pricing: Phase 7. Styles: `app/(admin)/admin/rates/rates.css`.

## Section 9 → Decision log (add)
| 2026-11-26 | Payment method is chosen first on the booking form (Karte / PayPal / Bar); the Stripe intent is restricted to the chosen method; `PaymentAccount.paypalEnabled` switches PayPal on per account. Replaces the single "Online" choice with automatic payment methods. |
| 2026-11-26 | Tarife & Preise rebuilt in the prototype layout (brand switch, price grid per rate, rules in `kgrid`); rate actions keep the selected brand through `returnBrand`; price tables can be saved from the list page. |
