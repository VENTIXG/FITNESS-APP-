# FORGE — private fitness tracker

A single-user (or small private) web app / PWA that combines a strength-training log (Hevy/Strong style), a calorie & macro tracker (MacroFactor/MyFitnessPal style) and a daily activity dashboard. Everything lives in **your own PostgreSQL database**; pages are never indexed and nothing is public.

The product name is configurable with `NEXT_PUBLIC_APP_NAME`.

## Features

- **Dashboard** — customizable cards, daily score (weight excluded), insights.
- **Weight & body** — daily weigh-ins, 7/14/30-day averages, trend, weekly/monthly change, body fat, lean/fat mass, 10 measurements, private progress photos with side-by-side compare.
- **Goals** — target weight/date, required weekly rate, daily energy balance, progress, data-driven ETA, ahead/on track/behind, neutral warnings for aggressive rates.
- **Nutrition** — diary with custom meal slots, built-in food database (EN/EL, 125 foods), custom foods, favorites, recents, saved meals, recipes, one-tap add, quick add, copy meal/day, barcode scanning (+ Open Food Facts), history & adherence.
- **Training** — programs (PPL / Upper-Lower / Full-body templates or custom, drag/up-down reorder), 108 built-in exercises (EN/EL) + custom, local-first workout logger (works offline), previous performance, progressive-overload suggestions (shown, never auto-applied), rest timer (sound/vibration/notification), live PR detection, e1RM (Epley), volume by muscle, exercise history & rep maxes, records.
- **Cardio & steps** — sessions with distance/pace/HR/incline/speed; manual vs imported steps kept separate.
- **Habits** — manual + automatic habits, factual streaks, water, sleep, supplements (tracking only).
- **Calendar & daily detail**, **analytics** (weight, body, nutrition, training, cardio, lifestyle), **weekly reports** (printable), **coach** (rule-based; optional AI narrative).
- **Adaptive expenditure (TDEE)** from intake vs weight trend with confidence + formula estimate; weight **forecast** with uncertainty band.
- **Data** — CSV/XLSX/JSON export, full JSON backup (optional photos), restore with preview (merge or confirm-to-replace), demo data, delete-all.
- **PWA** — installable, offline fallback, web-push reminders. English & Greek. Dark/light/system themes.

## Project structure

```
src/
  app/                 Next.js App Router
    (auth)/            login, signup
    (app)/             signed-in pages (dashboard, nutrition, training, cardio, progress,
                       goals, calendar, day/[date], analytics, reports, habits, coach, settings, more)
    api/               photos, export, backup, restore, ingest, food/barcode, cron/reminders, health, search
    manifest.ts, robots.ts
  components/          UI by feature (ui/, charts/, nutrition/, training/, settings/ …)
  lib/                 pure code shared by server & client
    calc/              all calculations (+ unit tests)
    i18n/              EN/EL dictionaries
  server/
    actions/           server actions (validated with Zod; user id always from the session)
    queries/           read-side data access
    services/          demo data, backup/restore, export, PR rebuild
    auth/              sessions, password hashing, rate limiting
    db/                Drizzle schema + client
  data/                built-in exercise & food catalogs
  proxy.ts             auth gate, CSP nonce, session refresh
drizzle/               SQL migrations
scripts/               migrate, seed (demo account), reset-password
public/                icons, service worker, offline page
docs/                  ARCHITECTURE.md, INTEGRATIONS.md, DESIGN.md
```

## Requirements

- Node.js 20.9+ (22 recommended), pnpm 10
- PostgreSQL 14+ (local, Supabase, Neon, Railway, …)

## Setup & run locally

```bash
pnpm install
cp .env.example .env          # set DATABASE_URL at minimum
pnpm db:migrate               # applies migrations + syncs built-in foods/exercises
pnpm dev                      # http://localhost:3000
```

Open the app and create the owner account (the first sign-up is always allowed; afterwards sign-up is closed unless `ALLOW_SIGNUP=true`). Onboarding offers optional demo data.

Optional demo account: `pnpm db:seed` creates `demo@forge.local` / `forge-demo-2026` with ~4 months of data (`pnpm db:seed --remove` deletes it; `pnpm db:seed --email you@x.com` adds demo rows to your account).

Forgot the password? `pnpm db:reset-password you@example.com` (reads the new password from stdin and signs out all sessions).

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `DATABASE_SSL` | hosted DBs | `require` for TLS (Supabase/Neon) |
| `DATABASE_PREPARE` | poolers | `false` behind transaction poolers (Supabase :6543, PgBouncer) |
| `DATABASE_POOL_MAX` | no | pool size (default 10) |
| `APP_URL` | prod | public URL; enables Secure cookies when `https://` |
| `NEXT_PUBLIC_APP_NAME` | no | product name (default FORGE) |
| `ALLOW_SIGNUP` | no | keep `false` for a private instance |
| `SESSION_MAX_AGE_DAYS` | no | sliding session lifetime (default 30) |
| `OPENFOODFACTS_ENABLED` | no | `false` disables all outbound food lookups |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | push only | web push (`pnpm vapid:generate`) |
| `CRON_SECRET` | push only | bearer secret for `/api/cron/reminders` |
| `ANTHROPIC_API_KEY`, `AI_COACH_MODEL` | no | optional AI weekly summary (default model `claude-opus-5-5`) |

Secrets are only read on the server; only `NEXT_PUBLIC_*` reaches the browser.

## Database migrations

Schema lives in `src/server/db/schema.ts` (Drizzle). After changing it:

```bash
pnpm db:generate   # writes a new SQL migration to drizzle/
pnpm db:migrate    # applies pending migrations and re-syncs the built-in catalog
```

Run `pnpm db:migrate` on every deploy (it is idempotent). All tables have Row-Level Security enabled with no policies, so if you use Supabase the public `anon`/`authenticated` roles cannot read them — the app connects with the database owner role from the server only.

## Build & checks

```bash
pnpm check      # typecheck + lint + unit tests
pnpm build      # production build
pnpm start      # serve the build
```

## Deploying privately

Any Node host works (Vercel, Railway, Fly.io, Render, a VPS with Docker/PM2).

1. Create a PostgreSQL database and set `DATABASE_URL` (+ `DATABASE_SSL=require` for hosted DBs).
2. Set `APP_URL=https://your-domain` and keep `ALLOW_SIGNUP=false`.
3. Build with `pnpm build`; run `pnpm db:migrate` as a release step; start with `pnpm start`.
4. Sign up once to create the owner account.
5. Optional: add VAPID keys + `CRON_SECRET` and schedule `GET /api/cron/reminders` every 15–60 minutes with `Authorization: Bearer $CRON_SECRET` (e.g. Vercel Cron, GitHub Actions, or system cron + curl).

Privacy defaults: every page sends `X-Robots-Tag: noindex`, `robots.txt` disallows everything, all routes except login/signup/health/ingest/cron require a session, photos are served only to their owner with `Cache-Control: private`, and a strict nonce-based CSP is applied. For extra protection you can also put the site behind your host's password protection or an identity-aware proxy.

## Features that use external services

| Feature | Service | Without it |
|---|---|---|
| Barcode / product lookup | Open Food Facts (free, no key; only the barcode is sent, from the server) | local foods + manual entry |
| Push reminders | Browser push services via VAPID | no push; everything else works |
| AI weekly summary | Anthropic API (`ANTHROPIC_API_KEY`) | rule-based coach insights only |
| Apple Health / Health Connect | your phone automation → `/api/ingest` | manual entry |

## Known limitations

- Web apps cannot read HealthKit or Health Connect directly; imports require a phone automation posting to the ingest API (see `docs/INTEGRATIONS.md`).
- Camera barcode scanning uses the browser `BarcodeDetector` (Chrome/Android, recent Safari); elsewhere enter the code manually.
- iOS push requires adding the app to the Home Screen (iOS 16.4+).
- Rest-timer alerts while the screen is locked depend on the OS; the timer itself is timestamp-based and stays correct.
- The rule-based coach and TDEE/forecast are statistical estimates, not medical advice; the adaptive TDEE needs ~2 weeks of consistent food and weight logging.
- Reminder throttling for the AI summary is per server instance.
