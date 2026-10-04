# Architecture

**Stack:** Next.js 16 (App Router, React 19, server components + server actions), TypeScript (strict), Tailwind CSS v4, Radix primitives, Recharts, Drizzle ORM on PostgreSQL, Zod, Vitest.

## Request flow

- `src/proxy.ts` runs on every request: sets a per-request CSP nonce, redirects signed-out users to `/login?next=…`, and slides the session cookie.
- Pages are server components that build a `UserContext` (`src/server/context.ts`: user, profile, preferences, locale, timezone, "today", translator, formatter) and call read-side queries in `src/server/queries/*`.
- Mutations are server actions created with `createAction(schema, handler)` (`src/server/actions/_lib.ts`): authenticate, validate input with Zod, run the handler with the session user id, map database errors, revalidate. Clients call them through `useRun()` which shows toasts and never throws.
- Route handlers under `src/app/api` cover binary/streamed or token-authenticated cases (photos, export, backup/restore, ingest, cron, barcode, health).

## Data model highlights

- All tracked rows carry `user_id`; child tables are reached through their owned parent. Every table has RLS enabled.
- Dates for daily logs are local calendar `date`s computed in the user's timezone; timestamps are UTC.
- Canonical units are metric (kg, cm, ml, m); conversion happens only for display/input.
- Food entries store a nutrient **snapshot** so history never changes when a food is edited; nutrition targets keep history (`effective_from`).
- Personal records are rebuilt per exercise after any workout change, so edits/deletions stay consistent.
- Demo rows are tagged `is_demo` and can be removed without touching real data.
- Imported data keeps its `source`; imported steps win over manual for totals, manual sleep wins over imported, and imported weights never overwrite manual ones.

## Calculations (`src/lib/calc`, unit-tested)

Weight stats & trend (7-day calendar means, EWMA, regression), goal progress/ETA, BMR (Mifflin–St Jeor / Katch–McArdle) & formula TDEE, adaptive TDEE (28-day intake − trend slope × 7700 kcal/kg, with confidence and interval), forecast with widening uncertainty, e1RM (Epley), volume by muscle (secondary ½ set), PR detection, double-progression suggestions, adherence, daily/weekly score (weight excluded), factual streaks, insights.

## Workout logger

Local-first: state lives in React + `localStorage`, autosaves a full idempotent snapshot every ~1 s via `syncWorkout` (client-generated UUIDs), retries when back online, and resolves conflicts by comparing local unsynced revisions with the server `updated_at`. Finishing prunes unchecked sets and rebuilds PRs.

## Security

scrypt password hashes, hashed session tokens (DB) in httpOnly SameSite=Lax cookies, login rate limiting, sign-up closed after the owner account, same-origin checks on state-changing route handlers, ingest tokens stored as SHA-256 hashes, CSP with nonces, `noindex` everywhere, private photo responses, no secrets in client bundles.
