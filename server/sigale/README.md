# Sígale Backend (2.0)

Express + MySQL backend for Sígale 2.0. This is a **separate** app from the
read-only BlackCoffe reference in `current-server/`; in Phase 6 it folds into the
shared BlackCoffe server, keeping its own pool and its own migration set.

> **Hard guardrail.** Sígale connects **only** to the dedicated `sigale` database
> and touches **only** its own tables (`organizers`, `events`, `ticket_stages`,
> `purchases`, `tickets`). It never references BlackCoffe tables and never runs
> anything under `current-server/`. `db.js` and `runMigrations.js` both refuse to
> proceed unless `DB_NAME=sigale`. See `docs/SIGALE_2.0_IMPLEMENTATION_PLAN.md` §3.1.

## Status — Phase 5 (states, scheduled jobs, hardening)

Boots an Express app, applies the initial schema, serves the full route set
(events, purchases, admin, scan), runs the recurring jobs (auto-activate
stages + sweep abandoned holds), and enforces the §6 security floor.

## Layout

| Path | Role |
|------|------|
| `index.js` | Express entry: helmet + CORS + JSON + routes + error middleware; `runMigrations()` before `listen` |
| `config.js` | `PORT` (default 25060) |
| `db.js` | Single `mysql2/promise` pool — `sigale` DB, `dateStrings:true`, **CA-cert SSL** |
| `utils/emailNotifier.js` | Resend error mailer (`sendErrorEmail`) |
| `routes/health.routes.js` | `GET /api/health` connectivity probe |
| `migrations/001_init.sql` | ADR §5 DDL (clean names) + `events.isActive`, all `IF NOT EXISTS` |
| `migrations/runMigrations.js` | Applies every `*.sql` in order; `DB_NAME=sigale` guard |
| `seed/seedOrganizer.js` | One-off bcrypt seed of the initial organizer |
| `utils/time.js` | Single source for the UTC↔Bogotá conversion (constants + helpers) |
| `jobs/scheduler.js` | `node-cron` jobs: auto-activate stages + sweep abandoned holds |

## Scheduled jobs (Phase 5)

`startScheduler()` runs after `app.listen()` and registers two jobs that fire
every minute (and once at boot, to catch up after downtime):

- **activate stages** — `upcoming` stages whose `activatesAt <= UTC_TIMESTAMP()`
  flip to `active`. Stages without an `activatesAt` are never touched on a timer.
- **sweep abandoned holds** — `pending_payment` purchases past their 24h
  `reservationExpiresAt` are marked `expired` and their cupo returned to the
  stage, in one `FOR UPDATE` transaction. `payment_submitted` is **excluded**
  (a buyer who sent a receipt waits for manual review — decision #4).

Both jobs compare against `UTC_TIMESTAMP()` in SQL, so the cron cadence is only
"how often", never "at what wall-clock time".

## Local run (do this only against the `sigale` DB)

```
cd server
npm install
cp .env.example .env        # fill DB_*, DB_CA_CERT, RESEND_*, ORGANIZER_*
node index.js               # boots, migrates, listens on PORT
npm run seed:organizer      # one-off: seeds organizer David (set ORGANIZER_INITIAL_PASSWORD first)
```

Verify wiring: `curl http://localhost:25060/api/health` → `{ "ok": true, ... }`.

## Security notes (ADR §9, plan §6)

- Password stored as a **bcrypt hash**; seeded from `ORGANIZER_INITIAL_PASSWORD`
  (a freshly rotated value — never the leaked plaintext in the ADR).
- DB SSL **verifies** the DigitalOcean CA cert (`DB_CA_CERT`); `rejectUnauthorized`
  stays at its secure default.
- Rotate the `DB_PASSWORD` / `RESEND_API_KEY` that leaked in the shared
  `.env.local`; keep secrets only in `server/.env` (git-ignored).
- **Organizer-only routes** (`/api/admin/*` **and** the event writes
  `POST /api/events`, `PUT /api/events/:id`) re-validate credentials on every
  request via `requireOrganizer`. The shared `verifyOrganizer` runs one
  `bcrypt.compare` even for unknown usernames (constant-time — no enumeration).
- `/api/login` and `/api/recover` are **rate-limited**; `helmet` is enabled;
  request bodies are capped at **64 kb** (`express.json({ limit })`).
- `validationHash` is a **random** server secret minted at confirm (never derived).
