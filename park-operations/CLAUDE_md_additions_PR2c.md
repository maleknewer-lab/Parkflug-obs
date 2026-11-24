# CLAUDE.md additions (same PR as the folder fix)

## Section 4 → Proposed code structure (correct the public paths)
The public customer pages live in plain folders WITHOUT parentheses: `app/book/[brand]/...` (price page, `checkout`, `pay/[code]`, `booked/[code]`), shared `app/book/layout.tsx`, `app/book/public.css`, `app/book/_components/`. The later customer page is `app/manage/[code]`. (Replaces `/(public)/book/[brand]` and `/(public)/manage/[code]`.)

## Section 6 → How we work (add)
- Files are uploaded to GitHub from a tablet, and the upload lost the parentheses of a route group (`(public)` became `public`, which silently turned the pages into `/public/book/...` and gave 404 on `/book/...`). Rule: no NEW folders with parentheses; folder names must be checked in GitHub after every upload. Existing groups `(admin)` / `(staff)` stay as they are.

## Section 9 → Decision log (add)
| 2026-11-24 | Public pages moved from `app/(public)/` to `app/book/` (no parentheses) because the tablet upload stripped the parentheses and the booking pages returned 404. Footer imports use the alias `@/app/book/_components/legal-footer`. |
