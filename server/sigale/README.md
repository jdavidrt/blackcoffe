# Sígale Backend

Express + MySQL backend for Sígale. **In production**, deployed as part of the
shared BlackCoffe server (`coffeserver.onrender.com`) while keeping its own
connection pool, its own migration set, and its own database.

> **Hard guardrail.** Sígale connects **only** to the dedicated `sigale` database
> and touches **only** its own tables (`organizers`, `events`, `ticket_stages`,
> `tickets`, `guest_passes`). It never references BlackCoffe tables (`orders`,
> `deposits`, `clients`, `products`, `users`) and never runs anything under
> `reference/`. Both `db.js` and `runMigrations.js` refuse to proceed unless
> `DB_NAME` (or `SIGALE_DB_NAME`) resolves to `sigale`. See
> `docs/SIGALE_2.0_IMPLEMENTATION_PLAN.md` §3.1.

> **This folder contains only Sígale's backend.** BlackCoffe's read-only server
> mirror used to sit here as `server/current-server/`; on 2026-08-04 it was moved
> out to `/reference/blackcoffe-server-snapshot/` (git-ignored) so it can't be
> mistaken for part of this app. Its nested `sigale/` subfolder — a stale copy of
> this very backend, missing `guestPasses.controllers.js` and migrations 005–007 —
> was deleted at the same time. See `reference/README.md`.

## Layout

| Path | Role |
|------|------|
| `index.js` | Express entry: helmet + CORS + JSON + routes + error middleware; `runMigrations()` before `listen` |
| `integration.js` | `mountSigale` / `startSigale` — the seam BlackCoffe's server uses to mount Sígale into its own app. Deliberately not imported by `index.js`; **when you add a router to `index.js`, add it here too** or the deployed app won't serve it |
| `config.js` | `PORT` (default 25060) |
| `db.js` | Single `mysql2/promise` pool — `sigale` DB, `dateStrings:true`, **CA-cert SSL** |
| `controllers/` | `events`, `purchases`, `admin`, `guestPasses`, `scan` |
| `routes/` | `health`, `events`, `purchases`, `admin`, `guestPasses`, `scan` |
| `middleware/requireOrganizer.js` | Re-validates Basic credentials on every `/api/admin/*` request **and** on the event writes |
| `jobs/scheduler.js` | `node-cron`: auto-activate due stages + sweep abandoned holds |
| `migrations/runMigrations.js` | Ledger-backed runner (`schema_migrations`) + post-cutover self-heal |
| `seed/seedOrganizer.js` | One-off bcrypt seed of the initial organizer |
| `seed/seedSampleEvent.js` | Seeds a sample event for local work |
| `utils/time.js` | Single source for UTC ↔ Bogotá conversion |
| `utils/emailNotifier.js` | Resend error mailer (`sendErrorEmail`) |

## Migrations

Applied in filename order, **once each**, tracked in a `schema_migrations`
ledger. The DDL is still idempotent, but a recorded file is skipped rather than
re-run.

| File | What it does | Status |
|------|--------------|--------|
| `001_init.sql` | Original DDL: `organizers`, `events`, `ticket_stages`, `purchases`, `tickets` (the old two-table split) | **Pre-cutover history** |
| `002_event_address.sql` | Adds `events.address` (guarded via `information_schema`) | Pre-cutover history |
| `003_sequential_orderid.sql` | `orderId` `CHAR(3)` → `INT UNSIGNED`, globally unique, starts at 100 | Pre-cutover history |
| `004_holders_snapshot.sql` | Adds `purchases.holdersSnapshot JSON` | **Retired by 005** — the `purchases` table no longer exists |
| `005_tickets_merge_schema.sql` | Creates `tickets_v2`, the merged order+seat schema | **Superseded by the cutover** — that table is now simply `tickets` |
| `006_guest_passes.sql` | Creates `guest_passes` (artist/crew/courtesy roster) | **Live** |
| `007_single_active_stage.sql` | Adds the `closed` stage status + `uqOneActiveStagePerEvent` unique index (via the `activeFlag` generated column) | **Live** |
| `008_multi_event.sql` | Adds `events.slug` (+ `uqEventSlug`), `isPublished`, `isDemo`, `salesOpen`; creates `order_counter` (persisted orderId high-water mark) seeded from `MAX(tickets.orderId)` | **Live** |

**Do not delete or renumber `001`–`005`.** They are kept in place so the ledger
and the runner's self-heal logic stay coherent; the runner marks them applied
rather than executing them once it detects a cut-over database.

### The purchases → tickets cutover

`purchases` and `tickets` were merged into a single `tickets` table (one row per
seat, spanning the whole order lifecycle). This **has already happened in
production**: `tickets_v2` was renamed to `tickets`, and the originals survive as
`purchases_legacy_v1` / `tickets_legacy_v1`.

`runMigrations.js` detects `tickets_legacy_v1` and force-marks `001`–`005` as
applied, because their DDL declares FK constraint names that the `RENAME TABLE`
carried onto the renamed tables — re-running them throws `ER_FK_DUP_NAME` (1826),
which aborts the boot loop and silently blocks every later migration.

The one-off script that performed the cutover lives at
`legacy/server/merge_purchases_into_tickets.js`. **It is destructive and must
never be run again.**

⚠️ **Known gap: a fresh, empty `sigale` database does not bootstrap correctly.**
`001_init.sql` creates the *pre-merge* `tickets` table and nothing performs the
rename, so the controllers would query the wrong shape. Standing up a brand-new
environment requires writing a `009_*` migration that creates the merged table
under its final name (renumbered from the originally-earmarked `008` once that
slot was claimed by `008_multi_event.sql`). Production is unaffected.

Full column reference: `docs/architecture/TICKETS_SCHEMA.md`.

## Scheduled jobs

`startScheduler()` runs after `app.listen()` and registers two jobs that fire
every minute (and once at boot, to catch up after downtime):

- **activate stages** — `upcoming` stages whose `activatesAt <= UTC_TIMESTAMP()`
  flip to `active`. Stages without an `activatesAt` are never touched on a timer.
  Promotion first demotes the stage it supersedes to `closed`, because
  `uqOneActiveStagePerEvent` allows only one `active` stage per event.
- **sweep abandoned holds** — `pending_payment` rows past their 24h
  `reservationExpiresAt` are marked `expired` and their cupo returned to the
  stage, in one `FOR UPDATE` transaction. `payment_submitted` is **excluded** (a
  buyer who sent a receipt waits for manual review).

Both jobs compare against `UTC_TIMESTAMP()` in SQL, so the cron cadence is only
"how often", never "at what wall-clock time".

## Local run (only against the `sigale` DB)

Production is already live — don't stand up a local stack just to check
something that is already deployed. When you do need one:

```
cd server
npm install
cp .env.example .env        # fill DB_*, DB_CA_CERT, SCAN_HASH_SECRET, RESEND_*, ORGANIZER_*
node index.js               # boots, migrates, listens on PORT
npm run seed:organizer      # one-off; set ORGANIZER_INITIAL_PASSWORD first
```

Verify wiring: `curl http://localhost:25060/api/health` → `{ "ok": true, ... }`.
See `docs/LOCAL_TESTING.md` and the repo-root `dev-local.ps1` launcher.

## Deploying

`server/` is mirrored into the BlackCoffe repo's `server/sigale/` folder by
`/sync-sigale-server.ps1`, then committed **in the BlackCoffe repo**. The sync
excludes `current-server/`, `node_modules/`, `.git`, `.env*`, and `*.log`. See
`docs/SIGALE_MERGE_INTO_SHARED_SERVER.md`.

## Security notes

- Organizer password stored as a **bcrypt hash**, seeded from
  `ORGANIZER_INITIAL_PASSWORD`.
- DB SSL **verifies** the DigitalOcean CA cert (`DB_CA_CERT`);
  `rejectUnauthorized` stays at its secure default.
- **Organizer-only routes** (`/api/admin/*` **and** the event writes
  `POST /api/events`, `PUT /api/events/:id`) re-validate credentials on every
  request via `requireOrganizer`. The shared `verifyOrganizer` runs one
  `bcrypt.compare` even for unknown usernames (constant-time — no enumeration).
- `/api/login` is **rate-limited** (10/min); `helmet` is enabled; request bodies
  are capped at **64 kb**.
- `validationHash` is a **deterministic HMAC** minted only at confirm —
  `HMAC_SHA256(SCAN_HASH_SECRET, "${orderId}:${seatIndex}").slice(0,16)`. Unique
  per seat and stable across holder edits, but unguessable without the secret.
  **Set `SCAN_HASH_SECRET` in the deployed environment** — it falls back to an
  insecure dev default otherwise, and rotating it invalidates every issued QR.
- Keep secrets in `server/.env` (git-ignored) only.
