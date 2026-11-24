# CLAUDE.md — Parking Operations System (ParkFlug · DUS Valet)

> This file is the single source of truth for this project. Read it fully before doing anything.
> Every new decision, rule or change of plan **must be added here** (see "Decision log" at the end) in the same pull request as the code that implements it.

---

## 1. What this project is

We are building our **own booking and operations system for our own airport parking business at Düsseldorf Airport (DUS)** — comparable to ParkStar (parkstar.de), but built by us, for us.

It runs **several brands** of the same company from one system (multi-brand from day one). Today two brands, **1–2 more will be added later** — adding a brand must be a matter of configuration in the admin, not new code:

| Brand | Service | Domain | Status |
|---|---|---|---|
| **ParkFlug** | Shuttle parking (customer parks at our lot, shuttle bus to the terminal) | parkflug.de | Starting; bookings currently via WhatsApp |
| **DUS Valet** | Valet parking (driver takes the car at the terminal) | dus-valet.de | Running |

**Goal:** replace WhatsApp/manual work with one system that handles online booking, payment, the daily transfer list, driver check-in/check-out on the phone, cash, invoices and reporting — as automated as possible.

### What this project is NOT
- It is **not** the X-Park marketplace (x-parkairport.de). X-Park is a separate Next.js platform (comparison marketplace with external providers, 20 % commission, provider payouts). It stays a separate system.
- There are **no external providers, no commission and no provider payouts** in this system.
- Later (Phase 8) X-Park will send its bookings for our lots into this system like any other booking channel.

### People
- **Fawaz** — owner/operator, product decisions. Communicate with him in **Arabic** (Levantine dialect is fine). He does not code.
- **Fawaz's brother** — developer. Builds and maintains the system together with Claude.
- Company / legal entity: the same company as DUS Valet (registered in the name of Mohammed Bahein). Impressum data = DUS Valet's.

---

## 2. Reference material (put these in `/docs`)
- `docs/spec.pdf` — full functional specification (Arabic), based on a walkthrough of the ParkStar demo: all admin screens, booking form, rates, partners, notifications, data model.
- `docs/ui-html/` — the approved static HTML/CSS screens (v2, 2026-11-21, incl. adults/children/seats). `styles/tokens.css` + `styles/app.css` are copied from it unchanged; port screens to React keeping the class names.
- `docs/prototype.html` — clickable prototype ("X-Park-Demo-v2.html"). **This is the UI/UX reference** for layout, screens and flows. Open it in Chrome. Data in it is fake.

When the spec and this file disagree, **this file wins** (it is newer).

---

## 3. Business rules (decided)

### Multi-brand
- One system, one database, several **brands** (ParkFlug, DUS Valet, more later). Each brand has its own: name, logo/colours, domain or booking page, email sender, terms (AGB), invoice sender data, lots, rates, extras and rules.
- **All prices, surcharges, cancellation rules and fees are data, configured per brand/rate in the admin — never hard-coded.** The values below are ParkFlug's current settings and serve as the default/seed.
- Admin users can see all brands or be limited to some; reports can be filtered by brand.

### Prices & surcharges (ParkFlug)
- Prices per booking length (1–30 days + price per extra day), per rate. Same price level as DUS Valet.
- **Seasonal price lists:** every rate has a **base price list** (valid all year) plus optional **season price lists** (e.g. Sommersaison, Wintersaison, Herbstsaison). Seasons are defined once (name, colour, active on/off, one or more date ranges, editable every year) and each rate has its own price table per season. The season is chosen by the **arrival date**; if seasons overlap, the higher one in the list wins (order = priority); if none matches, the base list applies. Admin can create a season table by copying the base list + X %, adjust all prices by %, and sees a 12-month season calendar. Dynamic occupancy pricing is applied on top of the chosen list.
- Booking length counts calendar days, arrival day and departure day included.
- **Persons & child seats:** a booking has **adults**, **children (up to 12 years)** and **child seats** (Babyschale 0–15 months, Kindersitz 1–4 years, Sitzerhöhung 4–12 years). Persons = adults + children. Up to 3 persons included in the shuttle; **+10 € per additional person**. Whether children count as persons (`kidsCountAsPerson`, default yes) and the price per seat (`seatPrice`, default 0 €) are **settings per brand/rate**, seats can be switched off (`seatsEnabled`). The transfer list shows how many seats must be prepared; the invoice has a line for seats if they are charged.
- **Oversize vehicles** (e.g. vans, > 5 m): **+25 %** on the parking price.
- **Late pickup / overstay:** **15 € per extra day (outdoor lot)**, **20 € per extra day (parking garage)**. Charged on site or online (see open questions).
- Optional extras (e.g. car wash) as add-ons with fixed prices.
- Coupons: fixed € or % discount, with validity dates.
- **Discounts:** a coupon or the returning-customer discount applies to the **full subtotal** (parking + oversize + extra persons + seats + extras). They are **never stacked**: the larger one wins. The oversize surcharge is calculated on the parking price only.
- Dynamic pricing (later phase): surcharge by occupancy thresholds (e.g. ≥70 % +5 %, ≥85 % +10 %, ≥95 % +20 %), configurable per lot.

### Cancellation
- **Free cancellation up to 24 hours before arrival.**
- **Less than 24 hours before arrival: full price, no refund.**
- Online payments are refunded automatically via Stripe when the cancellation is free.
- **Staff cancellation (admin):** same 24 h rule from the brand setting; staff can waive it ("Kulanz"); not possible once the car has arrived at the lot; a refunded booking is set to unpaid. Until Phase 3, Stripe refunds are done by hand.

### Payment
- **Cash on site** and **online via Stripe** (card, PayPal, Apple Pay … via Stripe). Customer chooses in the booking form.
- Payments go through **payment accounts** (table `PaymentAccount`): one row = one Stripe account; a brand points to one (`Brand.paymentAccountId`). Several brands may share an account (today ParkFlug + DUS Valet → "Park Gruppe"). A brand without an account offers cash only.
- **Secrets stay in environment variables only**, never in the database or in code. The database stores only the key NAME (`PaymentAccount.envKey`): `DEFAULT` → `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`; `ACME` → `STRIPE_SECRET_KEY_ACME`, `STRIPE_WEBHOOK_SECRET_ACME`, `STRIPE_PUBLISHABLE_KEY_ACME`. Admin page `/admin/payment-accounts` shows yes/no which variables exist (never the values). Other server secrets: `CRON_SECRET`.
- What the customer sees on the card statement (`Brand.statementDescriptor`) and the sender of e-mails/SMS (`emailFromName`, `emailFromAddress`, `emailReplyTo`, `smsSenderName`) are **brand settings**; nothing about an account or sender is hard-coded. SMTP/SMS credentials stay in the environment.
- Every `Payment` stores the account that took it (`paymentAccountId`); refunds always go back to that account.
- **Online flow:** the payment intent is created first, then the booking (`unconfirmed`) with a `PENDING` payment. The booking becomes `confirmed` + paid **only** when the signed webhook `payment_intent.succeeded` arrives and amount + currency match (otherwise it is flagged in the activity log, not confirmed). Webhooks are idempotent. Webhook URL is per ACCOUNT: `/api/stripe/webhook/<account slug>` (events `payment_intent.succeeded`, `payment_intent.canceled`).
- **Unpaid online bookings expire:** cron `GET|POST /api/cron/expire-unpaid` with `Authorization: Bearer <CRON_SECRET>` cancels them after `Brand.unpaidHoldMinutes` (default 30). It cancels the payment intent first; if the customer paid in the meantime the booking is confirmed instead.
- **Future (not built):** when the system is offered to other operators, each company connects its own Stripe account (Stripe Connect, direct charges, optional application fee) so customer money never passes through our account (collecting other companies' money would need a BaFin licence). The code already reads the account from `PaymentAccount`, so this only adds fields there.
- Cash is collected by the driver; every cash payment is logged per driver (daily cash register).

### Invoices (Germany)
- Invoices must follow German rules (**GoBD**): sequential numbers without gaps (e.g. `2026-000001`), never deleted, corrections only via **cancellation invoice (Stornorechnung)**.
- Invoice PDF is generated automatically and emailed after payment (online) or after check-out (cash).
- **Invoice is created automatically when the booking is paid**: online payment → at booking; cash → when the driver confirms cash at check-in/check-out; otherwise at the latest at check-out. Staff can also create it manually ("Rechnung jetzt erstellen").
- **On every booking page** there is an invoice section: invoice number, date, amount, status (paid/open, sent), buttons **view/download PDF**, **send by email**, **cancel (storno)**. A cancelled invoice gets a Stornorechnung (negative amounts, own number, reference to the original); then a new invoice can be created (e.g. after an address change).
- **Business customers:** billing fields on the booking — company name, billing address, VAT ID (USt-IdNr.); printed on the invoice ("z. Hd." contact name).
- Invoice content: seller data per brand (company, address, tax number, VAT ID, bank), invoice number/date, booking code, service period and plate, line items (parking, extra persons, extras), net / VAT / gross, payment note.
- **Invoices page** (menu "Rechnungen"): list of all invoices and cancellation invoices with search and filter (paid / open / storno), monthly totals incl. VAT, view and send buttons, monthly export.
- Monthly export for the tax advisor: ZIP of invoice PDFs (paid / open / cancelled) + Excel/CSV summary.
- VAT: parking 19 %. Whether the transfer part is shown separately at 7 % → **open question for the tax advisor**, do not implement until confirmed.
- **Legal entities:** a brand belongs to a Company (legal entity: name, address, tax number, VAT ID, bank; table `Company`, `Brand.companyId` optional until the data is entered). Invoice numbering (GoBD sequence) and Tageskasse/day closing are **per company**, not global. Today: two brands share one company, a third brand is a separate company; later every brand may become its own company. `Invoice` and `CashClosing` get their `companyId` when Phases 4/5 are built.
- Prices on customer pages show "inkl. MwSt." (no rate shown).

### Bookings
- Booking code: 9 characters = 5 letters + 4 digits (e.g. `KTOYG1199`), unique, used in the QR code. Generated codes skip look-alike characters (I, O, 0); validation stays loose (any 9 letters/digits).
- Booking statuses: `unconfirmed`, `confirmed`, `cancelled`.
- Transfer statuses (in order): `expected` → `arrived_at_lot` → `taken_to_airport` → `waiting_for_pickup` → `back_at_lot` → `departed`.
- Minimum lead time for online booking: 2 hours (`Brand.minLeadHours`). Bookings created by staff in the admin are not limited by it.
- **Public booking (website):** step 1 `/book/<brand slug>` shows the price (GET form, no personal data in the URL); step 2 `/book/<slug>/checkout` asks for customer data (POST). Price, rate, lead time and every system field (status, source, payment, paid) are decided by the server; the form only passes an allow-list of fields (`lib/booking/public-form.ts`). Phone is required. A double click returns the same booking (`Booking.checkoutKey`). A visitor never overwrites an existing customer (same e-mail = same customer; only an empty phone is filled).
- Cash bookings from the website are `confirmed` at once (not paid, payment cash). Online bookings stay `unconfirmed` until the webhook confirms the payment. The confirmation page `/book/<slug>/booked/<code>` shows no personal data.
- Unpaid online bookings (payment not completed) are cancelled automatically after 30 minutes and the capacity is released (configurable per brand: `Brand.unpaidHoldMinutes`).
- Footer of the booking pages links to the brand's Impressum, Datenschutz and AGB on its WordPress site (URLs are per-brand settings in admin → Tarife & Preise → "Rechtliche Links & Online-Buchung"; only `https://` URLs accepted).
- Shuttle capacity per time window (e.g. max persons per 30 min); if full, suggest other times.
- Every booking has **two separate notes**:
  - **Customer note** — written by the customer in the booking form ("What are you bringing?", quick chips: stroller, bulky luggage, ski, golf bag, wheelchair, dog box, child seat).
  - **Internal note** — written by staff/drivers, never shown to the customer.
  Both notes are shown on the dashboard ("Hinweise heute"), the transfer list and in the driver app.
- **Editing a booking (admin):** staff can change every field — customer name, phone, email, plate, vehicle, arrival/return date and time, flight numbers, persons, rate, extras, price, payment method, status, parking space, notes. When dates/rate/persons/extras change, the system recalculates the price and shows the difference (extra payment or refund); staff decide whether to apply it. Every change is written to the booking history (old → new value, who, when). After saving, staff can send an **updated booking confirmation** to the customer with one click.
- **Rebook (returning customers):** from any existing booking (e.g. after check-out) staff click "Erneut buchen": customer, contact, vehicle and internal note are copied; staff enter only new dates/flights/persons/rate; price is calculated; optional returning-customer discount (configurable, e.g. 5 % / 10 %); the new booking gets its own code, links to the old one in the history, and the confirmation can be sent with one click. Returning customers are flagged ("Stammkunde · N bookings").
- Booking source is stored on every booking: website, phone/WhatsApp, partner portal (Parkos, Holiday Extras, …), X-Park. For portals we also store their booking number and their commission (for reporting only).

### Marketing / offers to customers ("Angebote senden")
- Admin page to send discount campaigns to existing customers by **email or SMS**: choose channel, audience (all, returning customers, not booked for X months), discount %, validity; the system creates the coupon code automatically, shows a preview and the number of recipients, and logs every campaign.
- **Legal (Germany, UWG §7 + DSGVO) — must be built in:**
  - **Email** to existing customers without separate consent only under the existing-customer exception (§7(3) UWG): email collected during a booking, offer for our own similar services (parking), customer has not objected, and a clear notice of the right to object at collection (booking form) **and in every email** (unsubscribe link). Unsubscribed customers are excluded automatically.
  - **SMS/WhatsApp** advertising only with **explicit opt-in** (unchecked checkbox in the booking form). Store consent with timestamp and source; every SMS includes an opt-out.
  - Opt-outs are permanent until the customer opts in again. Have the texts checked by a lawyer before go-live.
- Coupons are data (code, %, valid until, source campaign); used in the booking form.

### Driver app
- Phone-first (PWA). Today's list split into **arrivals** and **pickups**, with time, flight status, plate, persons, payment.
- **Phone number is a tap-to-call button** everywhere in check-in/check-out.
- Check-in: scan QR / enter code → parking space, mileage, 4 photos, customer signature, internal note, cash received → handover protocol emailed to the customer.
- Check-out: confirm cash if unpaid, set status `departed`.

### Staff, roles & attendance
- Every employee has **their own login (email + password)**; invited by the admin by email, sets own password. ~5 employees at the start. Admin can deactivate a login (blocks sign-in, ends an open shift).
- Roles and what they see:
  - **Admin** (owner): everything, incl. total revenue, revenue chart, invoices, prices/seasons, marketing, staff & permissions, Tageskasse of any date + closing history.
  - **Büro / Disposition**: dashboard (without total revenue), transfer list, driver app, bookings, customers, occupancy, create booking, Tageskasse **today only**.
  - **Fahrer**: transfer list, driver app, **own** cash of today only.
- Enforce permissions **on the server** (route + API), not only by hiding menu items. Forbidden route → redirect to the role's home page.
- **Shifts / attendance**: a shift starts automatically at login; "end shift & log out" ends it; "switch user" keeps it running. Admin sees who is on duty now, who worked today, who did not come, check-ins/outs and cash per employee today, a 7-day attendance grid and hours.
- Every check-in, check-out and cash payment stores the employee who did it.

### Daily cash register (Tageskasse)
- Per day: totals by **Bar** (cash), **EC card** (terminal), **Online (Stripe)** (by payment date), **Partner** (by arrival date, minus commission, settled monthly).
- Bar & EC per employee. Driver chooses Bar or EC when collecting payment.
- **Day closing**: expected cash = opening float (Wechselgeld, default 150 €, configurable) + cash received; staff enters counted amount; difference stored; closing cannot be edited afterwards (GoBD), corrections as new entry. History of closings for the admin.
- Drivers record "cash handed over to office" with timestamp.

### Transfer list filters
- Every rate has a **service** (Shuttle / Valet) and a **lot type** (Parkhaus / Außenparkplatz). Valet cars are parked on the Außenparkplatz.
- Transfer list shows two filter rows with counts for the selected day: Alle / Shuttle / Valet and Alle / Parkhaus / Außenparkplatz (each tile: total, arrivals, pickups). Counts in one row respect the filter of the other row. Driver app has the same lot filter.

### Revenue chart (admin only)
- Stock-exchange style: daily revenue history, ranges 1W / 1M / 3M / 6M / 1J, line + area with 7-day average, or candlesticks (daily for ≤1M, weekly above, based on the 7-day average). Shows total for the range and % change vs. the previous period (green up / red down), last-value marker on the right axis, crosshair tooltip. Shown on the admin dashboard and in Auswertung. Data source: paid bookings / payments.

### Flights
- Customer enters outbound and return flight numbers. The system shows live status (landed / delayed +X min / on time) via a flight-data API (provider: see open questions). Delays move the pickup in the transfer list.

---

## 4. Tech stack (decided)

Same stack as the X-Park platform, so one person can maintain both.

- **Next.js (App Router) + TypeScript** — customer booking pages, admin, driver PWA and API routes in one app.
- **PostgreSQL + Prisma** (migrations in the repo).
- **Auth.js** (v5, credentials, JWT) with roles `admin`, `dispo`, `fahrer` (same names as in the data model).
- **Stripe** (Payment Intents, refunds, webhooks) through its REST API with `fetch` (no SDK), API version pinned in `lib/stripe/client.ts`; our own HMAC webhook-signature check (unit-tested). Stripe.js is loaded from js.stripe.com in the browser for the payment form.
- Email via SMTP (company mailbox), PDF generation server-side.
- Scheduled jobs (cron/queue) for reminders, SMS, flight-status polling, invoice exports.
- UI language: **German** (customer pages later also English). Code, comments, commits: **English**.
- Hosting: **Hetzner, EU** (GDPR/DSGVO). Separate **staging** and **production**.
- Design: modern (2026), calm, mobile-first, hamburger menu on all screen sizes, light/dark mode — as in `docs/prototype.html`. Admin colour themes (decided): **light = "Mist grey"** (bg `#eef0f3`, cards `#f8f9fa`, text `#1f2733`, primary `#2f4a7d`, success `#3d8b6a`) and **dark = "Graphite"** (bg `#17191d`, cards `#202328`, text `#e4e6ea`, primary `#8ea3d6`, success `#6fbf96`). No pure white, no saturated/neon colours, flat cards with fine borders. Brand colours per brand (ParkFlug: black/orange; DUS Valet: its own) — the prototype uses X-Park blue/green only for the demo.

### Proposed code structure
```
/app
  /book/[brand]               customer booking: price page, /checkout, /pay/[code], /booked/[code]  (NO parentheses in folder names, see §6)
  /manage/[code]              customer: view / cancel booking (Phase 3, PR 4)
  /(admin)/admin/...          dashboard, transfers, bookings, customers, occupancy, reports, rates, settings
  /(driver)/driver/...        driver PWA
  /api/...                    route handlers (stripe webhook, cron endpoints, partner import)
/lib
  /pricing                    pure price calculation (unit-tested)
  /booking                    booking rules, statuses, capacity checks
  /invoices                   numbering, PDF, storno
  /payments                   payment rules, account loader, webhook→booking confirmation
  /stripe                     REST client, env key names, signature check
  /brand                      sender identity (e-mail / SMS) from brand settings
  /notifications              email / SMS templates
  /flights                    flight-status adapter
/prisma                       schema.prisma, migrations, seed
/docs                         spec.pdf, prototype.html, decisions
/tests
```
Business logic (pricing, cancellation, capacity, invoice numbering) lives in `/lib` as pure functions **with unit tests**. No business rules hidden in UI components.

### Core data model (start here)
`Location` (lot) · `Company` (legal entity) · `PaymentAccount` (Stripe account, non-secret settings) · `Brand` · `Rate` · `PriceTable` (days 1–30 + extra day, validity) · `Extra` · `Coupon` · `Customer` · `Booking` (code, status, transferStatus, arrival, departure, flights, adults, kids, seatBaby, seatKind, seatBoost, plate, vehicle, rateId, source, price, paid, paymentMethod, customerNote, internalNote, spaceId, drivers) · `BookingExtra` · `Payment` · `ParkingSpace` · `HandoverProtocol` (photos, signature, mileage) · `Invoice` · `CashEntry` · `Message` (email/SMS log) · `User` (email, role: admin / dispo / fahrer, active) · `Shift` (user, start, end) · `CashClosing` (date, expected, counted, difference, user) · `ActivityLog`.

---

## 5. Build plan (phases)

Each phase ends with something usable on **staging**, shown to Fawaz, before the next starts.

| # | Phase | Goal | Done when | Status |
|---|---|---|---|---|
| 0 | Spec & prototype | Agree on what we build | Spec PDF + clickable prototype approved | ✅ Done |
| 1 | Foundation | Repo, stack, DB, auth, deploy | Next.js app on staging, Prisma schema for core model, email login with 3 roles (admin / Büro / Fahrer) and server-side permissions, CI (lint, typecheck, tests) | ✅ Done — running on Render, 3 logins (admin / Büro / Fahrer) created |
| 2 | Bookings & admin core | Staff can create and manage bookings | Rates & price tables in admin, price calculation with tests, create/edit/cancel booking in admin, bookings list with search & filters, customers list, both notes | 🟡 Code complete (2026-11-24) — awaiting test on staging and review by Fawaz. Done: schema, seed, `lib/pricing`, `lib/booking`, price admin, booking create / edit / cancel with history and price re-check, bookings list and customers list |
| 3 | Online booking + payment | Customers book themselves | Public booking form per brand, Stripe payment + webhooks, cash option, confirmation email with QR, customer cancel page with 24 h rule + automatic refund | 🟡 In progress (2026-11-25). Deployed on Render: PR 1 price page, PR 2a checkout + cash booking + company model + legal links, PR 2b online payment (payment accounts, Stripe, webhook, expiry cron). **Not yet tested end-to-end** with Stripe test mode. Open: PR 3 e-mail + QR, PR 4 manage page + refund + rate limiting, PR 5 terms / objection notice / SMS opt-in |
| 4 | Daily operations | Replace WhatsApp in daily work | Dashboard, transfer list (arrivals/pickups, overdue, notes), driver PWA with check-in/out, photos, signature, handover protocol email, Tageskasse (Bar/EC/Online/Partner, per employee, day closing), shifts & attendance, transfer filters Shuttle/Valet + Parkhaus/Außenparkplatz, tap-to-call | ⬜ |
| 5 | Invoices & reports | Clean books for the tax advisor | GoBD invoices + storno, automatic invoice emails, monthly ZIP/Excel export, revenue reports by source and payment method, stock-style revenue chart (admin) | ⬜ |
| 6 | Notifications & flights | Fewer calls, on-time pickups | SMS/email before arrival, SMS after landing, flight-status integration, thank-you/review email (Trustpilot link) | ⬜ |
| 7 | Capacity, pricing & marketing | More revenue | Shuttle time-window capacity, parking-space allocation, lot blocking dates, seasonal price lists, dynamic pricing by occupancy, coupons, email/SMS campaigns with consent handling | ⬜ |
| 8 | Channels | All bookings in one place | Import from portals (Parkos etc.) and from X-Park via API, per-source commission reporting | ⬜ |
| 9 | Go-live | Production | Production server, backups, monitoring, DSGVO pages, 2 weeks parallel run with WhatsApp, then switch | ⬜ |

Priority rule: **Phase 1 → 4 is the MVP.** Do not start Phase 6+ features before Phase 4 is in daily use.

### Current state (2026-11-25) — read this first in a new session
- **Live on Render:** Phases 1–2, and Phase 3 PR 1 / 2a / 2b. The public pages work (`/book/<slug>`; the slug is shown in admin → Tarife & Preise).
- **To do before Phase 3 can be called tested** (Fawaz + brother, on staging, test mode only):
  1. Admin → Zahlungskonten: create "Park Gruppe" (slug `park-gruppe`, env key `DEFAULT`) and assign it to the brands in Tarife & Preise → "Zahlung & Absender"; fill statement text and sender fields.
  2. Render environment: `STRIPE_WEBHOOK_SECRET` (from the Stripe webhook endpoint `<domain>/api/stripe/webhook/park-gruppe`, events `payment_intent.succeeded` + `payment_intent.canceled`) and `CRON_SECRET` (long random text). Check ✅ on the Zahlungskonten page.
  3. Test booking with cash, and with a Stripe test card (`4242 4242 4242 4242`): the booking must show `confirmed` + paid only after the webhook. Test the double click on the submit button. Use e-mails `@example.test` and last names starting with `TEST`.
  4. A scheduler must call `/api/cron/expire-unpaid` every ~5 minutes (Render Cron Job, or an external service that can send the `Authorization` header).
- **Next steps in order:** PR 3 (confirmation e-mail with QR and booking code, sender from brand settings, SMTP password only in env) → PR 4 (`/manage/[code]`: view + cancel with the 24 h rule, automatic Stripe refund through the payment's own account, rate limiting in a database table for `/manage`, the pay/booked pages and the coupon field of the price page) → PR 5 (AGB acceptance, UWG §7 objection notice, unchecked SMS opt-in, stored consent). **The public pages must not be linked from any website before PR 5.**
- Known limits: no capacity check yet (Phase 7); no invoices yet (Phase 5); refunds are manual until PR 4; `db push` is used instead of migrations (staging only, see §6).

---

## 6. How we work together

- **GitHub:** private repository under the company's **GitHub Organization**. Fawaz and his brother each use their **own** GitHub account (no shared logins). Fawaz = Owner of the Organization.
- **Branches:** `main` is protected and always deployable. Work happens on branches (`feat/...`, `fix/...`). Every change goes in via a **pull request** with a clear description:
  - What changed and why (1–3 sentences, plain language Fawaz can understand)
  - How it was tested
  - Screenshots for UI changes
  - Whether CLAUDE.md was updated
- **Commits:** small, English, descriptive (`feat: add 24h cancellation rule`).
- **Staging first:** every change is tested on staging before production. Nobody edits production directly.
- **Tests:** pricing, cancellation, capacity and invoice numbering always have unit tests; CI must pass before merge.
- **Claude** writes code, proposes PRs and explains changes; the brother reviews, tests and deploys. Claude never deploys to production on its own.
- **Render build command (staging):** `npm install && npx prisma generate && npx prisma db push && npx prisma db execute --file prisma/partial-index.sql --schema prisma/schema.prisma && npm run build`. `prisma migrate deploy` does NOT work here (no migration files). If `db push` stops with a data-loss warning, read it first; for a harmless one (e.g. a new unique constraint on a new nullable column) add `--accept-data-loss` for ONE deploy and remove it again. Real migrations are introduced before production (Phase 9).
- **Uploads from a tablet:** the GitHub upload once dropped the parentheses of a route-group folder (`(public)` became `public` and the pages returned 404). Rules: no NEW folders with parentheses; after every upload check the folder names and paths in GitHub (`park-operations/app/...`). Existing groups `(admin)` and `(staff)` stay as they are.

---

## 7. Rules (non-negotiable)

1. **No passwords, API keys or tokens in the code, in commits, in PR texts, in chats or in emails.** Secrets live only in `.env` (never committed) and in the server's environment. Commit a `.env.example` with variable **names only**.
2. Use a password manager (e.g. Bitwarden) to share access. Every person has their own account on every service (GitHub, Hetzner, Stripe, …), with 2FA on.
3. Customer data is personal data (DSGVO): never paste real customer data into chats or test fixtures; use fake seed data. Test bookings on staging use customer e-mails `@example.test` and last names starting with `TEST`; they are purged before go-live (Phase 9).
4. **Every new decision goes into this file** (section 3/4/5 and the Decision log) in the same PR.
5. When something is unclear, **ask Fawaz** instead of guessing — especially prices, legal and money topics.
6. Do not copy ParkStar's code, texts or design. We copy features and workflows only.

---

## 8. Open questions (not blocking now)
These do **not** block Phases 1–4. Build everything configurable and use clearly marked placeholder/seed values. Ask Fawaz when the phase in brackets is reached:
- DUS Valet (and future brands): prices, included persons, surcharges, cancellation rule — entered in the admin when the brand is set up. [Phase 9]
- VAT split for the transfer part (19 % vs 7 %) — tax advisor. Keep VAT rates configurable. [Phase 5]
- Late-pickup fee: charged online automatically or collected on site? Build it as a fee that the driver/admin can add at check-out. [Phase 4]
- SMS provider (e.g. seven.io) and flight-data API provider (e.g. AeroDataBox) — choose and create accounts in the company's name. [Phase 6]
- Domain for the admin/driver app (e.g. `app.<company-domain>`) and Hetzner project for staging/production. [Phase 1 staging can use a temporary domain]
- Which partner portals first (Parkos, Holiday Extras, …) and whether they provide an API. [Phase 8]
- Invoice sender data per brand (company name, address, tax number). [Phase 5]
- Persons/seats: do children count as persons for the surcharge, and are child seats free? Built as settings (`kidsCountAsPerson`, `seatPrice`); Phase 2 runs with the defaults yes / 0 € (decided 2026-11-22), change in the admin if the business decides otherwise.
- Brand design for each brand's booking page (logo, colours). Decided for now: neutral theme (2026-11-24); brand colours/logo come later.
- Stripe: account in the company's name (Fawaz's own login, 2FA on) — created, test mode. Keys live only in the server environment; variable names (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `CRON_SECRET`, and the suffixed names for extra accounts) go into `.env.example` (names only). Switch to live keys only at go-live. [Phase 9]
- Company e-mail account (SMTP) for confirmation e-mails: ready (2026-11-24). Its credentials go into the environment (names only in `.env.example`). [PR 3]
- Sender domains: the SMTP provider must be allowed to send from each brand's domain (SPF/DKIM), otherwise mails land in spam. [PR 3]
- Company data for each legal entity (name, address, tax number, VAT ID, bank) and which brand belongs to which company. [Phase 5]
- **The third brand is a separate legal entity:** may it take its online payments on the "Park Gruppe" Stripe account? Collecting money for another legal entity may raise the BaFin question. Ask the tax advisor/lawyer BEFORE that brand takes online payments; until then give it its own payment account or cash only. [before that brand goes live online]
- Which scheduler calls the expire-unpaid endpoint every ~5 minutes (Render Cron Job, or a free external service such as cron-job.org)? [Phase 3 testing]
- `/manage/[code]` is reached with the booking code alone (decided, with rate limiting). Proposal: also ask for the e-mail address as a second factor, because the code appears in QR codes and forwarded mails. Not decided. [PR 4]
- Public coupon check lets visitors probe codes: covered by the rate limiting of PR 4 (extend it to the price and checkout pages). [PR 4]

---

## 9. Decision log
| Date | Decision |
|---|---|
| 2026-11-17 | Build our own operations system modelled on ParkStar's features; spec written from the ParkStar demo. |
| 2026-11-17 | Clickable prototype first, shown to partners before coding. |
| 2026-11-18 | Prototype redesigned: modern UI, hamburger menu, customer note + internal note, tap-to-call, flight status. |
| 2026-11-18 | Tech stack: Next.js + TypeScript, PostgreSQL + Prisma, Stripe — same as X-Park (not Laravel). |
| 2026-11-20 | Scope: our own lots only (ParkFlug + DUS Valet). No providers/commission/payouts; X-Park stays separate and connects later as a booking channel. |
| 2026-11-20 | Payment in v1: cash on site + online via Stripe. |
| 2026-11-21 | Invoices visible on each booking (PDF, email, storno + re-issue), billing address for companies, invoices page. |
| 2026-11-21 | Marketing campaigns by email/SMS with legal consent handling (email: existing-customer exception + unsubscribe; SMS: explicit opt-in). |
| 2026-11-20 | Seasonal price lists per rate (base + seasons with date ranges, by arrival date, priority order). |
| 2026-11-20 | "Erneut buchen": rebook a returning customer from an old booking with new dates (data copied, optional discount). |
| 2026-11-20 | Admin can edit all booking fields; price recalculated with difference shown; change history; "send updated confirmation" after save. |
| 2026-11-20 | Admin themes: light "Mist grey" + dark "Graphite"; calm, modern, no pure white. |
| 2026-11-20 | Multi-brand from day one (ParkFlug, DUS Valet, 1–2 more later). All prices/rules are admin configuration, not code. Open business questions do not block Phases 1–4. |
| 2026-11-20 | Code in a private repo under a company GitHub Organization; each person uses their own account; every change via PR; secrets only in `.env`; every decision recorded in CLAUDE.md. |
| 2026-11-21 | Staff accounts with own email login; roles Admin / Büro / Fahrer; only the admin sees totals, revenue chart, invoices, prices, marketing and staff. Shift starts at login; admin sees attendance. |
| 2026-11-21 | Tageskasse per day: Bar, EC, Online, Partner; cash per employee; day closing with counted amount and difference. |
| 2026-11-21 | Transfer list + driver app filters: Shuttle / Valet and Parkhaus / Außenparkplatz with today's counts. Valet = Außenparkplatz. |
| 2026-11-21 | Revenue chart in stock-exchange style (line/candles, 1W–1J, change vs. previous period), admin only. |
| 2026-11-21 | Partner/portal integration stays in Phase 8 (after the MVP). Reference: X-Park admin has a read-only "Partner-API" (per-provider API keys `xpk_…`, `GET /api/partner/bookings?changed_since=&limit=`, polled every 5 min by ParkingPro, request log with IP/status) and an outgoing webhook page ("Integrationen"). Our system will need both directions: receive bookings (API key per channel or pull from X-Park's feed) and later publish prices/availability. From Phase 1 every booking stores source, external booking number and commission. |
| 2026-11-22 | Persons split into adults + children + child seats (Babyschale / Kindersitz / Sitzerhöhung); settings per brand/rate; shown on transfer list, driver app, invoice. UI v2 is the reference. |
| 2026-11-22 | Role names are `admin`, `dispo`, `fahrer` everywhere (stack section said owner/dispatcher/driver — corrected). |
| 2026-11-22 | Phase 1 permissions: one rule table in `lib/permissions.ts` (deny by default, unknown `/admin/*` = admin only), enforced in middleware **and** in every page/API via `requirePath/requireRole/requireApiRole`; user re-read from DB each request so deactivation is immediate. Cash page open to all roles with scope any-day / today / own-today. |
| 2026-11-22 | Fonts self-hosted via `next/font` (no Google Fonts request from visitors, DSGVO). Money stored as integer cents. |
| 2026-11-22 | Staff invitation by e-mail (set own password) is built with the staff page in Phase 4; Phase 1 uses seeded users. |
| 2026-11-22 | Until the staff page exists (Phase 4), logins are created with `npm run user:create` (prisma/create-user.ts): random password printed once or `--password`, `--reset`, `--deactivate`. Seed users (`*@example.test`) must be deactivated/removed before real data goes in. |
| 2026-11-22 | Because staff work from tablets (no shell on Render free), a minimal admin page `/admin/staff` (admin only, server-checked) creates logins, resets passwords (shown once) and locks/unlocks users; deactivating ends the open shift. E-mail invitation + attendance view stay in Phase 4. `npm run user:create` remains as CLI fallback. |
| 2026-11-22 | Phase 2 starts with the default settings `kidsCountAsPerson = yes`, `seatPrice = 0 €` (Fawaz: start with defaults; still configurable per brand/rate). |
| 2026-11-23 | Schema is applied on Render by `prisma db push` in the build command (no migration files; the unused Phase 2 migration folder was deleted). The rule "one base price table per rate" is a partial unique index that Prisma cannot express, so it lives in `prisma/partial-index.sql` and runs after every `db push`. |
| 2026-11-23 | Phase 2 schema additions: per-rate overrides (`kidsCountAsPerson`, `seatsEnabled`, `oversizeSurchargePct`), `Brand.returningDiscountPct`, `Booking.discountCents` / `priceBreakdown` / `cancelledAt` / `cancelFree`, indexes on `Customer.phone` and `ActivityLog.bookingId`. Seed prices are placeholders (names start with `[PLACEHOLDER]`). |
| 2026-11-23 | Pricing (`lib/pricing`, pure, unit-tested): days = calendar days in Europe/Berlin, arrival and departure day included; day prices 1–30 + price per extra day; oversize % on parking only; +10 € per person above 3 (children count by default); seats free by default; one discount only (coupon or returning customer, the larger), applied to the full subtotal; price differences on edit are shown as extra payment / refund. |
| 2026-11-23 | Booking rules (`lib/booking`, pure, unit-tested): code = 5 letters + 4 digits without I/O/0; min lead time and free-cancel window come from the brand (defaults 2 h / 24 h; exactly 24 h before arrival is still free); late cancellation = no refund and the full price stays due; history stored as `{field: {from, to}}` in `ActivityLog.changes`. |
| 2026-11-23 | The public "manage booking" page (Phase 3) must be rate-limited, because it is reached with the booking code alone. |
| 2026-11-23 | Price admin (`/admin/rates`, admin only): brand rules, rates, base price table (1–30 days + extra day, all 30 prices required and > 0), extras. New rates start inactive and cannot be activated before a price table is saved. Extras are deactivated, never deleted. Prices are typed in euro (German comma accepted) and stored as cents. Every change is written to `ActivityLog` (old → new). |
| 2026-11-23 | Booking create (`/admin/bookings/new`, admin + dispo): date/time fields are Berlin wall-clock time, converted on the server; the price is always calculated on the server (an optional manual price is stored next to the calculated one in `priceBreakdown`); same e-mail (case-insensitive) = same customer; staff are not limited by the online minimum lead time. Staff can choose source phone/partner portal/X-Park and payment cash/EC/partner (online only comes from Stripe). "Paid" is a flag for now; cash register entries come in Phase 4. Brand access follows `User.allBrands` / `User.brands`. |
| 2026-11-23 | Test data convention: customer e-mails `@example.test`, last names starting with `TEST`; purged before go-live (Phase 9). |
| 2026-11-23 | Working mode for now: files are uploaded straight to `main` through the GitHub web interface from a tablet and deployed to Render by auto-deploy (temporary exception to §6 branches + PR, until the brother reviews). Return to branch + PR when he joins. To be confirmed by Fawaz. |
| 2026-11-24 | Booking edit (`/admin/bookings/[id]`): every field is editable and every change is logged (old → new). The price is NOT changed automatically: a "Preisprüfung" card re-prices with today's price list (extras keep their booked price, a used coupon is judged at the booking's creation date) and shows the difference (extra payment / refund); staff apply it with one click. Only a typed manual price applies immediately. Changing customer data on a booking changes the customer record. Payment "Online" and source "Website" can never be set by hand. |
| 2026-11-24 | Staff cancellation: free until `freeCancelHours` before arrival (brand setting), otherwise the full price stays due and nothing is refunded; staff can waive the rule ("Kulanz"); not possible after the car has arrived; a refunded booking becomes unpaid (revenue reports use the paid flag); Stripe refunds stay manual until Phase 3. |
| 2026-11-24 | Bookings list (`/admin/bookings`): default view "anstehend" (departure from today, Berlin time, soonest first); searching, a customer filter or a date range searches all bookings. Every search word must match code, plate, external number or customer name/e-mail/phone/company. Filters: brand, status, paid, arrival/departure date range; 25 per page. Users limited to some brands only see those brands. Customers list: search + "Stammkunde" flag from 2 non-cancelled bookings. Known limitation: plate and phone search is plain text (must match the stored format); normalised search comes with the driver check-in (Phase 4). |
| 2026-11-24 | Phase 2 is code-complete; it counts as done after Fawaz has tested it on staging. Phase 3 starts only after that and after the Stripe test account exists. |
| 2026-11-24 | Phase 3, PR 1: public page `/book/[brand]` (German, neutral theme scoped to `.pub`, light/dark by system setting) is step 1 of 2: a GET form for trip data that shows the price. The price always comes from the server via `computeBookingPrice` → `lib/pricing`; the rate must belong to the brand, be active and have a base price table; `brand.minLeadHours` is checked. No personal data in the URL. |
| 2026-11-24 | Company (legal entity) model: brands belong to a company; invoice numbering and Tageskasse per company. "inkl. MwSt." without rate. Unpaid online bookings auto-cancel after 30 min. Legal links per brand point to the WordPress sites. Selling the system to other operators: keep in mind, do not build now. |
| 2026-11-24 | PR 2a: `Company` table; `Brand.companyId` optional until the company data is entered (Phase 5); `Invoice`/`CashClosing` get `companyId` in Phases 4/5. New brand fields `impressumUrl`, `privacyUrl`, `unpaidHoldMinutes`; `Booking.checkoutKey` (unique) for double-click protection. Public checkout reuses the admin parser behind an allow-list; phone required; a visitor never overwrites an existing customer. |
| 2026-11-24 | Payment accounts in the database (`PaymentAccount`: name, slug, env key name, active); brands point to one; secrets only in environment variables. **Replaces "one Stripe account, no Connect".** Webhook per account (not per brand). Statement descriptor and e-mail/SMS sender per brand. Stripe Connect (direct charges, application fee) for selling the system: later, not built; money of other companies must not pass through our account (BaFin). |
| 2026-11-24 | PR 2b online payment: Stripe REST via fetch (no SDK), API version pinned `2024-06-20`; own HMAC signature check with tests; booking confirmed only by the webhook (amount/currency must match, else flagged); expiry cron cancels the intent first; a booking that expired while its payment arrived is re-confirmed (`payment_reconfirmed`); a rejected statement descriptor is retried without it; online payment needs ≥ 0,50 €. |
| 2026-11-24 | Render build command uses `prisma db push` + `partial-index.sql` (not `migrate deploy`); `--accept-data-loss` only once for a harmless warning, then removed. |
| 2026-11-25 | Public pages moved from `app/(public)/` to `app/book/` (no parentheses) because the tablet upload stripped the parentheses and the booking pages returned 404. Rule: no new folders with parentheses; check paths in GitHub after each upload. Footer imports use the alias `@/app/book/_components/legal-footer`. |
