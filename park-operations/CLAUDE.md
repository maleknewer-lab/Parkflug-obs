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
- Dynamic pricing (later phase): surcharge by occupancy thresholds (e.g. ≥70 % +5 %, ≥85 % +10 %, ≥95 % +20 %), configurable per lot.

### Cancellation
- **Free cancellation up to 24 hours before arrival.**
- **Less than 24 hours before arrival: full price, no refund.**
- Online payments are refunded automatically via Stripe when the cancellation is free.

### Payment
- **Cash on site** and **online via Stripe** (card, PayPal, Apple Pay … via Stripe). Customer chooses in the booking form.
- Stripe account = the company's account. One Stripe account, no Stripe Connect needed (no providers).
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

### Bookings
- Booking code: 9 characters (e.g. `KTOYG1199`), unique, used in the QR code.
- Booking statuses: `unconfirmed`, `confirmed`, `cancelled`.
- Transfer statuses (in order): `expected` → `arrived_at_lot` → `taken_to_airport` → `waiting_for_pickup` → `back_at_lot` → `departed`.
- Minimum lead time for online booking: 2 hours.
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
- **Stripe** (Payment Intents, refunds, webhooks).
- Email via SMTP (company mailbox), PDF generation server-side.
- Scheduled jobs (cron/queue) for reminders, SMS, flight-status polling, invoice exports.
- UI language: **German** (customer pages later also English). Code, comments, commits: **English**.
- Hosting: **Hetzner, EU** (GDPR/DSGVO). Separate **staging** and **production**.
- Design: modern (2026), calm, mobile-first, hamburger menu on all screen sizes, light/dark mode — as in `docs/prototype.html`. Admin colour themes (decided): **light = "Mist grey"** (bg `#eef0f3`, cards `#f8f9fa`, text `#1f2733`, primary `#2f4a7d`, success `#3d8b6a`) and **dark = "Graphite"** (bg `#17191d`, cards `#202328`, text `#e4e6ea`, primary `#8ea3d6`, success `#6fbf96`). No pure white, no saturated/neon colours, flat cards with fine borders. Brand colours per brand (ParkFlug: black/orange; DUS Valet: its own) — the prototype uses X-Park blue/green only for the demo.

### Proposed code structure
```
/app
  /(public)/book/[brand]      customer booking form + confirmation
  /(public)/manage/[code]     customer: view / cancel booking
  /(admin)/admin/...          dashboard, transfers, bookings, customers, occupancy, reports, rates, settings
  /(driver)/driver/...        driver PWA
  /api/...                    route handlers (stripe webhook, cron endpoints, partner import)
/lib
  /pricing                    pure price calculation (unit-tested)
  /booking                    booking rules, statuses, capacity checks
  /invoices                   numbering, PDF, storno
  /notifications              email / SMS templates
  /flights                    flight-status adapter
/prisma                       schema.prisma, migrations, seed
/docs                         spec.pdf, prototype.html, decisions
/tests
```
Business logic (pricing, cancellation, capacity, invoice numbering) lives in `/lib` as pure functions **with unit tests**. No business rules hidden in UI components.

### Core data model (start here)
`Location` (lot) · `Brand` · `Rate` · `PriceTable` (days 1–30 + extra day, validity) · `Extra` · `Coupon` · `Customer` · `Booking` (code, status, transferStatus, arrival, departure, flights, adults, kids, seatBaby, seatKind, seatBoost, plate, vehicle, rateId, source, price, paid, paymentMethod, customerNote, internalNote, spaceId, drivers) · `BookingExtra` · `Payment` · `ParkingSpace` · `HandoverProtocol` (photos, signature, mileage) · `Invoice` · `CashEntry` · `Message` (email/SMS log) · `User` (email, role: admin / dispo / fahrer, active) · `Shift` (user, start, end) · `CashClosing` (date, expected, counted, difference, user) · `ActivityLog`.

---

## 5. Build plan (phases)

Each phase ends with something usable on **staging**, shown to Fawaz, before the next starts.

| # | Phase | Goal | Done when | Status |
|---|---|---|---|---|
| 0 | Spec & prototype | Agree on what we build | Spec PDF + clickable prototype approved | ✅ Done |
| 1 | Foundation | Repo, stack, DB, auth, deploy | Next.js app on staging, Prisma schema for core model, email login with 3 roles (admin / Büro / Fahrer) and server-side permissions, CI (lint, typecheck, tests) | 🔧 In progress — code written 2026-11-22, **not yet run/installed**; staging deploy pending |
| 2 | Bookings & admin core | Staff can create and manage bookings | Rates & price tables in admin, price calculation with tests, create/edit/cancel booking in admin, bookings list with search & filters, customers list, both notes | ⬜ |
| 3 | Online booking + payment | Customers book themselves | Public booking form per brand, Stripe payment + webhooks, cash option, confirmation email with QR, customer cancel page with 24 h rule + automatic refund | ⬜ |
| 4 | Daily operations | Replace WhatsApp in daily work | Dashboard, transfer list (arrivals/pickups, overdue, notes), driver PWA with check-in/out, photos, signature, handover protocol email, Tageskasse (Bar/EC/Online/Partner, per employee, day closing), shifts & attendance, transfer filters Shuttle/Valet + Parkhaus/Außenparkplatz, tap-to-call | ⬜ |
| 5 | Invoices & reports | Clean books for the tax advisor | GoBD invoices + storno, automatic invoice emails, monthly ZIP/Excel export, revenue reports by source and payment method, stock-style revenue chart (admin) | ⬜ |
| 6 | Notifications & flights | Fewer calls, on-time pickups | SMS/email before arrival, SMS after landing, flight-status integration, thank-you/review email (Trustpilot link) | ⬜ |
| 7 | Capacity, pricing & marketing | More revenue | Shuttle time-window capacity, parking-space allocation, lot blocking dates, seasonal price lists, dynamic pricing by occupancy, coupons, email/SMS campaigns with consent handling | ⬜ |
| 8 | Channels | All bookings in one place | Import from portals (Parkos etc.) and from X-Park via API, per-source commission reporting | ⬜ |
| 9 | Go-live | Production | Production server, backups, monitoring, DSGVO pages, 2 weeks parallel run with WhatsApp, then switch | ⬜ |

Priority rule: **Phase 1 → 4 is the MVP.** Do not start Phase 6+ features before Phase 4 is in daily use.

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

---

## 7. Rules (non-negotiable)

1. **No passwords, API keys or tokens in the code, in commits, in PR texts, in chats or in emails.** Secrets live only in `.env` (never committed) and in the server's environment. Commit a `.env.example` with variable **names only**.
2. Use a password manager (e.g. Bitwarden) to share access. Every person has their own account on every service (GitHub, Hetzner, Stripe, …), with 2FA on.
3. Customer data is personal data (DSGVO): never paste real customer data into chats or test fixtures; use fake seed data.
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
- Persons/seats: do children count as persons for the surcharge, and are child seats free? Built as settings (`kidsCountAsPerson`, `seatPrice`), defaults yes / 0 €. [Phase 2 — confirm with Fawaz]
- Brand design for each brand's booking page (logo, colours). [Phase 3 — use a neutral default theme until then]

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
