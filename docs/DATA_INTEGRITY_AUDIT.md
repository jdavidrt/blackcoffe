# Data Integrity Audit

**Date:** 2026-05-20
**Scope:** Full codebase audit triggered by the stale-cart race that wiped `orders.items` on order 22024. Goal: find every comparable class of bug that can silently corrupt data, with concrete file/line references and recommended fixes.
**Reference:** [STALE_CART_RACE_FIX.md](STALE_CART_RACE_FIX.md)

## Summary

| # | Severity | Class | Status |
|---|---|---|---|
| C1 | Critical | Stale-state wipe on delivery toggle | Fixed |
| C2 | Critical | Premature submit on OrderForm edit | Fixed |
| H1 | High | `deleteDeposit` recalculation is non-transactional | Open |
| H2 | High | `createDeposit + updateOrder` is non-atomic | Open |
| H3 | High | Side effects inside `setCart` updater (strict-mode double-fire) | Open |
| H4 | High | Concurrent delivery toggle requests can be reordered | Mitigated by server guard |
| M1 | Medium | OrderForm merge uses cached `unPaidOrder.items` (lost-update) | Open |
| M2 | Medium | `updateClient` / `updateProduct` accept arbitrary partial bodies | Open |
| M3 | Medium | `updateOrder` does not validate field shapes (numeric `paid`, `deposit` ≥ 0) | Open |
| M4 | Medium | No optimistic locking on any table | Open |
| M5 | Medium | `deleteProduct` does not check order references (CLAUDE.md claims it does) | Open |
| M6 | Medium | `createOrder` accepts empty items array | Open |
| M7 | Medium | Delivery toggle reload races with subsequent toggles | Open |
| L1 | Low | Dead `values.items = JSON.stringify(cart)` in `handleConfirmPayment` | Open |
| L2 | Low | `setOrder({ order })` nested-object bug | Open |
| L3 | Low | `unmarkOrderAsAbandoned` does not re-check `paid` | Open |

## Critical (already fixed)

### C1 — Stale `cart` state in delivery cards wipes `items`

See [STALE_CART_RACE_FIX.md](STALE_CART_RACE_FIX.md) for full write-up. Summary: `OrderDeliveryCard` and `OrderDeliveredCard` rendered checkboxes from a prop but mutated a local `cart` state initialised to `[]`. Clicking a checkbox before `useEffect` synced the state wrote `items: "[]"` to the order.

### C2 — OrderForm edit mode could submit with `cart = []`

Same root cause as C1, on a slower timescale. Now guarded with an `orderLoaded` flag plus an empty-cart precondition in both edit and create paths of [client/src/pages/OrderForm.jsx](client/src/pages/OrderForm.jsx).

A server-side guard in [server/controllers/orders.controllers.js updateOrder](server/controllers/orders.controllers.js#L281) now also rejects any `items: "[]"` write when the existing row has non-empty items. This is the defense-in-depth backstop for every future variant of this bug.

## High

### H1 — `deleteDeposit` recalculation has no transaction

[server/controllers/deposits.controllers.js:70-145](server/controllers/deposits.controllers.js#L70-L145) executes:

1. `SELECT deposit`
2. `SELECT order`
3. `UPDATE deposits SET isDeleted = 1`
4. `SELECT all remaining active deposits`
5. **Loop**: `UPDATE deposits SET lastDeposit, newDeposit, dueOnDeposit` for each
6. `UPDATE orders SET deposit, paid`

Any failure between steps 3 and 6 leaves the deposit ledger inconsistent: the deleted deposit is gone, but the remaining deposits' cumulative totals are stale and the order's `deposit` field disagrees with the sum of active deposits.

**Recommended fix:** wrap the whole flow in a transaction:

```js
const connection = await pool.getConnection();
try {
    await connection.beginTransaction();
    // ... all six steps using `connection.query(...)` ...
    await connection.commit();
} catch (e) {
    await connection.rollback();
    throw e;
} finally {
    connection.release();
}
```

The existing transaction pattern in [server/migrations/backfill-missing-deposits.js](server/migrations/backfill-missing-deposits.js) is a good template.

### H2 — `createDeposit + updateOrder` in payment flow is non-atomic

[client/src/pages/CollectOrderForm.jsx:219-233 handleConfirmPayment](client/src/pages/CollectOrderForm.jsx#L219-L233) fires two sequential HTTP requests:

```js
await createDeposit(neewDeposit);
await updateOrder(params.id, orderUpdate);
```

If `createDeposit` succeeds but `updateOrder` fails (network drop, server crash, paid-guard race), a deposit row exists with no matching `order.deposit` update. The error path alerts the user but does not roll back the deposit. The order's `deposit` and `paid` fields are then out of sync with the deposit ledger until someone manually reconciles.

**Recommended fix:** introduce a single server endpoint `POST /orders/:id/payments` that performs both writes inside a transaction. Drop the two-step client flow. The new endpoint should also be the only place that sets `paid = 1` and `paidAt` to keep that decision server-authoritative.

### H3 — Side effects inside `setCart` state updater

[client/src/pages/CollectOrderForm.jsx:47-68 handleCheckboxChange](client/src/pages/CollectOrderForm.jsx#L47-L68):

```js
setCart((prevCart) => {
    const updatedCart = prevCart.map(...);
    var values = {};
    values.items = JSON.stringify(updatedCart);
    updateOrder(params.id, values);   // ← side effect inside updater
    return updatedCart;
});
```

React strict mode invokes state-updater functions twice in development to catch impure updaters. The `updateOrder` call here therefore fires **twice per click** in dev (and may double-fire in any future React 18+ concurrent-mode scenario). Also, errors from `updateOrder` are silently swallowed — no `await`, no catch.

This component does NOT have the C1 wipe bug because it renders checkboxes from local `cart` state (so empty state means no clickable checkboxes), and the new server guard now rejects empty-items writes regardless. But the pattern is still wrong.

**Recommended fix:** move the side effect out of the updater:

```js
const handleCheckboxChange = async (itemId) => {
    const updatedCart = cart.map(...);
    setCart(updatedCart);
    try {
      await updateOrder(params.id, { items: JSON.stringify(updatedCart) });
    } catch (e) {
      // revert local state, show error
      setCart(cart);
      Modal.error({...});
    }
};
```

### H4 — Concurrent delivery toggles can be reordered

In both delivery cards, every checkbox click fires a fresh `updateOrder` and queues a 3 s reload. If a user toggles two items in rapid succession:

- Request A reads `getOrderItems(order)` → builds updated items v1 → sends.
- Request B reads `getOrderItems(order)` → builds updated items v2 (still based on v0 from the prop, NOT v1) → sends.

The server processes whichever arrives last as the final state. **Request A's toggle is lost.** The 3 s reload then refreshes the page to whatever state landed.

The fix in C1 made the handler read the freshest prop, but the prop only refreshes on full reload. Between toggles, the prop is unchanged.

**Recommended mitigation:** after every successful `updateOrder`, re-fetch the order (or apply optimistic state) before allowing the next toggle. Alternatively, batch toggles client-side and submit them as a single update. The simplest immediate hardening is to disable all checkboxes on the card while a request is in flight.

## Medium

### M1 — OrderForm merge can lose updates

[client/src/pages/OrderForm.jsx:188-194](client/src/pages/OrderForm.jsx#L188-L194):

```js
if (unPaidOrder && unPaidOrder.id) {
    const existingItems = safeJSONParse(unPaidOrder.items, []);
    const mergedItems = [...existingItems, ...cart];
    await updateOrder(unPaidOrder.id, { items: JSON.stringify(mergedItems) });
}
```

`unPaidOrder.items` was fetched at `selectClient` time. Between then and submit, the same order could have been modified (another tab, another user, or the same user via a different page). The merge re-writes whatever `existingItems` was at fetch time, discarding any intervening writes.

**Recommended fix:** re-fetch the unpaid order inside `handleSubmitWithLogging` immediately before merging, or perform the merge server-side via a new `POST /order/:id/append-items` endpoint that does `SELECT ... FOR UPDATE` + append + `UPDATE` in a transaction.

### M2 — `updateClient` / `updateProduct` accept arbitrary partial bodies

[server/controllers/clients.controllers.js:64-82 updateClient](server/controllers/clients.controllers.js#L64-L82) and [server/controllers/products.controllers.js:47-58 updateProduct](server/controllers/products.controllers.js#L47-L58) use `UPDATE clients SET ?` / `UPDATE products SET ?` directly from `req.body`. Frontend never sends this today, but a malformed request like `{ clientName: "" }` would wipe a client's name.

**Recommended fix:** validate the body shape — reject empty required strings, reject unknown columns, and explicitly destructure expected fields rather than splatting `req.body` into the SET clause.

### M3 — `updateOrder` does not validate field shapes

`updateOrder` accepts any body (after the items-array guard). A request with `paid: "yes"`, `deposit: -500`, or an unknown column name would either succeed with corrupt data or fail with a raw SQL error. The empty-items guard added in this audit is the only field-shape check.

**Recommended fix:** allowlist columns (`deposit`, `paid`, `paidAt`, `collectedBy`, `paymentMethod`, `items`, `clientId`, `shopId`), coerce types, range-check `deposit ≥ 0`, and assert `paid ∈ {0, 1}`.

### M4 — No optimistic locking on any table

No table has a `version` or `updated_at`-based concurrency check. Two simultaneous updates to the same `orders` row silently last-write-wins. The `clientNameSnapshot` pattern protects historical orders from client edits but does not protect concurrent order edits from each other.

**Recommended fix (lightweight):** add an `updated_at` column to `orders`, `clients`, `products`, `deposits`. Every update reads the current `updated_at`, includes it in the WHERE clause, and rejects if `affectedRows === 0`. Frontend retries with the fresh row. This is one schema migration and ~10 lines per controller.

### M5 — `deleteProduct` does not check order references

[server/controllers/products.controllers.js:60-72](server/controllers/products.controllers.js#L60-L72) does a hard `DELETE FROM products WHERE id = ?` with no reference check. CLAUDE.md (line referencing Products endpoints) claims "validation prevents deletion if used in orders" — this is not actually implemented.

Impact is currently low because orders store product fields as snapshots inside the `items` JSON (`productName`, `unitValue` are copied at add-time), so deleting a product does not break historical orders. But it does break any future feature that relies on the live product id (re-ordering, analytics, reports).

**Recommended fix:** either remove the false claim from CLAUDE.md, or add the check. Recommended: add the check + soft delete (`isDeleted` flag) for parity with `clients`.

### M6 — `createOrder` accepts empty items

[server/controllers/orders.controllers.js:255-279 createOrder](server/controllers/orders.controllers.js#L255-L279) checks for duplicate item IDs but does not require items to be non-empty. An order with no products is meaningless and pollutes "Cuentas por cobrar".

**Recommended fix:** reject if `items` parses to `[]`. Frontend already enforces this (OrderForm now), but the server should not rely on it.

### M7 — Delivery toggle reload races with subsequent toggles

`OrderDeliveryCard.handleCheckboxChange` schedules `setTimeout(() => window.location.reload(), 3000)`. If the user toggles a second checkbox during those 3 s, a second reload is queued. The reloads execute one after another, the second one wasted, and there's no visual indication the request succeeded until the page refreshes.

**Recommended fix:** cancel any pending reload when a new toggle starts. Or better: update local state optimistically from the server's response and remove the reload entirely.

## Low

### L1 — Dead `values.items = JSON.stringify(cart)` in handleConfirmPayment

[client/src/pages/CollectOrderForm.jsx:182](client/src/pages/CollectOrderForm.jsx#L182) computes `values.items` but the actual `orderUpdate` object constructed at line 211 doesn't include `items`. The line is a no-op that misleads readers and would re-trigger the C1 class of bug if anyone "fixed" it by spreading `...values` into `orderUpdate`.

**Recommended fix:** delete the line.

### L2 — `setOrder({ order })` nested-object bug

[client/src/pages/CollectOrderForm.jsx:237](client/src/pages/CollectOrderForm.jsx#L237):

```js
setOrder({ order });   // → { order: {...} }, not {...order}
```

This sets the order state to `{ order: <the previous order object> }` instead of cloning it. Currently benign because a `window.location.reload()` runs 2 s later, but if the reload is ever removed, every consumer reading `order.clientId` will get `undefined`.

**Recommended fix:** `setOrder({ ...order })` or just remove the line — the reload will rebuild state from the server.

### L3 — `unmarkOrderAsAbandoned` does not re-check `paid`

[server/controllers/orders.controllers.js:423-447 unmarkOrderAsAbandoned](server/controllers/orders.controllers.js#L423-L447) unconditionally clears the abandon fields. If an order was paid via some other path between abandonment and reactivation, this would silently produce a paid+reactivated order — confusing but not destructive.

**Recommended fix:** read `paid` first, refuse reactivation of paid orders with the same 400 + `orderId` pattern used elsewhere.

## What we already do well

- Items duplication is rejected in `createOrder` and `updateOrder` via `hasDuplicateItemIds`.
- Paid orders are immutable (`updateOrder` and the new empty-items guard).
- Orders with deposits cannot be hard-deleted (`deleteOrder`).
- Clients with active orders cannot be edited or deleted (`updateClient`, `deleteClient`).
- Client identity at payment time is snapshotted onto the order (`clientNameSnapshot` etc.).
- Deposits are soft-deleted with full audit trail.
- Date handling consistently uses Colombia timezone with documented conventions.

## Recommended order of work

1. **H1** (transactional `deleteDeposit`) — highest ROI, biggest hidden risk.
2. **L1, L2** (one-line cleanups) — remove footguns while context is fresh.
3. **H3** (move side effect out of setCart updater) — small, prevents a real strict-mode double-fire.
4. **M2, M3, M5, M6** (server-side input validation) — best done in one pass with a shared validation helper.
5. **H4 + M7** (delivery toggle in-flight handling) — best done together; consider switching to optimistic UI.
6. **H2** (atomic payment endpoint) — biggest refactor; pairs naturally with M4.
7. **M4** (optimistic locking) — biggest architectural change; defer until at least two of the above land.
8. **M1** (server-side merge) — naturally falls out of doing M4 properly.

## Pattern to watch for in code review

Any time you see this shape in a client component, it's a candidate for the C1 class of bug:

```jsx
const [localState, setLocalState] = useState(initialEmpty);

useEffect(() => { setLocalState(fromProp(prop)) }, []);   // ← syncs after render

const handler = () => {
    // ... compute newValue from localState ...
    await write(JSON.stringify(newValue));   // ← writes from localState
};

// rendered controls from `prop`, not `localState`
return prop.map(item => <input onClick={handler} />);
```

The fix is always: read the freshest source (the prop, or `getX(prop)`) inside the handler. Local state is only safe as a write source if the controls are also rendered from local state (so empty state means no clickable controls).
