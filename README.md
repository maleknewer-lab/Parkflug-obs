# parkflug-ops

Booking and operations system for our own airport parking at DUS (ParkFlug, DUS Valet, more brands later).
Read **CLAUDE.md** first — it is the single source of truth.

Stack: Next.js 15 (App Router) · TypeScript · Tailwind 4 · Prisma · PostgreSQL (Neon) · pnpm.

## Running in GitHub Codespaces

Nothing needs to be installed locally.

1. On GitHub open the repo → **Code** → **Codespaces** → **Create codespace on main**.
   The dev container installs Node 20 and pnpm and runs `pnpm install` automatically.
2. Create a free Neon project at neon.tech (region: Frankfurt) and copy two connection strings:
   - **Pooled** (host contains `-pooler`) → `DATABASE_URL`
   - **Direct** (no `-pooler`) → `DIRECT_URL`
3. In the Codespace terminal:
   ```bash
   cp .env.example .env
   ```
   Paste both values into `.env`. Never commit `.env`.
4. Create the tables and start the app:
   ```bash
   pnpm db:migrate --name init
   pnpm dev
   ```
5. Codespaces forwards port 3000 and opens a browser tab. Check `/` and `/api/health`.

Before every PR run: `pnpm lint && pnpm typecheck && pnpm test` (CI runs the same).

## Deploying to Vercel (staging)

1. vercel.com → **Add New Project** → import the GitHub repo (framework: Next.js is detected).
2. Add `DATABASE_URL` and `DIRECT_URL` under **Settings → Environment Variables**.
3. Every PR gets a preview URL; `main` deploys to the staging domain.
4. Apply migrations to Neon from the Codespace with `pnpm db:deploy`
   (automating this in the Vercel build is a later decision).

## Structure

```
app/(public)/book/[brand]     customer booking form
app/(public)/manage/[code]    customer cancel / view
app/admin                     admin
app/driver                    driver PWA
app/api                       route handlers
lib/{pricing,booking,invoices,notifications,flights}   pure business logic + unit tests
prisma/                       schema + migrations
docs/                         spec.pdf, prototype.html
tests/
```

Business rules never live in UI components — only in `/lib`, with tests.
