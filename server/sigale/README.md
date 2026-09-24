# Sígale backend

Express + `mysql2/promise` API. In production it runs **inside BlackCoffe's
Express server** (`coffeserver.onrender.com`) with its own pool, migrations,
scheduler and database schema. Schema and invariants:
[`docs/architecture/DB_SCHEMA.md`](../docs/architecture/DB_SCHEMA.md); routes:
[`docs/architecture/PROJECT_OVERVIEW.md`](../docs/architecture/PROJECT_OVERVIEW.md#api).

## Guardrail: isolation from BlackCoffe

Sígale connects only to the `sigale` schema and touches only its own tables.
`db.js` and `runMigrations.js` both refuse to start unless `SIGALE_DB_NAME`
(or `DB_NAME`) is `sigale`. Never create, alter, drop or write BlackCoffe's
tables (`orders`, `deposits`, `clients`, `products`, `users`). The repo's
`.env.local` points at BlackCoffe's `defaultdb`, so pass `database: 'sigale'`
explicitly in any ad-hoc script. Production writes are irreversible: inspect
read-only first and confirm the exact change.

## Layout

| Path | Role |
|---|---|
| `integration.js` | `mountSigale(app)` + `startSigale()` — the seam BlackCoffe uses in production |
| `index.js` | standalone entry for local runs (helmet, CORS, routes, migrations → listen → scheduler). **Keep its router list in sync with `integration.js`** |
| `db.js` | the pool: `sigale` only, `dateStrings: true`, CA-verified TLS when `DB_CA_CERT` is set, plain TCP locally |
| `controllers/`, `routes/` | `events`, `purchases`, `admin`, `guestPasses`, `scan`, `organizers`, `health` |
| `middleware/requireOrganizer.js` | Basic-auth bcrypt check per request (+ `requireSuperAdmin`) |
| `utils/authz.js` | `assertNotDemo` (409), `assertOwnsEvent` (403) |
| `utils/time.js` | UTC ↔ Bogotá helpers; persist UTC, read with `CONVERT_TZ` |
| `utils/emailNotifier.js` | `sendErrorEmail` via Resend |
| `jobs/scheduler.js` | stage activation, 24 h hold sweep, nightly demo rearm |
| `migrations/` | ledger-backed runner + `*.sql` (see the data-model doc) |
| `seed/` | `seedOrganizer.js` (first account, `super_admin`), `seedSampleEvent.js` (local `prueba-local` event) |

## Environment

| Variable | Notes |
|---|---|
| `SIGALE_DB_NAME=sigale` | on the shared server (BlackCoffe owns `DB_NAME`); standalone runs use `DB_NAME=sigale` |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` | shared with BlackCoffe in production |
| `DB_CA_CERT` | path to the DigitalOcean CA cert; unset locally |
| `SCAN_HASH_SECRET` | **required in production**; keys every QR hash, rotating it invalidates all issued tickets |
| `RESEND_API_KEY`, `NOTIFICATION_EMAIL`, `FROM_EMAIL` | error mail |
| `ORGANIZER_USERNAME`, `ORGANIZER_INITIAL_PASSWORD` | only for `seedOrganizer.js` |
| `PORT` | standalone only (default 25060) |

Template: `server/.env.example`. Secrets live only in git-ignored `.env` files.

## Deploy

1. `./sync-sigale-server.ps1` mirrors `server/` into
   `C:\dev\BlackCoffe\server\sigale\` (robocopy `/MIR`, excluding
   `node_modules`, `.git`, `.env*`, `*.log`).
2. Commit and push **in the BlackCoffe repo**; Render redeploys it.
3. BlackCoffe's `index.js` calls `mountSigale(app)` before its static/SPA
   fallback and `startSigale()` after `listen`. `startSigale` runs pending
   migrations, then starts the scheduler, and swallows its own errors so a
   Sígale failure never takes BlackCoffe down. BlackCoffe's app owns
   `helmet`, CORS (including `https://sigale.onrender.com`) and
   `express.json` — `mountSigale` must not add them again.
4. New Sígale dependencies go into BlackCoffe's `package.json` too.

Check after deploying: `GET /api/health` → `{ ok: true }` and
`GET /api/scan/events` → 200.

The frontend deploys separately: push to `main` and Render rebuilds the static
site with `VITE_API_URL` from `.env.production`.

## Local stack

Production is live and `npm run dev` already proxies `/api` to it, so a local
backend is rarely needed — and a fresh, empty database does not bootstrap (see
the data-model doc). When you do need one, on Windows:

```powershell
.\dev-local.ps1 -InitDb   # first run: create the local 'sigale' DB + user
.\dev-local.ps1           # frees ports, starts the API (migrations on boot), seeds, starts Vite
```

Or by hand: `cd server`, `npm install`, copy `.env.example` to `.env`, then
`npm run dev` and `npm run seed:all`. Node ≥ 20.6 is required for
`--env-file`.

## Security

- bcrypt hashes (cost 12); unknown usernames still run one compare against a
  dummy hash, and inactive accounts fail exactly like wrong passwords.
- `/api/login` is limited to 10/min; the public scan routes to 120/min/IP.
- Parameterized queries everywhere; explicit column lists on public inserts;
  64 kb JSON bodies.
- `validationHash` is minted only at confirm and never before; the scanner
  depends on that.
