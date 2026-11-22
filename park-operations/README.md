# Park Operations (ParkFlug · DUS Valet)

Own booking & operations system for Düsseldorf Airport parking. **Read `CLAUDE.md` first** — it is the single source of truth.

## Status
Phase 1 (Foundation): app skeleton, Prisma core model, e-mail login with 3 roles (`admin`, `dispo`, `fahrer`),
server-side permissions, shifts, CI. Pages of later phases are placeholders; the finished layouts are in `docs/ui-html`.

## Run locally
```bash
cp .env.example .env        # fill in DATABASE_URL; AUTH_SECRET via: npx auth secret
npm install
npx prisma migrate dev --name init
npm run db:seed             # fake users admin/dispo/fahrer@example.test (password printed, or SEED_PASSWORD)
npm run dev
```
Staff logins (no shell needed on the server, run from your own machine with `DATABASE_URL` = Render *External* URL):
```bash
npm run user:create -- --email=ali@firma.de --name="Ali" --role=fahrer   # roles: admin | dispo | fahrer
npm run user:create -- --email=ali@firma.de --reset                      # new password
npm run user:create -- --email=ali@firma.de --deactivate                 # block login
```
Checks (same as CI): `npm run lint && npm run typecheck && npm test`.

## How permissions work
- `lib/permissions.ts` — one place with the route rules per role (pure functions, unit-tested). Deny by default.
- `middleware.ts` — first gate: login required + role check, wrong role → the role's home page.
- `lib/session.ts` — `requirePath()` / `requireRole()` in pages, `requireApiRole()` in API handlers.
  They re-read the user from the DB, so a deactivated login stops working immediately.
- The menu is built from the same rules (`navFor(role)`), but hiding items is never the only protection.

## UI
`styles/tokens.css` + `styles/app.css` are the approved CSS, unchanged. Class names are kept in JSX.
Fonts are self-hosted via `next/font` (no Google request from visitors). Brand theme: `styles/brand-parkflug.css`.
