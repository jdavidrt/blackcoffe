/*
 * ============================================================
 * SÍGALE — PURCHASES CONTROLLER (public purchase flow)
 * The transactional heart of the system (ADR-0001 §6).
 *
 * Every inventory path uses pool.getConnection() + beginTransaction()
 * + SELECT ... FOR UPDATE so concurrent reservations on the same stage
 * serialize and exactly one wins the last spot (the other gets 409).
 * NEVER pool.query for these flows. conn.release() always in finally.
 *
 * An order is one row per seat in `tickets`, all sharing one sequential
 * `orderId` (starting at 100). Only the first-inserted row of an order
 * carries `orderAnchor`/`idempotencyKey` (both UNIQUE) — that's what
 * catches a concurrent duplicate order, since the value can't be repeated
 * per-row without breaking the constraint.
 *
 * Security (plan §6): explicit column lists on the public INSERT (no
 * `SET ?` mass-assignment — an attacker must not be able to force
 * status='confirmed'); parameterized everywhere, including the bulk
 * multi-row VALUES ? insert (each row is an explicit array built by us,
 * never req.body passed through directly).
 *
 * Hold semantics (decision #4): reservationExpiresAt = createdAt + 24h
 * (real hold). The 20-minute countdown is frontend copy only.
 *
 * QR rule: validationHash is minted ONLY at confirm — never before. This
 * is the door-scan security invariant markUsed() (scan.controllers.js)
 * relies on. The QR is generated client-side and never stored.
 * ============================================================
 */

import pool from '../db.js';
import { sendErrorEmail } from '../utils/emailNotifier.js';
import { toSqlUtc } from '../utils/time.js';

const MAX_TICKETS_PER_PURCHASE = 6;
const ORDER_ID_RETRIES = 25;
const ORDER_ID_START = 100; // first order in the system is #100
const RESERVATION_HOLD_MS = 24 * 60 * 60 * 1000; // 24h hold (decision #4)

/**
 * Compute the next sequential orderId inside an open transaction.
 * Locks the tickets table (for the live max) AND the order_counter row (for
 * the persisted high-water mark) so concurrent inserts queue and never
 * collide. The high-water mark matters once per-event "Delete All Tickets"
 * exists (multi-event): deleting the rows holding today's MAX(orderId) must
 * not make that orderId assignable again, since validationHash is derived
 * from (orderId, seatIndex) — a reused orderId would make an already-issued
 * QR scan in as a different, newer ticket. Falls back gracefully to
 * ORDER_ID_START when neither source has a value yet.
 */
async function nextOrderId(conn) {
  const [[row]] = await conn.query(
    'SELECT MAX(orderId) AS maxId FROM tickets FOR UPDATE',
  );
  const [[counter]] = await conn.query(
    'SELECT highWaterMark FROM order_counter WHERE id = 1 FOR UPDATE',
  );
  const floor = Math.max(Number(row?.maxId) || 0, Number(counter?.highWaterMark) || 0);
  const next = floor + 1;
  return next < ORDER_ID_START ? ORDER_ID_START : next;
}

/**
 * POST /api/purchases  (public)
 * Reserve `quantity` spots on a stage and open a pending_payment purchase.
 * Idempotent on idempotencyKey: a retry with the same key returns the
 * original purchase instead of double-reserving.
 */
export const createPurchase = async (req, res) => {
  const { eventId, stageId, quantity, deliveryMethod, deliveryContact, holders, idempotencyKey } = req.body;

  // At reservation time the buyer has only chosen quantity + stage; the
  // delivery method/contact and holder names are collected later and filled
  // in by submitPayment. Only the stage + qty are required here.
  if (!eventId || !stageId || !quantity) {
    return res.status(400).json({ message: 'Faltan campos obligatorios de la compra' });
  }
  const qty = Number(quantity);
  if (!Number.isInteger(qty) || qty < 1 || qty > MAX_TICKETS_PER_PURCHASE) {
    return res.status(400).json({ message: `Cantidad inválida (1–${MAX_TICKETS_PER_PURCHASE})` });
  }
  // Defaults for the deferred fields: method = whatsapp (the dominant flow),
  // contact = empty string (NOT NULL constraint — replaced at submit time).
  const method = ['email', 'whatsapp'].includes(deliveryMethod) ? deliveryMethod : 'whatsapp';
  const contact = (deliveryContact || '').toString().slice(0, 160);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Idempotency: if this key already produced an order, return it.
    if (idempotencyKey) {
      const [[existing]] = await conn.query(
        'SELECT orderId FROM tickets WHERE idempotencyKey = ? LIMIT 1',
        [idempotencyKey],
      );
      if (existing) {
        await conn.commit();
        return res.json({ orderId: existing.orderId, idempotent: true });
      }
    }

    // 1. Lock the stage row. Other reservations on this stage wait here.
    const [[stage]] = await conn.query(
      "SELECT id, eventId, price, totalQuantity, soldQuantity, reservedQuantity " +
        "FROM ticket_stages WHERE id = ? AND status = 'active' FOR UPDATE",
      [stageId],
    );
    if (!stage) {
      await conn.rollback();
      return res.status(409).json({ message: 'La etapa no está disponible' });
    }

    // Multi-event gate: the demo event never sells for real — its wizard
    // simulates the flow locally, but the backend must refuse regardless of
    // what a client sends — and online sales are closed per-event via
    // salesOpen (replaces the retired global ONLINE_SALES_OPEN flag).
    const [[event]] = await conn.query('SELECT isDemo, salesOpen FROM events WHERE id = ?', [stage.eventId]);
    if (event?.isDemo) {
      await conn.rollback();
      return res.status(409).json({ message: 'El evento de demostración es de solo lectura' });
    }
    if (!event?.salesOpen) {
      await conn.rollback();
      return res.status(409).json({ message: 'Las ventas en línea están cerradas para este evento' });
    }

    // 2. Availability check (in the app, under the lock).
    const available = stage.totalQuantity - stage.soldQuantity - stage.reservedQuantity;
    if (available < qty) {
      await conn.rollback();
      return res.status(409).json({ message: 'Cupos insuficientes' });
    }

    // 3. Firm reservation.
    await conn.query(
      'UPDATE ticket_stages SET reservedQuantity = reservedQuantity + ? WHERE id = ?',
      [qty, stageId],
    );
    // Mark sold_out if no spots remain after this reservation.
    const [fillResult] = await conn.query(
      'UPDATE ticket_stages SET status = ? WHERE id = ? AND status = ? AND soldQuantity + reservedQuantity >= totalQuantity',
      ['sold_out', stageId, 'active'],
    );

    // Cascade: if this stage just sold out and the next upcoming stage on the
    // same event has no activatesAt (i.e. it will never auto-activate via the
    // scheduler), promote it to active so buyers can continue purchasing.
    if (fillResult.affectedRows > 0) {
      const [promo] = await conn.query(
        `UPDATE ticket_stages SET status = 'active'
          WHERE eventId = ? AND status = 'upcoming' AND activatesAt IS NULL
          ORDER BY sortOrder ASC LIMIT 1`,
        [stage.eventId],
      );
      // A successor took the active slot — the just-filled stage is now
      // permanently superseded. Close it instead of leaving it 'sold_out', so
      // no later reservation-release (reject/expire/delete) ever reopens it,
      // which would collide with the new active stage under
      // uqOneActiveStagePerEvent. See "sold_out vs closed" in CLAUDE.md.
      if (promo.affectedRows > 0) {
        await conn.query(
          "UPDATE ticket_stages SET status = 'closed' WHERE id = ? AND status = 'sold_out'",
          [stageId],
        );
      }
    }

    const totalAmount = Number(stage.price) * qty;
    const reservationExpiresAt = toSqlUtc(new Date(Date.now() + RESERVATION_HOLD_MS).toISOString());

    // 4. Insert one row per seat with a sequential orderId shared by all of
    //    them. Retry once or twice if a concurrent insert wins the same
    //    number (the uqOrderAnchor/uqTicketIdem UNIQUE indexes catch it) —
    //    extremely rare given the FOR UPDATE lock on the stage row.
    let orderId = null;
    let lastErr = null;
    for (let i = 0; i < ORDER_ID_RETRIES; i++) {
      const candidate = await nextOrderId(conn);
      // Holder names/ids/phones are usually unknown at this point (the buyer
      // fills them in later via submitPayment); leave NULL when absent.
      const rows = Array.from({ length: qty }, (_, j) => {
        const h = Array.isArray(holders) ? holders[j] : null;
        return [
          candidate,
          j === 0 ? candidate : null, // orderAnchor — anchors the collision guard to row 0 only
          stage.eventId,
          stageId,
          stage.price,
          h?.name || null,
          h?.idNumber || null,
          h?.phone || null,
          method,
          contact,
          'pending_payment',
          j === 0 ? (idempotencyKey || null) : null, // idempotencyKey — row 0 only
          reservationExpiresAt,
        ];
      });
      try {
        await conn.query(
          `INSERT INTO tickets
             (orderId, orderAnchor, eventId, stageId, unitPrice, holderName, holderIdNumber, holderPhone,
              deliveryMethod, deliveryContact, status, idempotencyKey, reservationExpiresAt)
           VALUES ?`,
          [rows],
        );
        orderId = candidate;
        break;
      } catch (err) {
        if (err.code === 'ER_DUP_ENTRY' && /uqTicketIdem/.test(err.sqlMessage || '')) {
          const [[existing]] = await conn.query(
            'SELECT orderId FROM tickets WHERE idempotencyKey = ? LIMIT 1',
            [idempotencyKey],
          );
          await conn.commit();
          return res.json({ orderId: existing?.orderId, idempotent: true });
        }
        if (err.code === 'ER_DUP_ENTRY') { lastErr = err; continue; }
        throw err;
      }
    }
    if (!orderId) {
      await conn.rollback();
      throw lastErr || new Error('No se pudo asignar un número de orden');
    }

    await conn.commit();
    res.status(201).json({ orderId, totalAmount });
  } catch (error) {
    await conn.rollback();
    sendErrorEmail(req, error, 'createPurchase');
    return res.status(500).json({ message: error.message, sqlMessage: error.sqlMessage });
  } finally {
    conn.release();
  }
};

/**
 * POST /api/purchases/:orderId/submitted  (public)
 * Buyer tapped "Ya realicé el pago" → pending_payment -> payment_submitted.
 *
 * Accepts an optional body { deliveryMethod, deliveryContact, holders } so the
 * buyer's real contact info + holder names — captured AFTER the initial hold
 * was placed — are stored before the organizer sees the order.
 */
export const submitPayment = async (req, res) => {
  const { deliveryMethod, deliveryContact, holders } = req.body || {};
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Lock every row of the order (one per seat) — not a single surrogate row.
    const [rows] = await conn.query(
      'SELECT id, status FROM tickets WHERE orderId = ? ORDER BY id ASC FOR UPDATE',
      [req.params.orderId],
    );
    if (rows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'Orden no encontrada' });
    }
    const status = rows[0].status;

    // Applies holder names/ids/phones positionally: holders[i] -> the i-th
    // row of this order (rows are already ORDER BY id ASC, i.e. insertion order).
    const patchHolders = async () => {
      if (!Array.isArray(holders) || holders.length === 0) return;
      for (let i = 0; i < Math.min(holders.length, rows.length); i++) {
        const h = holders[i] || {};
        await conn.query(
          'UPDATE tickets SET holderName = ?, holderIdNumber = ?, holderPhone = ? WHERE id = ?',
          [h.name || null, h.idNumber || null, h.phone || null, rows[i].id],
        );
      }
    };

    if (status === 'payment_submitted') {
      // Allow the contact info to be patched even when already submitted, so
      // a retry from the client never loses the data the buyer just typed.
      const updates = [];
      const params = [];
      if (deliveryMethod && ['email', 'whatsapp'].includes(deliveryMethod)) {
        updates.push('deliveryMethod = ?');
        params.push(deliveryMethod);
      }
      if (deliveryContact) {
        updates.push('deliveryContact = ?');
        params.push(String(deliveryContact).slice(0, 160));
      }
      if (updates.length) {
        await conn.query(
          `UPDATE tickets SET ${updates.join(', ')} WHERE orderId = ?`,
          [...params, req.params.orderId],
        );
      }
      await patchHolders();
      await conn.commit();
      return res.json({ orderId: req.params.orderId, status: 'payment_submitted' });
    }
    if (status !== 'pending_payment') {
      await conn.rollback();
      return res.status(409).json({ message: `La orden está en estado '${status}'` });
    }

    // Patch the contact + holders alongside the status transition, in one
    // statement so every row of the order moves together.
    const updates = ["status = 'payment_submitted'"];
    const params = [];
    if (deliveryMethod && ['email', 'whatsapp'].includes(deliveryMethod)) {
      updates.push('deliveryMethod = ?');
      params.push(deliveryMethod);
    }
    if (deliveryContact) {
      updates.push('deliveryContact = ?');
      params.push(String(deliveryContact).slice(0, 160));
    }
    await conn.query(
      `UPDATE tickets SET ${updates.join(', ')} WHERE orderId = ?`,
      [...params, req.params.orderId],
    );
    await patchHolders();
    await conn.commit();
    res.json({ orderId: req.params.orderId, status: 'payment_submitted' });
  } catch (error) {
    await conn.rollback();
    sendErrorEmail(req, error, 'submitPayment');
    return res.status(500).json({ message: error.message });
  } finally {
    conn.release();
  }
};

// Exported for the walk-in / admin controller so the same sequence is used.
export { nextOrderId };
