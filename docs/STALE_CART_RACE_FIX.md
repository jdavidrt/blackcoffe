# Stale Cart Race — Order Items Wipe Fix

**Date:** 2026-05-20
**Severity:** Critical (silent data loss)
**Status:** Fixed
**Affected entity:** `orders.items` (any non-paid order viewed on a delivery page)

## Symptom

An order's `items` JSON column would suddenly contain `"[]"` even though server logs showed the order had been updated with the full items array minutes earlier. The order would appear "empty" in every UI that reads `order.items` (delivery routes, cobrar, invoice, etc.) while clients, deposits, and other fields remained intact.

Reported instance: **order 22024**. Server log at 2026-05-15 19:28:21 −05:00 showed an `updateOrder` call carrying 12 items (10 delivered, 2 pending). A subsequent unrelated interaction produced `items: "[]"`.

## Root cause

`OrderDeliveryCard.jsx` and `OrderDeliveredCard.jsx` shared this pattern:

```jsx
const [cart, setCart] = useState([]);          // 1. initial state is empty

const handleCheckboxChange = async (itemId) => {
    const updatedCart = cart.map(...);          // 4. reads `cart` from closure
    await updateOrder(order.id, {               // 5. writes whatever `cart` was
      items: JSON.stringify(updatedCart)
    });
    setCart(updatedCart);
    setTimeout(() => window.location.reload(), 3000);
};

useEffect(() => {
    setCart(getOrderItems(order))               // 3. syncs cart AFTER first render
}, []);

// In the render:
<input
    type="checkbox"
    checked={item.delivered}
    onChange={() => handleCheckboxChange(item.id)}   // 2. closure captured on first render
/>
```

The checkboxes are rendered from `getOrderItems(order)` (always fresh from the prop), but the click handler reads from the local `cart` state. The closure for `handleCheckboxChange` is captured on the **first** render — when `cart = []`. The race:

1. Component mounts. `cart = []`. First render commits with checkboxes visible (rendered from the prop).
2. The captured `handleCheckboxChange` closure has `cart = []`.
3. Before `useEffect` fires and triggers a re-render with the synced cart, the user clicks a checkbox.
4. Handler executes: `[].map(...) → []` → sends `updateOrder(orderId, { items: "[]" })`.
5. Order items are wiped silently.

The race window is small (typically <100 ms between commit and effect), but it is reliably reproducible on slow devices, slow connections, or when the page has heavy initial work.

`OrderForm.jsx` in edit mode had a related race: the form's submit button is enabled immediately on mount, before `loadOrder` fetches the order, so clicking "Modificar Orden" too fast would submit with `cart = []` and wipe items.

## Fix

### Client — eliminate the stale closure

`OrderDeliveryCard.jsx` and `OrderDeliveredCard.jsx` no longer keep a local `cart` state. The handler computes `updatedCart` from `getOrderItems(order)` directly on each click, so it always sees the freshest items from the prop. A defensive empty-check aborts with a "recargue la página" modal if the prop itself returns no items.

```jsx
const handleCheckboxChange = async (itemId) => {
    const currentItems = getOrderItems(order);     // fresh on every click
    if (currentItems.length === 0) {
      Modal.error({ title: 'Error', content: 'No se pudieron leer los productos de la orden. Recargue la página.' });
      return;
    }
    const updatedCart = currentItems.map(...);
    await updateOrder(order.id, { items: JSON.stringify(updatedCart) });
    ...
};
```

### Client — block premature submits in OrderForm

Added `orderLoaded` flag. Edit-mode submit is blocked until the load resolves, and a non-empty cart is required for both edit and create paths:

```jsx
if (params.id) {
  if (!orderLoaded) { alert("La orden aún se está cargando..."); return; }
  if (cart.length === 0) { Modal.error({ title: 'Orden vacía', ... }); return; }
  ...
}
```

### Server — data-loss guard in `updateOrder`

The server now rejects any update whose `items` parses to `[]` when the existing row has a non-empty items array. This catches the same class of bug from any future code path:

```js
if (req.body.items !== undefined) {
    let incomingItems;
    try { incomingItems = JSON.parse(req.body.items); } catch { incomingItems = null; }
    if (Array.isArray(incomingItems) && incomingItems.length === 0) {
        const existingItems = (() => {
            try { return JSON.parse(existing[0].items || '[]'); } catch { return []; }
        })();
        if (existingItems.length > 0) {
            console.error(`[updateOrder] BLOCKED empty-items overwrite for order ${req.params.id}. Existing had ${existingItems.length} items.`);
            return res.status(400).json({
                message: "Empty items array rejected to prevent data loss",
                orderId: Number(req.params.id)
            });
        }
    }
}
```

Real edits go through `OrderForm` (cart length validated) and delivery toggles (every item preserved). An incoming `items="[]"` indicates a stale-state race — never a legitimate update.

## Files changed

| File | Change |
|---|---|
| `client/src/components/OrderDeliveryCard.jsx` | Removed local `cart` state; handler reads `getOrderItems(order)` directly. |
| `client/src/components/OrderDeliveredCard.jsx` | Same as above. |
| `client/src/pages/OrderForm.jsx` | Added `orderLoaded` flag, blocked empty-cart submits in both edit and create paths. |
| `server/controllers/orders.controllers.js` | Added empty-items rejection in `updateOrder`. |

## Data restoration

Order 22024 was restored from the server log to its pre-wipe state (12 items, $55,400 total) via a one-off Node script using the DB pool. The script verified `items = "[]"` before overwriting (to avoid clobbering any post-wipe edits), then ran `UPDATE orders SET items = ? WHERE id = 22024` with the recovered JSON, and was deleted after use.

For future incidents: a `BLOCKED empty-items overwrite` log line in the backend identifies the attacking request immediately, and the order is never actually modified — no restore needed.

## How to recognize this class of bug in the future

The general pattern is:

1. A component renders interactive controls from a **prop** (always fresh).
2. The handler for those controls reads from **local state** (stale on first render).
3. The handler **serializes the local state and writes it** to a server.

The fix is always: have the handler read the freshest source (the prop, or `getX(order)`) on each invocation. Local cache state is fine as long as nothing **writes from it** to a destination that could be overwritten with the stale value.

A related red flag is `useEffect(..., [])` (empty deps) that syncs prop → state. If anything writes from that state, you have this bug.
