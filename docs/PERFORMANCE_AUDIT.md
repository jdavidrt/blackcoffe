# BlackCoffe — Performance Audit (2026-09-24)

**Why this exists:** the client reported that the system "gets slow or stuck loading" several times a day, on both phones and PCs, on every kind of page. This audit reviews BlackCoffe's server and client code and measures the production database and API.

**How it was measured (2026-09-24, 14:40–17:30 Colombia time):**
- Read-only queries against the production MySQL cluster. MySQL's own statistics (`performance_schema`) cover every query since the cluster's last restart on **2026-08-14 ≈ 00:16 Colombia time**, i.e. 41.7 days of real traffic, peaks included.
- `curl` timings against the live API and static site, taken from Bogotá.
- Nothing was written to the database, and no code was changed during the audit.

**Where things are tracked:**
- Status tracking for these items lives in [PENDING_IMPROVEMENTS.md](PENDING_IMPROVEMENTS.md) (items 5.3 and 6.7).
- Hosting details live in [REFERENCE.md → Hosting & Infrastructure](REFERENCE.md#hosting--infrastructure-production).
- **`server/sigale/` was read but not modified** (guardrail in `CLAUDE.md`). Items that touch the shared process are flagged **⚠️ Sígale**.

---

## 1. Summary

1. **"Slow" is fully explained by the measurements.** Every API call pays for three things:
   - The trip from Bogotá to the API server in **Oregon**: ~180 ms before any work starts, or ~270 ms when the browser has to open a new connection.
   - About **85 ms per database round trip**, because the database is in **New York (NYC3)**.
   - A **full-table scan**, because `orders`, `deposits` and `clients` have **no indexes besides the primary key**. Almost every page scans all 25,611 orders (57.5 MB). That takes 50–200 ms on average and up to 1–2 s at peak hours (9–10 h and 15–18 h).
2. **"Stuck" is *not* explained by query times.** The slowest query in 41.7 days took 2.1 s. The most likely cause is **the server process crashing and restarting** (§4 F3), which several code paths allow. Everyone on BlackCoffe (and Sígale) then waits for Render to restart the service. This needs confirming in the Render dashboard (§6).
3. **It is a backend problem, not a device problem.** It happens on PCs too and on all pages. The frontend issues (full page reloads, a 2.3 MB bundle) make things worse, but they are secondary.
4. **Fix order:**
   - Apply the quick wins (§3). **QW1–QW4 were implemented and verified locally on 2026-09-24, and are pending deploy.**
   - Measure.
   - Move the API server next to the database (§8). **Do not move the database to San Francisco** (see §8 for why).

---

## 2. Production setup at the time of the audit

| Piece | Service | Where |
|---|---|---|
| API (BlackCoffe + Sígale, one Node process) | Render Web Service `coffeserver`, **Starter** plan (512 MB RAM / 0.5 CPU, never sleeps) | **Oregon** (US West) |
| Frontend | Render **Global Static Site** `blackcofeepedidos` (CDN edge in Bogotá) | global |
| Database | DigitalOcean Managed MySQL `pedidos`, MySQL 8.0.45, **Basic 2 GB / 1 vCPU**, 30 GiB additional storage, **primary only** (no standby) | **NYC3** (New York) |

The full reference, including environment variables, is in [REFERENCE.md](REFERENCE.md#hosting--infrastructure-production).

---

## 3. Quick wins

These are small, low-risk changes, ordered by impact.

**Status (2026-09-24):**
- **QW1–QW4 are implemented and verified locally** against a MySQL 8.0 copy of the production schema, filled with synthetic data at production scale. See "Evaluation" at the end of this section.
- They take effect on the next deploy, which also runs the index migration.
- **QW5 is a DigitalOcean setting** for the owner to change.

| # | Change | Fixes | Status |
|---|---|---|---|
| QW1 | Add 3 database indexes | F1, F2 | ✅ Implemented: `server/migrations/add_performance_indexes.js` |
| QW2 | Stop database errors from crashing or hanging the server | F3 | ✅ Implemented |
| QW3 | Log the response time of every request | lets you diagnose the next "stuck" episode | ✅ Implemented |
| QW4 | Time out read requests in the frontend (GET only) and say so | endless spinners, or "No hay …" shown when a load failed | ✅ Implemented |
| QW5 | Set the database maintenance window to off-hours | downtime during business hours | ⏳ Owner (DigitalOcean setting) |

### QW1 — Add the missing indexes

**Why:** see F1 and F2. The six busiest queries each read about 25,000 rows to return between 1 and 330. Order creation also locks the whole `orders` table while it runs.

**What:**

```sql
ALTER TABLE orders   ADD INDEX idx_orders_paid (paid),                  ALGORITHM=INPLACE, LOCK=NONE;
ALTER TABLE orders   ADD INDEX idx_orders_client_paid (clientId, paid), ALGORITHM=INPLACE, LOCK=NONE;
ALTER TABLE deposits ADD INDEX idx_deposits_order (orderId),            ALGORITHM=INPLACE, LOCK=NONE;
```

**Queries this speeds up:**
- `idx_orders_paid`: `/orders/`, `/notDeliveredOrders/`, `/unPaidOrders/:mall`. Only 387 of the 25,611 orders are unpaid.
- `idx_orders_client_paid`: `/unPaidOrdersByClient/:clientId`, the `createOrder` lock (F2), and the active-order check in `deleteClient`.
- `idx_deposits_order`: `/deposits/:id`, the recalculation in `deleteDeposit`, and the "has deposits" check in `deleteOrder`.

**How it's applied:** a boot migration, [server/migrations/add_performance_indexes.js](../server/migrations/add_performance_indexes.js), chained after `runBackupMigrations` in `server/index.js`. Only BlackCoffe's chain is touched. The safeguards:
- **Additive only.** `ADD INDEX` never changes or removes rows.
- **Idempotent.** Each index is created only if its name is missing from `information_schema.STATISTICS`. Later boots issue no `ALTER` at all.
- **Online.** `ALGORITHM=INPLACE, LOCK=NONE` keeps reads and writes working. If MySQL can't build online, it refuses (and the refusal is logged) rather than locking the table.
- **Bounded wait.** `SET SESSION lock_wait_timeout = 10`: if a long transaction holds the table, the migration gives up after 10 s, logs it, and retries on the next boot, instead of queueing the app's queries behind it.
- **Never blocks startup on failure.** Errors are logged, and the server starts anyway.

A manual alternative is to run the SQL above from the DigitalOcean console; the app's `/consultas` page blocks `ALTER`.

**Side effect handled:** with `idx_deposits_order` in place, MySQL switched "Cobros del día" to a plan that measured about **2× slower**, because its date filter can't use an index yet (F6). That query now carries `IGNORE INDEX (idx_deposits_order)` to keep its old plan. **Remove the hint when N2 rewrites the query.**

**Deliberately not included yet:**
- Indexes on the date columns (`orders.paidAt`, `deposits.depositCreatedAt`). They are useless until the date filters are rewritten (N2).
- Indexes on `clients`. The table has 659 rows and its queries already take about 2 ms.

**Expected effect (estimate, not measured):** these queries should drop from 50–200 ms to a few milliseconds, and order creation should stop blocking other writes.

**How to verify:**
- `EXPLAIN` on each query must show `type = ref` and `key = idx_…` instead of `type = ALL`.
- Compare `curl` timings before and after the change (Appendix B).

**Rollback:** `ALTER TABLE … DROP INDEX …`.

### QW2 — Stop database errors from crashing or hanging the server

**Why:** see F3. On Express 4, a rejected promise in a route handler is never caught. On current Node versions (the Render service doesn't pin one), an uncaught rejection **terminates the process**.

**What:**
1. Move `const conn = await pool.getConnection()` inside the `try` block and guard the cleanup with `conn?.rollback()` and `conn?.release()`. The four places are:
   - [orders.controllers.js:286](../server/controllers/orders.controllers.js#L286)
   - [deposits.controllers.js:66](../server/controllers/deposits.controllers.js#L66)
   - [deposits.controllers.js:183](../server/controllers/deposits.controllers.js#L183)
   - [backups.controllers.js:99](../server/controllers/backups.controllers.js#L99)
2. Wrap `/ping` in [index.routes.js:5](../server/routes/index.routes.js#L5) in `try/catch`.
3. Add a backstop in `server/index.js`: `process.on('unhandledRejection', …)` that logs the error and calls `sendErrorEmail` instead of letting the process die.
   - **⚠️ Sígale:** this handler applies to the whole process, so Sígale is covered too. No Sígale file changes, but tell its owners.

**Effect:** a database hiccup fails one request with a 500 and an alert email, instead of restarting the service for every user of both apps.

**Note on alerts:** errors on these paths currently send **no** alert email, because the process dies before any `catch` runs. A quiet error inbox therefore does not prove there were no crashes.

### QW3 — Log the response time of every request

**Why:** Render's logs currently show no request timings, so a "stuck" report can't be matched to anything. `morgan` is already a dependency (1.10.0, installed) but is never used.

**What:** in `server/index.js`, before the routes:

```js
app.use(morgan('tiny', { skip: (req) => req.path.startsWith('/users/') || req.path.startsWith('/api/') }));
```

Both exclusions are **mandatory**:
- `/users/`: the login route carries the password in the URL (PENDING_IMPROVEMENTS 2.1). Without the exclusion, passwords would be written to Render's logs.
- `/api/`: those are Sígale's routes. Whether their URLs carry anything sensitive is for Sígale's owners to decide, not this change.

**Effect:** every BlackCoffe request is logged as `GET /orders/ 200 2489123 - 812.345 ms`, with Render's own timestamp, so slow periods and restarts become visible by time of day.

### QW4 — Time out read requests in the frontend

**Why:** axios has **no timeout** anywhere in `client/src/api/`. A request that never gets a response leaves the "Cargando..." spinner forever, which is exactly the "stuck" symptom.

**What:** two axios interceptors in [client/src/main.jsx](../client/src/main.jsx).
1. **A 20 s timeout on GET requests only.** Write requests (POST/PUT/DELETE) are deliberately excluded: if a payment actually succeeded on the server after the browser gave up, the user would retry and create a duplicate deposit (PENDING_IMPROVEMENTS 4.5).
2. **A "No se pudieron cargar los datos" dialog** with a **Reintentar** button (which reloads the page), shown once when a GET gets no answer (timeout, or server unreachable) or a 5xx.
   - This is required, not optional. Pages stop their spinner in a `finally` block with no `catch`, so without the dialog a failed load would render **"No hay pedidos…"**, and a delivery driver would read that as "nothing to deliver".
   - Axios 0.27 attaches the raw XHR as `error.response` (with status 0) on network errors, so the check uses the *status* rather than the presence of `error.response`.

**Effect:** nothing gets faster, but an endless spinner or a false "no hay" becomes a clear message the user can retry.

### QW5 — Pin the database maintenance window to off-hours

**Why:** the cluster is **primary-only**, so any DigitalOcean maintenance or restart is an outage. Combined with F3, a short database outage also crashes the server.

**What:**
- In DigitalOcean → Databases → `pedidos` → Settings → **Maintenance window**, choose **Sunday early morning**. The app is not used on Sundays, and the nightly backup job runs Monday to Saturday.
- The last restart happened around 00:16 Colombia time on 2026-08-14, which suggests the window is already at night. Confirm it rather than assume.

### Evaluation of QW1–QW4 (2026-09-24, before deploy)

**Setup:**
- A local MySQL **8.0.46** container with production's exact table definitions and production's settings: ANSI `sql_mode`, 256 MB buffer pool, 120 s lock wait.
- Synthetic data generated to production's shape: 25,615 orders (388 unpaid, 49 undelivered, average 1.75 KB of items), 34,174 deposits, 689 clients. **No production rows were copied, and nothing was written to production.**
- Measurements use the app's real controller functions (40 runs each, median) and MySQL's own rows-read statistics.
- The server itself was booted against this database for the outage and logging tests. The frontend was tested in headless Chromium, with every API call intercepted.

**QW1: rows read per request, and local time per request.**

| Page / endpoint | Rows read before → after | Local time before → after | Production estimate* |
|---|---|---|---|
| Cuentas por cobrar `/orders/` | 26,345 → 1,118 | 39.8 → 10.5 ms | 136 → ~36 ms |
| Recorrido `/notDeliveredOrders/` | 25,713 → 486 | 40.5 → 11.8 ms | 142 → ~41 ms |
| Cobrar por mall `/unPaidOrders/:mall` | 26,246 → 1,019 | 37.9 → 8.4 ms | 85 → ~19 ms |
| Nueva Orden client lookup `/unPaidOrdersByClient/:id` | 25,616 → **2** | 29.6 → 1.6 ms | 62 → ~3 ms |
| Cobrar Orden deposits `/deposits/:id` | 34,174 → **2** | 27.3 → 1.8 ms | 49 → ~3 ms |
| Nueva Orden save `POST /order` (lock query) | 25,615 → **1** | 63.4 → 34.4 ms (whole request) | lock query 82 → ~2 ms |
| Delivery tick `PUT /order/:id` | 1 → 1 | 3.0 → 3.0 ms (A/B with indexes dropped and re-added) | unchanged |
| Cobros del día `/depositedOrdersByDate/:d` | 85,398 → 85,398 | 106 → 108 ms (with the hint; 203 ms without it) | unchanged (N2) |
| Entregados `/deliveredOrders/:d` | 25,785 → 25,785 | 630 → 645 ms | unchanged (N2) |

\* Production average × (local after ÷ local before). This is conservative, because the local times include fixed Node/JSON overhead that doesn't shrink.

Summed over production's call volumes, these endpoints should need roughly **80% less database time** (about 2,670 s → about 470 s per 41.7 days). The 0.8–1.8 s peak-hour tails were driven by concurrent full scans on the 1 vCPU database, so they should shrink the most. That last point is expected, not measured.

**QW1: the order-creation lock (F2).** With another client's order being saved:

| Write | Before | After |
|---|---|---|
| Delivery tick on another client's order | blocked (lock timeout; production would wait up to 120 s) | **1 ms** |
| Update on an old paid order | blocked | **1 ms** |

**QW1: the migration can't damage data.**
- Row counts **and** `CHECKSUM TABLE … EXTENDED` of all 7 tables are identical before and after the migration, and again after a full drop-and-recreate cycle.
- The three indexes built in **about 1.5 s** total at production size.
- A second run issues no `ALTER` and takes 110 ms.
- With a transaction holding `deposits`, the migration **gave up after 10 s** and logged it. A read that arrived meanwhile waited about 9 s (bounded, not stuck), and the next run created the index.

**QW2: database outage while the server is running.**

| Request during the outage | Before (current production code) | After |
|---|---|---|
| `POST /order` | **Process crashed** (`ECONNREFUSED` as an uncaught rejection), and stayed dead after the database returned | `500` in 25–32 ms; **server alive** |
| `GET /ping` | no answer (process gone) | `500`; server alive |
| `GET /orders/` after the database returned | no answer | `200` |

**QW3: request log.**
- Lines appear as `GET /orders/ 200 799327 - 21.525 ms`.
- A login request (`/users/…`) and a Sígale request (`/api/…`) produced **no** log line, as intended.

**QW4: headless Chromium against the built client** (`/recorrido`, API intercepted):

| Scenario | Result |
|---|---|
| Healthy API | no dialog |
| API returns 404 | no dialog |
| Server unreachable | dialog after **0.8 s**; "Reintentar" button visible (blue `#1677ff`, white text) |
| `GET /notDeliveredOrders/` never answers | dialog after **21.0 s**, same button |

**What QW1–QW4 do *not* change:**
- The network floor of about **265 ms per request** (Bogotá → Oregon ≈ 180 ms, plus about 85 ms per Oregon → NYC3 database round trip). After QW1 the database is no longer the main cost; geography is. That is §8's job.
- "Cobros del día" and "Entregados", which are N2's job.

**After deploying:**
- Check that the deploy log shows `Migration: Added index …` three times.
- Re-run Appendix B: `EXPLAIN` should show `key = idx_orders_paid`, and `rowsReadPerCall` for the new calls should be in the hundreds, not about 25,000.
- Watch the QW3 request log during the 9–10 h and 15–18 h peaks.

---

## 4. Findings

### F1 — No secondary indexes: every main page scans the whole table

`orders`, `deposits`, `clients` and `products` have **only a primary key**. As a result:

| Page → endpoint | Query | Calls in 41.7 days | Average | p95 (approx.) | Max | Rows read per call → rows returned |
|---|---|---|---|---|---|---|
| Recorrido → `/notDeliveredOrders/` | [getNotDeliveredOrders](../server/controllers/orders.controllers.js#L51) | 7,994 | 142 ms | 251 ms | 820 ms | 25,056 → 36 |
| Nueva Orden (client selection) → `/unPaidOrdersByClient/:id` | [getUnPaidOrdersbyClientId](../server/controllers/orders.controllers.js#L196) | 12,547 | 62 ms | 115 ms | 428 ms | 24,956 → 1 |
| Cobrar by mall → `/unPaidOrders/:mall` | [getUnPaidOrders](../server/controllers/orders.controllers.js#L174) | 3,781 | 85 ms | 158 ms | **1,748 ms** | 25,428 → 127 |
| Cobrar Orden → `/deposits/:id` | [getDepositsByOrder](../server/controllers/deposits.controllers.js#L24) | 5,715 | 49 ms | 87 ms | 360 ms | 33,375 → 2 |
| Nueva Orden (submit) → `POST /order` | [createOrder lock](../server/controllers/orders.controllers.js#L293) | 1,228 | 82 ms | 151 ms | 382 ms | 24,997 → 0 |
| Cobros del día → `/depositedOrdersByDate/:date` | [getDepositedOrdersByDate](../server/controllers/orders.controllers.js#L117) | 475 | 207 ms | 347 ms | 669 ms | 80,438 → 31 |
| Cuentas por cobrar → `/orders/` | [getOrders](../server/controllers/orders.controllers.js#L29) | 354 | 136 ms | 550 ms | **1,777 ms** | 25,651 → 329 |
| Entregados → `/deliveredOrders/:date` | [getDeliveredOrders](../server/controllers/orders.controllers.js#L83) | 21 | **1,357 ms** | 1,660 ms | **2,136 ms** | all orders, `LIKE` on the item data |

`EXPLAIN` confirms `type = ALL` (a full scan) on `orders` or `deposits` in each of these queries. `getOrders` also shows "Using temporary; Using filesort".

**Scale:** these queries kept the database busy for only about **one hour in total** over the 41.7 days, so its capacity is fine. What hurts is the time each individual request waits.

**Relation to the tracker:** this confirms [PENDING_IMPROVEMENTS 5.3](PENDING_IMPROVEMENTS.md) with production data. The fix is QW1.

### F2 — Order creation locks the whole `orders` table

- `createOrder` runs `SELECT … WHERE clientId = ? AND paid = 0 … FOR UPDATE` ([orders.controllers.js:293](../server/controllers/orders.controllers.js#L293)) with no index on `clientId`.
- Under the cluster's isolation level (**REPEATABLE-READ**, verified), InnoDB locks **every row it scans**, which here means the whole table.
- The lock lasts until `COMMIT`, about 4 database round trips later (≈ 340 ms from Oregon). During that time every delivery tick, payment and edit on *any* order waits.
- Measured across the whole cluster (Sígale included): 204 lock waits, averaging 17 ms, the longest 285 ms.
- Fix: QW1, via the `(clientId, paid)` index.

### F3 — Code paths that can crash or hang the server

- **`pool.getConnection()` outside `try`** in 4 handlers (listed in QW2). If opening a database connection fails, the rejection escapes Express 4 and kills the Node process. Render restarts it, and until the new process has run its migrations and is listening, **every page of both apps hangs**.
- **`/ping`** has no error handling at all.
- **No `unhandledRejection` handler** exists anywhere in `server/`.
- **No axios timeout** in the client. A request that never gets a response spins forever.
- **Status:** this is the leading explanation for "stuck" (§5). It is **not yet confirmed**; Render → Events will show it (§6).

### F4 — The API server and the database are 4,000 km apart

- Render **Oregon** ↔ DigitalOcean **NYC3**: each database round trip costs **≈ 85 ms**. Measured: `/products` (a 1 ms query) takes 85–100 ms longer than a static file from the same server.
- Round trips add up per operation:

| Operation | Sequential round trips | Network time alone |
|---|---|---|
| Any page load (one GET) | 1 | ~85 ms |
| Delivery tick (`updateOrder`) | 2 | ~170 ms |
| New order (`createOrder`, **holding the table lock**) | 4 | ~340 ms |
| Payment (`createDeposit`) | 5–6 | ~425–510 ms |

- Users in Bogotá also reach the Oregon server through Render's edge. A static file from the API takes 250–300 ms to its first byte on a new connection, about 180 ms of which is the Bogotá→Oregon hop.
- Every write pays for a **CORS preflight** first (an extra full round trip). The frontend and API are on different domains, and `cors()` sets no `maxAge`.
- Fix: §8 (move the API to Render Virginia). CORS preflight: N4.

### F5 — Full page reloads after every action

- `window.location.reload()` runs 3 s after each delivery tick ([OrderDeliveryCard.jsx:38](../client/src/components/OrderDeliveryCard.jsx#L38), [OrderDeliveredCard.jsx:38](../client/src/components/OrderDeliveredCard.jsx#L38)) and after payments ([CollectOrderForm.jsx:109](../client/src/pages/CollectOrderForm.jsx#L109), [:223](../client/src/pages/CollectOrderForm.jsx#L223)).
- In 41.7 days that was **35,359** item updates and **7,994** Recorrido reloads. Each reload repeats F1 and F4 and re-parses the whole JS bundle.
- Already tracked as PENDING_IMPROVEMENTS 6.3. The fix is N1 and has to be done carefully (see the note there).

### F6 — Date filters written in a form no index can use

- `DATE(CONVERT_TZ(col, …)) = ?` and `DATE(orders.paidAt) = ?` wrap the column in a function, so an index on it can never be used:
  - [getDepositedOrdersByDate](../server/controllers/orders.controllers.js#L117) (plus an `OR` spanning two tables)
  - [getCollectedOrders](../server/controllers/orders.controllers.js#L218)
  - [getDepositsByDate](../server/controllers/deposits.controllers.js#L38)
- [getDeliveredOrders](../server/controllers/orders.controllers.js#L83) runs `LIKE '%"deliveredAt":"…"%'` over **all** orders, paid or not.
- [REFERENCE.md "Rule 2"](REFERENCE.md#rule-2-always-filter-by-converted-dates) currently prescribes this non-indexable form.
- Fix: N2.

### F7 — Frontend bundle: one 2.3 MB file

- `index.*.js` is about 2.3 MB before compression (local build) and 745 KB with Brotli as served. There is no code-splitting.
- It includes `@react-pdf/renderer`, which only [Invoice.jsx](../client/src/pages/Invoice.jsx) uses, but [App.jsx:3](../client/src/App.jsx#L3) imports that page on every load.
- The static site serves `/assets/*` with `Cache-Control: max-age=0` even though the filenames are hashed, so browsers re-check the file on every load.
- Impact is secondary, since the problem also happens on PCs. The fix is N3.

### F8 — The dashboard downloads every order's items just to compute totals

- `/orders/` returns 2.4 MB of `items` JSON (242 KB after Render's Brotli compression). `OrderCard` only uses it to compute the total.
- Low priority, because the network transfer is compressed.
- Already tracked as PENDING_IMPROVEMENTS 6.5. The fix is N5.

### F9 — Latent risk: `GET /deposits` returns every deposit ever made

- [getDeposits](../server/controllers/deposits.controllers.js#L14) returns all 34,169 deposits, joined with `orders.*` including `items`.
- **Nothing in the current frontend calls it**: `loadDeposits` is defined but never used. If anything did, the response would be tens of MB.
- Already tracked as PENDING_IMPROVEMENTS 5.6. The fix is N7.

---

## 5. "Slow" vs "stuck": what the data explains

### Slow (explained)

Typical waits, estimated from the measurements:

| Action | Estimate |
|---|---|
| Recorrido load | ≈ 0.4 s (≈ 180 ms to Oregon + 85 ms DB round trip + 142 ms scan), up to about 1.1 s at peak |
| Dashboard | 0.8–1.2 s, measured |
| Payment | ≈ 0.9 s (preflight + request to Oregon, 5–6 DB round trips), then a full page reload |

**Busy hours** (last 30 days, Colombia time) match "several times a day":

| Hour | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Orders created | 23 | **145** | **124** | 88 | 85 | 96 | 76 | 76 | 82 | 74 | 53 | 4 |
| Deposits (payments) | 25 | 70 | 62 | 47 | 48 | 49 | 48 | 134 | **291** | **267** | 117 | 8 |

### Stuck (not explained by query times)

The slowest statement recorded in 41.7 days took 2.1 s, so something else makes requests wait much longer or never finish. The candidates, most likely first:

1. **Process crash and restart (F3).** This fits "all pages, all devices, several times a day". Check Render → Events.
2. **Database maintenance or restart on a primary-only cluster.** With F3, even a short database outage becomes a server crash. Check DigitalOcean → the cluster's activity/maintenance history (QW5).
3. **A request stuck on a dead database connection.** It would hang until the operating system's TCP timeout (minutes). Evidence *against* this: the app opened only **about 209 database connections in 41.7 days**, so connections are stable. Revisit only if QW3's logs show requests lasting minutes.
4. **Render platform incidents.** Check the history at status.render.com for the reported times.

Not the cause: Render's Starter plan **never sleeps**, so free-tier cold starts don't apply.

---

## 6. Where to look: Render, DigitalOcean and the alert inbox

| Where | What to look at | What it means |
|---|---|---|
| **Render → coffeserver → Events** | "Instance failed", "Server unhealthy", "Out of memory", deploys during business hours | Crashes, OOM kills or deploys at the complaint times confirm F3 or a memory problem |
| **Render → Metrics** (7-day range) | CPU near 0.5 and memory near 512 MB, especially 9–10 h and 15–18 h | Resource saturation → consider the Standard plan (only if confirmed) |
| **Render → Logs** | Search `exited`, `ECONNRESET`, `PROTOCOL_CONNECTION_LOST`, `ETIMEDOUT`. Each `BlackCoffe Server running on port` line is a (re)start. After QW3, sort by `ms` | Restarts and database connection errors, with timestamps |
| **Alert inbox** (`NOTIFICATION_EMAIL`, subject `🚨 [BlackCoffe] Error en …`) | Bursts at the complaint times; SQL codes such as `ER_LOCK_WAIT_TIMEOUT` or `ETIMEDOUT` | Request-level failures. Crashes from F3 send no email |
| **DigitalOcean → Databases → pedidos → Insights** | CPU, memory, disk I/O and connections at the complaint times; disk usage | Database saturation (unlikely per §4), and whether the 30 GiB storage add-on is needed |
| **DigitalOcean → cluster Settings/Activity** | Maintenance window and past maintenance events | Planned downtime during business hours (QW5) |

Database statistics can be re-checked at any time with the SQL in Appendix B, run from the DigitalOcean console or the app's `/consultas` page (read-only queries only).

---

## 7. Next steps (after the quick wins)

- **N1 — Replace page reloads with in-place updates (F5, tracker 6.3).**
  - After `updateOrder` or `createDeposit` resolves, refetch only the affected list or order, and disable the control while it saves.
  - Read PENDING_IMPROVEMENTS "A second, more subtle regression risk: the delivery-card checkbox fix" first. A naive local-state version reintroduces a stale-items race that overwrites deliveries.
- **N2 — Rewrite the date filters as ranges (F6), then index them.**
  - The database clock is **UTC** (verified), so a Colombia day `:date` for UTC-stored columns becomes: `col >= :date + INTERVAL 5 HOUR AND col < :date + INTERVAL 29 HOUR`.
  - For `paidAt`, which is stored in Colombia time: `paidAt >= :date AND paidAt < :date + INTERVAL 1 DAY`.
  - Then add `orders(paidAt)` and `deposits(depositCreatedAt)` indexes.
  - Split the `OR` in `getDepositedOrdersByDate` into a `UNION`, and **remove its `IGNORE INDEX (idx_deposits_order)` hint** (added with QW1; see there).
  - Bound Entregados with `AND (orders.paid = 0 OR orders.paidAt >= :date)`. This is safe because paid orders can't be modified (since 2026-05-12). Dates before that could miss orders whose items were ticked after payment.
  - Update REFERENCE.md Rule 2 in the same change.
- **N3 — Split the bundle and cache assets (F7).**
  - `React.lazy` for `Invoice`, `BackupsPage` and `QueryPage`.
  - In the static site's Headers settings, add `/assets/*` → `Cache-Control: public, max-age=31536000, immutable`. Hashed filenames make this safe; `index.html` must stay uncached.
- **N4 — Cache CORS preflights (F4).**
  - Add `maxAge: 7200` to the `cors()` options in `server/index.js`.
  - **⚠️ Sígale:** that `cors()` call also carries Sígale's origin. This adds an option without touching the origins, but tell Sígale's owners.
- **N5 — Slimmer dashboard payload (F8, tracker 6.5).** Compute totals on the server and drop `items` from `/orders/`. `OrderCard` would need to change accordingly.
- **N6 — Normalize `items` into an `order_items` table (tracker 5.1).** Only if the `LIKE`-based delivery queries are still slow after QW1 and N2.
- **N7 — Remove or paginate `GET /deposits` (F9, tracker 5.6).**

---

## 8. Infrastructure: put the API next to the database

### Recommendation: move the API to Render **Virginia**, keep the database in NYC3

| Option | API ↔ database per round trip | Bogotá ↔ API | Work and risk |
|---|---|---|---|
| Today: Render Oregon + DB NYC3 | **~85 ms** (measured) | 250–300 ms first byte (measured) | — |
| **A. Render Virginia + DB NYC3** (recommended) | a few ms (estimate: same US-East corridor) | shorter than Oregon (estimate) | New Render service; the database is untouched; rollback = point the frontends back |
| B. Render Oregon + DB SFO3 | ~20–30 ms (estimate) | unchanged | New DO cluster + data migration + a new `DB_HOST` for **both** BlackCoffe and Sígale (the `sigale` database lives on the same cluster) + a downtime window; harder to roll back |

**Why not move the database to San Francisco:**
- It does less. Database latency stays at about 20–30 ms instead of a few ms.
- It leaves users in Bogotá talking to Oregon.
- It is the riskier migration: the data has to move, and Sígale's database moves with it.

Moving the API server is reversible and leaves the data where it is.

**Checklist for option A:**
1. Create a new Render Web Service in **Virginia** from the same repo and branch:
   - Same plan (Starter).
   - Same build and start commands. Copy them from the current service's settings; they are not recorded in the repo.
   - **All** environment variables, BlackCoffe's and Sígale's.
2. If DigitalOcean **Trusted Sources** is enabled, add the new service's outbound IPs (Render lists them per service). Today the database accepts connections from anywhere (§9).
3. Verify the new service: `/ping`, the dashboard, and a test order on test client **1557**.
4. Point the frontends at it:
   - Update `RENDER_SERVER` in [client/src/utils/config.js](../client/src/utils/config.js#L5) and redeploy the static site.
   - **⚠️ Sígale:** Sígale's app also calls this backend (its `VITE_API_URL`). Coordinate the switch with its owners.
   - Better still: give the new service a **custom domain** (for example `api.<your-domain>`) and point both frontends at it. Future moves then only need a DNS change.
5. **Suspend the Oregon service as soon as traffic has switched.** Both services run the same cron jobs (BlackCoffe's nightly backup and Sígale's every-minute jobs) and must not run them in parallel. Delete it after a few days. The CORS origins don't change, because the frontends keep their URLs.

**Plans:**
- Keep Render **Starter** unless Render Metrics show CPU or memory saturation (§6).
- The database plan (2 GB / 1 vCPU) is enough once QW1 is in: BlackCoffe's queries kept it busy only about one hour over 41.7 days.
- The BlackCoffe and Sígale data together measure about 67 MB. Check Insights → disk usage before paying for more storage (binary logs also use disk).

---

## 9. Ruled out, and other observations

| Suspect | Evidence | Verdict |
|---|---|---|
| Render cold starts | Starter plan never sleeps | Ruled out |
| Sígale load | Its scheduled jobs take about 1 ms each, 2 transactions per minute | Negligible |
| Nightly backup job | Runs at 23:00 (544 ms eligibility query) | Outside business hours |
| Database connection limit | At most 11 of 151 connections ever used; 0 "too many connections" errors | Ruled out |
| Database memory | 4,716 disk reads for 799,633,750 buffer requests (a 99.999% cache hit rate) | Ruled out |
| Response compression | Render's edge serves API responses with Brotli (2.4 MB → 242 KB) | Already handled |
| DigitalOcean's own monitoring | About 1.3 M connections from DigitalOcean's agents (about one every 3 s), each query ~1 ms | Constant background load; nothing to change |

**Other observations (not performance):**
- **The database is reachable from the internet.** Unknown hosts (likely scanners) connected 10–22 times each, which probably explains most of the 579 failed connection attempts. Enable DigitalOcean **Trusted Sources**, limited to Render's outbound IPs and your own.
- **Both apps connect as `doadmin`,** the cluster's admin account. Use a least-privilege user per app. Related to PENDING_IMPROVEMENTS Priority 2; Sígale's user is its owners' call.

---

## Appendix A — Raw measurements (2026-09-24)

**Database server:**
- MySQL 8.0.45; `max_connections` 151; buffer pool 256 MB; isolation level REPEATABLE-READ; clock UTC.
- Slow query log **off** (`long_query_time` 10 s); `performance_schema` on; `wait_timeout` 28,800 s.
- Up for 3,604,055 s (41.7 days).

**Global counters since restart:**
- `Select_scan` 1,899,176; `Select_full_join` 749,184.
- Temporary tables: 1,030,885, of which 298,918 went to disk (29%).
- Row lock waits: 204 (average 17 ms, max 285 ms).
- `Aborted_clients` 205; `Aborted_connects` 579; `Max_used_connections` 11.

**Data:**

| Table | Rows | Data | Index size |
|---|---|---|---|
| orders | 25,611 (387 unpaid, 364 active) | 57.5 MB (`items` = 40.3 MB; average 1,649 bytes, max 89,917) | 0 |
| deposits | 34,169 (41 deleted; since 2024-03-08) | 2.5 MB | 0 |
| order_snapshots | ~5,400 | 6.0 MB | 0.2 MB |
| clients | 659 | 0.1 MB | 0 |
| products | 209 | < 0.1 MB | 0 |

**Network (from Bogotá, time to first byte):**

| Request | Timing |
|---|---|
| Static file from the API server (no database) | 0.25–0.30 s |
| `/products` | 0.33–0.40 s |
| `/notDeliveredOrders/` | 0.47 s |
| `/orders/` | 0.81–1.23 s (241,967 bytes with Brotli) |
| Direct MySQL `SELECT 1` from Bogotá | 95–115 ms |
| New MySQL connection (TLS + authentication) from Bogotá | 1.0–1.3 s |
| Static site bundle | 745,304 bytes with Brotli, `Cache-Control: public, max-age=0, s-maxage=300` |

## Appendix B — Re-checking after changes

```sql
-- 1. Indexes present?
SELECT TABLE_NAME, INDEX_NAME, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) cols
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('orders','deposits')
GROUP BY TABLE_NAME, INDEX_NAME;

-- 2. Index actually used? Expect type=ref, key=idx_orders_paid (not type=ALL)
EXPLAIN SELECT id FROM orders WHERE paid = 0 AND (isAbandoned = 0 OR isAbandoned IS NULL);

-- 3. Slowest BlackCoffe queries since the last DB restart
SELECT LEFT(DIGEST_TEXT, 120) query, COUNT_STAR calls,
       ROUND(AVG_TIMER_WAIT/1e9) avgMs, ROUND(MAX_TIMER_WAIT/1e9) maxMs,
       ROUND(SUM_ROWS_EXAMINED/COUNT_STAR) rowsReadPerCall
FROM performance_schema.events_statements_summary_by_digest
WHERE SCHEMA_NAME = 'defaultdb'
ORDER BY SUM_TIMER_WAIT DESC LIMIT 15;
```

The query 3 averages include the months before the fix until the cluster restarts. To judge the effect, rely on `rowsReadPerCall`, `EXPLAIN`, and fresh `curl` timings:

```bash
curl -s -o /dev/null -w "%{time_starttransfer}\n" https://coffeserver.onrender.com/notDeliveredOrders/
```
