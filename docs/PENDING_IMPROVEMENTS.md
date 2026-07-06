# BlackCoffe — Pending Improvements & Audit Findings

This is the single consolidated tracker for all known-but-not-yet-shipped improvements to BlackCoffe. It supersedes and replaces `docs/DATA_INTEGRITY_AUDIT.md`, `docs/STALE_CART_RACE_FIX.md`, `docs/ORDER_DUPLICATION_FIX_IMPLEMENTATION.md`, `docs/INVESTIGATION_RESULTS.md`, and the improvement-tracking half of the old `docs/PROJECT_IMPROVEMENTS.md` (its pure reference content — deployment, DB schema, timezone handling — now lives in [REFERENCE.md](REFERENCE.md)).

**How to read this file** — three tiers, in priority order:
1. **Priority 1**: everything tied to the unmerged branch `claude/friendly-burnell-b334da`. Highest priority because the code already exists and just needs careful reconciliation with what `main` has done independently since.
2. **Priority 2**: authentication and hardcoded-credential issues. Documented here only — **not implemented in this pass**.
3. **Pending known improvements**: everything else (business logic, user-error prevention, scalability, performance). No ranking implied — just a record of what's known and open.

---

## Already implemented on `main`

Full detail lives in `CLAUDE.md`'s "Completed Improvements" section (items 0–7) — not repeated here. Quick index of what's already shipped, for cross-reference against the findings below:

| # | What | Commit(s) |
|---|---|---|
| — | Stale-cart race fix (checkbox handlers read `getOrderItems(order)` fresh from the prop instead of stale local state); empty-items data-loss guard in `updateOrder` | `df4b8c5` |
| — | Paid-order immutability (`updateOrder` rejects any change once `paid=1`); `deleteOrder` blocked when deposits exist | `76a0162` (CLAUDE.md rule #9) |
| — | Client protection + snapshot-on-payment (`deleteClient`/`updateClient` blocked while active order exists → later partially relaxed; `clientNameSnapshot`/`clientPremisesSnapshot`/`clientMallSnapshot` captured on full payment) | `3f68348` (CLAUDE.md rule #8) |
| 7 | Client edit unlocked while active order exists (`updateClient`'s active-order block removed; `ClientForm.jsx` warns instead) | `6e97d00` (CLAUDE.md rule #7) |
| — | Deposit `paid` flag re-verified server-side against current order total before being trusted from the client | `eb0f8d8` |
| — | `getDepositsByOrder` no longer 404s when an order legitimately has zero deposits | `fb70e47` |
| 0–6 | Delete deposits (soft delete + recalculation), safe JSON parsing, utility functions, page merge, etc. | see CLAUDE.md |
| — | Invoice Payment Information Enhancement (payment breakdown on `Invoice.jsx`/`PublicInvoice.jsx`) | completed 2025-10-04, not previously listed in CLAUDE.md |
| — | Product List Progressive Reveal (`ProgressiveProductList.jsx`, show-last-3-then-load-more across all cart/order views) | completed, not previously listed in CLAUDE.md |
| H1/H2 | `createDeposit`/`deleteDeposit` rewritten as full transactions (`SELECT ... FOR UPDATE` row locking on the order); server computes `lastDeposit`/`newDeposit`/`dueOnDeposit`/`paid`/`paidAt` itself; overpayment guard added. Frontend contract changed to `{orderId, depositValue, paymentMethod, collectedBy}` — `CollectOrderForm.jsx` updated to match in the same pass. Re-derived against current `main`, not merged from the branch (branch tip predates paid-order immutability/snapshots) | this pass, 2026-07-06 |
| 6.1 | `deleteDeposit`'s N+1 per-deposit recalculation loop collapsed into a single batched `UPDATE ... CASE depositId WHEN ... END` | this pass, 2026-07-06 |
| 1.9 | `deleteDeposit` now recomputes `paid` from the new running total instead of forcing it to 0 unconditionally, and clears `paidAt` to `NULL` only on an actual 1→0 transition | this pass, 2026-07-06 |
| 1.3 | `createOrder` now runs `SELECT ... FOR UPDATE` on the client's existing unpaid orders inside a transaction and merges server-side, closing the two-tabs-both-create race that client-only enforcement (`unPaidOrder` check in `OrderForm.jsx`) can't prevent alone | this pass, 2026-07-06 |
| 1.5 | `hasDuplicateItemIds` (rejected the whole request with 400) replaced by `stackMergeItems()`, which sums `quantity` for colliding item IDs. Applied in `createOrder`'s merge path and `updateOrder`'s items path (the latter had no duplicate-ID handling at all before this) | this pass, 2026-07-06 |
| 1.7 | Removed dead/duplicate `CONVERT_TZ(orders.createdAt, ...)` columns from `orders.controllers.js` list queries (some were genuinely duplicate-aliased as `createdAt` twice in the same query — `getNotDeliveredOrders`/`getDeliveredOrders` — others just wastefully unaliased). Added a minimal `tzColombia()` helper in `server/utils/sqlFragments.js`. Alias names were deliberately left unchanged (not renamed to `createdAtTs`/`createdAtDate` as the branch did) to avoid touching the 5 frontend files that read `order.createdAt` | this pass, 2026-07-06 |
| 2.9 | Every catch block in `orders.controllers.js`/`clients.controllers.js`/`products.controllers.js`/`query.controllers.js` now returns a generic Spanish message instead of `error.message`/`error.sqlMessage`; `sendErrorEmail(...)` (already present in every catch) still captures full detail server-side. No new abstraction added — `users.controllers.js` was already safe | this pass, 2026-07-06 |
| 1.8 | `UserProvider.autenticateUser` now calls `setUser()` *before* its `return` (previously unreachable dead code, so context never populated on login); `LoginForm.jsx` calls `autenticateUser` once per submit instead of twice | this pass, 2026-07-06 |
| 1.4 | `CollectOrderForm.jsx` now sends `localStorage.getItem('user')` as `collectedBy` in the atomic deposit payload, instead of `order.mall` | this pass, 2026-07-06 |
| 2.6 | **Preserved, not fixed** — localhost origins (`localhost:5173`, `localhost:25060`) stay in `server/index.js`'s CORS allowlist deliberately, to keep local dev working. That array is also flagged by this repo's Sigale guardrail (shared with the Sigale production origin), so it isn't touched casually. Revisit only alongside the full auth overhaul in Priority 2 | intentionally kept, documented 2026-07-06 |

---

## PRIORITY 1 — `claude/friendly-burnell-b334da` (superseded — most findings re-implemented directly on `main`)

### Status as of 2026-07-06

9 of this branch's findings — **H1/H2, 6.1, 1.9, 1.3, 1.5, 1.7, 2.9, 1.8, 1.4** — have been re-derived by hand directly against current `main` (see the "Already implemented on main" table above for exact detail per item) and are no longer open. **They were not merged from the branch** — per the warning below, the branch tip predates several of `main`'s data-integrity protections, so every one of these was rewritten from scratch against current `main`'s code, keeping paid-order immutability, snapshots, the empty-items guard, and the deposit-existence delete guard fully intact.

Two items from the branch remain genuinely open:
- **2.7** (input validation / column allowlisting) — considered, deliberately deferred this pass (not requested).
- **1.6** (checkbox write-serialization via `latestCartRef`) — considered and explicitly **rejected**: adopting it reintroduces the local-`cart`-state shape that caused the C1 stale-cart-race bug `main` already eliminated (see the regression-risk callout below). Do not adopt as originally coded on the branch.

The branch itself is still unmerged and should still not be merged/rebased as a unit — the rest of this section (which describes what it's missing and why) remains accurate for what's left in it (2.7, 1.6, and Priority 2's auth items).

### What this branch is

One commit (`3a4f954`, "Audit fixes: integrity & security sections 1 and 2") ahead of the commit where it diverged from `main` (merge-base `2225096`). It contains its own findings document, `AUDIT_2026-04-21.md` (6 sections, ~35 findings, not reproduced in full here — see the branch if the raw text is needed), and working code for a meaningful subset of that audit's sections 1 (Code Integrity & Design) and 2 (Race Conditions/Security/Unsafe Practices).

### ⚠️ Critical: `main` has moved on since this branch diverged — do not merge/rebase blindly

The branch was built against `orders.controllers.js`, `deposits.controllers.js`, and `clients.controllers.js` **before** several data-integrity protections existed on `main`. Confirmed by direct inspection of both branch-tip and current-`main` file contents (not just diffs or commit messages):

| File / function | What `main` added independently since divergence | Present on branch tip? |
|---|---|---|
| `orders.controllers.js` → `updateOrder` | Paid-order immutability check (`paid=1` → reject all edits, `76a0162`) | **No** — branch's `updateOrder` goes straight from schema validation to `UPDATE orders SET ?` with no paid check at all |
| `orders.controllers.js` → `updateOrder` | Empty-items data-loss guard (rejects `items:"[]"` overwriting a non-empty row, `df4b8c5`, see stale-cart-race history) | **No** |
| `orders.controllers.js` → `updateOrder` | `clientNameSnapshot`/`clientPremisesSnapshot`/`clientMallSnapshot` capture when `paid` transitions to 1 (`76a0162`/`3f68348`) | **No** — branch's read queries (`getOrder`, etc.) also don't select or `COALESCE` these columns |
| `orders.controllers.js` → `updateOrder` | Re-verify `paid=1` against the *current* DB items total before accepting it, instead of trusting the client (`eb0f8d8`) | **No** |
| `orders.controllers.js` → `deleteOrder` | Block hard-delete when the order has any deposit history, including soft-deleted (`76a0162`) | **No** — branch's `deleteOrder` is a plain unconditional `DELETE FROM orders WHERE id = ?` |
| `clients.controllers.js` → `deleteClient` / `updateClient` | The entire client-protection + snapshot feature (active-order delete block, later relaxed edit block) — `3f68348`, further changed by `6e97d00` | **No** — this whole feature postdates the branch's divergence point; branch tip's `deleteClient` is an unconditional soft-delete with no active-order check |
| `deposits.controllers.js` → `getDepositsByOrder` | Stopped 404ing when an order has zero deposits (`fb70e47`) | **No** — branch still returns 404 in that case (only the error message text was touched) |
| `OrderDeliveryCard.jsx` / `OrderDeliveredCard.jsx` (client) | Eliminated local `cart` state entirely — checkbox handler reads `getOrderItems(order)` fresh from the prop on every click, with an empty-result guard (this **is** the fix for the stale-cart-race / C1 critical bug) | **Partially reintroduced** — see next section |

**Practical consequence**: reapplying this branch's `orders.controllers.js`, `deposits.controllers.js`, or `clients.controllers.js` wholesale (merge, rebase, or copy-paste) would silently strip out paid-order immutability, the deposit-existence delete guard, the entire client-protection/snapshot system, and the empty-items data-loss guard — five of `main`'s most important, already-documented data-integrity rules. **Any future implementation pass must re-derive each of the branch's genuinely new fixes (below) directly against current `main`'s code, not merge the branch as a unit.**

### ⚠️ A second, more subtle regression risk: the delivery-card checkbox fix

The branch's own audit finding **1.6** ("side effects inside `setCart` updater" / concurrent-write reordering) is fixed by introducing `latestCartRef` + a promise-chain (`writeChainRef`) to serialize writes in `OrderDeliveryCard.jsx`, `OrderDeliveredCard.jsx`, and `CollectOrderForm.jsx`. The problem: this reintroduces a **local `cart` ref initialized to `[]` and populated via `useEffect(() => {...}, [])` after mount** — structurally the same shape as the **C1 stale-cart-race bug** (`STALE_CART_RACE_FIX.md`) that `main` already eliminated by removing local cart state completely and reading `getOrderItems(order)` fresh from the prop inside the handler itself. A click before the branch's `useEffect` fires would again see `latestCartRef.current = []` and wipe `items`. **If 1.6's serialization fix is ever adopted, it must be layered onto `main`'s current prop-driven (no local state) pattern, not on top of the branch's reintroduced local-state pattern.**

### What was coded on the branch, and its status now

| Finding | Branch's fix (for reference) | Status on `main` |
|---|---|---|
| H1/H2 (critical) — non-transactional deposit create/delete | `createDeposit`/`deleteDeposit` rewritten as transactions with `SELECT ... FOR UPDATE` row locking; server computes `lastDeposit`/`newDeposit`/`dueOnDeposit`/`paid`/`paidAt`; overpayment guard | ✅ done — re-derived against current `main`, see table above |
| 6.1 — N+1 recalculation loop | Per-deposit loop collapsed into one batched `UPDATE ... CASE depositId WHEN ... END` | ✅ done — see table above |
| 1.9 (bonus) — stale `paidAt` when un-paying | `deleteDeposit` clears `paidAt = NULL` when the running total falls back below the order total | ✅ done — see table above |
| 1.3 — one-unpaid-order-per-client race | `createOrder` runs `SELECT ... FOR UPDATE` on the client's existing unpaid orders inside a transaction, merges server-side | ✅ done — see table above |
| 1.5 — item-ID collision on duplicate submit | `stackMergeItems()` sums `quantity` for colliding IDs instead of a 400 | ✅ done — see table above |
| 1.7 — duplicate `createdAt` SQL alias | `sqlFragments.js` with renamed `createdAtTs`/`createdAtDate` aliases | ✅ done, but **not** via the branch's rename (would've broken 5 frontend files reading `order.createdAt`) — dead/duplicate columns removed instead, aliases kept stable. See table above |
| 2.9 — error responses leak SQL state | New `responseUtils.js` (`sendError`) abstraction + sanitization | ✅ sanitization done — **not** via a new abstraction (`main` already had `sendErrorEmail` in every catch; only the client-facing message changed). See table above |
| 1.8 — login never populates user context | `setUser()` before return; single `autenticateUser` call | ✅ done — see table above |
| 1.4 — `collectedBy` stored the mall name, not the user | `localStorage.getItem('user')` sent as `collectedBy` | ✅ done — see table above |
| 2.6 — CORS includes localhost in prod | `ALLOWED_ORIGINS` env var drives prod allow-list | ⏸️ **not fixed, deliberately preserved** — see table above |
| 2.7 — no input validation on writes | `validation.js` — `pickAndValidate()` + column-allowlist schemas | ⏳ still open — not requested this pass |

**Contract change (now live on `main`)**: the atomic `createDeposit` endpoint expects `{ orderId, depositValue, paymentMethod, collectedBy }` (server derives everything else) instead of the old two-call flow (client-computed deposit row + separate `updateOrder`). `CollectOrderForm.jsx`'s `handleConfirmPayment` was updated in the same pass to match — these two sides were adopted together, as required.

### Not touched by the branch at all

- `server/controllers/users.controllers.js`, `server/routes/users.routes.js`, `server/db.js` — so audit findings 2.1/2.2 (plaintext password over URL, localStorage-only session) are untouched. See Priority 2.
- `client/src/pages/OrdersPage.jsx` — the hardcoded `'031421'` master password (2.4) is untouched. See Priority 2.
- The underlying item-ID design (`product.id + ' ' + HH:mm:ss DD/MM/YY`, one-second resolution) is unchanged — 1.5's *practical* impact is mitigated (collisions now sum quantity instead of erroring) but the identifier itself is still collision-prone by design.

### Re-evaluation of `ORDER_DUPLICATION_FIX_IMPLEMENTATION.md`

This document (deleted as part of this consolidation) proposed a client+server checksum/snapshot validation layer to catch cart duplication, and ended unimplemented — it closes with an unanswered "Questions for Implementation" section. Its own root-cause list maps directly onto this branch's audit findings **1.3** (order-merge race) and **1.5** (item-ID collision). Verdict: **superseded, do not implement as originally written.** The branch's actual `server/utils/validation.js` (column allow-listing + type/range checks) is a leaner, already-built alternative to the proposal's "server-side validation" half, and `stackMergeItems()` is a more direct fix for the duplication symptom than a checksum/snapshot comparison layer would have been. If duplication resurfaces after this branch's fixes are eventually adopted, prefer targeted fixes (e.g., a proper unique ID generator such as `crypto.randomUUID()` instead of a one-second timestamp) over reviving the checksum/snapshot machinery.

---

## PRIORITY 2 — Auth & hardcoded credentials (documented only, not implemented in this pass)

| Finding | Description | Location |
|---|---|---|
| 2.1 (critical) | `GET /users/:userName/:pass` — password travels in the URL (server logs, browser history, Referer headers) and is compared in plaintext against the DB | `server/routes/users.routes.js`, `server/controllers/users.controllers.js` |
| 2.2 (critical) | Auth state is a single `localStorage.setItem('user', ...)` string with no server-side validation — trivially spoofable from the browser console; no auth middleware exists on any route | `client/src/pages/LoginForm.jsx`, entire API surface |
| 2.3 (high) | `POST /query` accepts arbitrary read-only SQL with no authentication — the #1 data-exfiltration risk in the app (full `clients` table, etc., reachable by anyone) | `server/controllers/query.controllers.js`, `server/routes/query.routes.js` |
| 2.4 (high) | Hardcoded master password `'031421'` in the frontend bundle unlocks an all-orders view | `client/src/pages/OrdersPage.jsx` |
| 2.5 (high) | DB credentials and Resend API key live in `.env.local` in the project worktree; rotation story unclear | project root `.env.local` |
| 2.10 (medium) | No CSRF protection — currently moot (localStorage has no ambient-authority CSRF exposure), but becomes relevant the moment auth moves to cookies | n/a |

Superseded/folded-in from the old `PROJECT_IMPROVEMENTS.md` "Code Improvement Opportunities" list (same category, kept together rather than duplicated):
- **DB credentials → env vars** (`server/db.js` hardcodes the DigitalOcean password).
- **Frontend API URLs → env vars** (hardcoded `https://coffeserver.onrender.com` / `localhost:25060` in `client/src/utils/config.js`).
- **Full auth overhaul**: bcrypt-hash stored passwords (needs a rehash-on-first-login migration since existing passwords are plaintext), move login to `POST /auth/login` with a JSON body, issue a signed JWT in an httpOnly cookie, add auth middleware protecting every route except login and the public invoice (`/factura/:id`), gate `/query` behind it, and replace the `OrdersPage.jsx` master password with a real role check.

---

## Pending known improvements (no priority ranking)

Everything below is a known gap with no code anywhere addressing it. Organized by the branch audit's own severity buckets (sections 3–6), plus leftover items from the old `PROJECT_IMPROVEMENTS.md` "Code Improvement Opportunities" list.

### Business logic (audit section 3)
- **3.3** — Merging into an unpaid order silently commingles already-delivered items with new undelivered ones; no confirmation shown to the person merging.
- **3.4** — Reactivating an abandoned order doesn't refresh item prices from the current `products` table; a long-abandoned order keeps stale `unitValue`s.
- **3.5** — `DELETE /order/:id` is a hard delete, inconsistent with the soft-delete pattern used for `clients` and `deposits` — loses audit trail when an order (with no deposits) is removed.
- **L3** — `unmarkOrderAsAbandoned` doesn't re-check `paid` before clearing abandon fields.
- **L2** — `CollectOrderForm.jsx` has a `setOrder({ order })` nested-object bug (sets state to `{ order: {...} }` instead of `{...order}`); currently masked by a `window.location.reload()` a few seconds later.
- **L1** — Dead `values.items = JSON.stringify(cart)` line in `handleConfirmPayment` that doesn't actually feed into the update payload.

### User-error prevention (audit section 4)
- **4.1** — Deposit input field has no `min`/`max`/validator; a negative amount isn't rejected client-side (the atomic `createDeposit` endpoint does now reject non-positive `depositValue` and overpayment server-side — see H1/H2 in "Already implemented on main" — but full client-side UX validation is still open).
- **4.2** — Several destructive actions (order delete, client delete, product delete) lack a confirmation modal in places `CLAUDE.md` documents as standard.
- **4.3** — No lint rule enforcing `type="button"` on non-submit buttons inside forms — this exact bug has recurred historically and nothing prevents a recurrence.
- **4.4** — Phone/premises/name fields have no format validation; a non-numeric `premises` value silently breaks the `CAST(clients.premises AS SIGNED)` sort.
- **4.5** — Payment confirm button can theoretically be double-clicked into a duplicate deposit if the backend is slow; only a `setIsRegistering` flag guards it, no idempotency key.
- **4.6** — No `.trim()` on text inputs — `"david "` and `"david"` are different logins/client names.

### Data scalability (audit section 5)
- **5.1** (critical, biggest single item) — `orders.items` is a JSON-in-TEXT column; delivery-status queries use `LIKE '%"delivered":false%'`, forcing a full table scan with no index possible. Proposed fix: normalize into a dedicated `order_items` table (see the branch's own audit doc for the exact `CREATE TABLE` if this is picked up later — not reproduced here since it needs re-validation against current schema first).
- **5.2** — Some client/product text columns are too narrow (historically `VARCHAR(20)` on `clientName`/`premises` per the branch's audit, already widened on `main`'s current schema — reverify against current `REFERENCE.md` schema before treating as still-open) while `abandonReason` has no application-level length cap.
- **5.3** — Missing indexes on hot-path columns: `orders.paid`, `orders.clientId`, `orders.isAbandoned`, `orders.paidAt`, `deposits.orderId`, `deposits.isDeleted`, `deposits.depositCreatedAt`, `clients.mall`, `clients.isDeleted`.
- **5.4** — No foreign-key constraints anywhere (`orders.clientId`, `deposits.orderId`, `deposits.clientId` are soft references only) — this is precisely why the `/ordenesSinCliente` orphaned-orders cleanup page has to exist.
- **5.5** — Soft-deleted deposits are never archived/purged; every query pays the scan cost forever.
- **5.6** — `getDeposits` has no `WHERE`/`LIMIT` — returns every deposit ever made.

### Performance (audit section 6)
- **6.2** — The `LIKE '%"delivered":false%'` full-table-scan pattern also shows up in `getNotDeliveredOrders`/`getDeliveredOrders` — same root cause as 5.1.
- **6.3** — `window.location.reload()` is used as a poor-man's state sync after nearly every mutation (payment, deposit delete, checkbox toggle) — full SPA reload on every action, several seconds of dead screen on slow connections.
- **6.4** — `sumarDepositos`/`sumarDepositosPorMall` in `DepositedOrdersPage.jsx` recompute on every render instead of being memoized.
- **6.5** — Most controller `SELECT`s pull every column (including the potentially large `items` TEXT/JSON) even for dashboard/count views that don't need it.
- **6.6** — No pagination on `/orders`, `/deposits`, `/abonos`, `/clients` — tolerable at current (~10k row) volume, won't be at 10x that.

### Leftover items (from the old "Code Improvement Opportunities" list)
- **Frontend error boundaries** — no React error boundary exists anywhere; a component crash white-screens the whole app. Fully open.
- ~~Basic error handling in controllers~~ / ~~Standardize API response format~~ — **partially superseded** by the branch's `server/utils/responseUtils.js` (Priority 1) — re-evaluate scope once that lands rather than building a second, competing response wrapper.

---

## Doc map

- **[REFERENCE.md](REFERENCE.md)** — Deployment Guide, Database Schema, Timezone Implementation. Pure reference material, not improvement tracking.
- **This file** — the sole improvement/audit tracker going forward. Update it in place; don't spin up a new incident-specific doc the next time something breaks.
- **CLAUDE.md** — source of truth for what's actually shipped to `main` ("Completed Improvements" + "Core Business Rules" sections).
