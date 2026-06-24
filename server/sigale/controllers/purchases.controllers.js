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
 * Security (plan §6): explicit column lists on the public INSERT (no
 * `SET ?` mass-assignment — an attacker must not be able to force
 * status='confirmed'); parameterized everywhere; orderId is a
 * sequential INT starting at 100, globally unique across the table.
 *
 * Hold semantics (decision #4): reservationExpiresAt = createdAt + 24h
 * (real hold). The 20-minute countdown is frontend copy only.
 *
 * QR rule: validationHash/tickets are returned ONLY when status =
 * 'confirmed'. The QR is generated client-side and never stored.
 * ============================================================
 */

import pool from '../db.js';
import { sendErrorEmail } from '../utils/emailNotifier.js';

const MAX_TICKETS_PER_PURCHASE = 6;
const ORDER_ID_RETRIES = 25;
const ORDER_ID_START = 100; // first order in the system is #100

/**
 * Compute the next sequential orderId inside an open transaction.
 * Locks the table for read so concurrent inserts queue and never
 * collide on the same orderId. Falls back gracefully to ORDER_ID_START
 * when no purchases exist yet.
 */
async function nextOrderId(conn) {
  const [[row]] = await conn.query(
    'SELECT MAX(orderId) AS maxId FROM purchases FOR UPDATE',
  );
  const next = (Number(row?.maxId) || (ORDER_ID_START - 1)) + 1;
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

    // Idempotency: if this key already produced a purchase, return it.
    if (idempotencyKey) {
      const [[existing]] = await conn.query(
        'SELECT orderId FROM purchases WHERE idempotencyKey = ? LIMIT 1',
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
    await conn.query(
      'UPDATE ticket_stages SET status = ? WHERE id = ? AND status = ? AND soldQuantity + reservedQuantity >= totalQuantity',
      ['sold_out', stageId, 'active'],
    );

    const totalAmount = Number(stage.price) * qty;

    // 4. Insert the purchase with a sequential orderId. Retry once or twice
    //    if a concurrent insert wins the same number (the UNIQUE index
    //    catches it) — extremely rare given the FOR UPDATE lock.
    let orderId = null;
    let purchaseId = null;
    let lastErr = null;
    for (let i = 0; i < ORDER_ID_RETRIES; i++) {
      const candidate = await nextOrderId(conn);
      try {
        // holdersSnapshot is JSON NULL — feed mysql2 a stringified array (it
        // auto-casts the bound string to JSON), or NULL when no holders.
        const holdersJson = Array.isArray(holders) && holders.length
          ? JSON.stringify(holders)
          : null;
        const [result] = await conn.query(
          `INSERT INTO purchases
             (eventId, stageId, quantity, totalAmount, orderId, deliveryMethod, deliveryContact,
              holdersSnapshot, status, idempotencyKey, reservationExpiresAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending_payment', ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 24 HOUR))`,
          [eventId, stageId, qty, totalAmount, candidate, method, contact, holdersJson, idempotencyKey || null],
        );
        orderId = candidate;
        purchaseId = result.insertId;
        break;
      } catch (err) {
        if (err.code === 'ER_DUP_ENTRY' && /uqPurchaseIdem/.test(err.sqlMessage || '')) {
          const [[existing]] = await conn.query(
            'SELECT orderId FROM purchases WHERE idempotencyKey = ? LIMIT 1',
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

    // 5. Holders are stored in `purchases.holdersSnapshot` (migration 004)
    //    above as JSON. At confirm-time the admin can override them; if not
    //    overridden, confirmPurchase reads the snapshot and mints tickets
    //    with those names/IDs/phones.

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

    const [[purchase]] = await conn.query(
      'SELECT id, status FROM purchases WHERE orderId = ? ORDER BY createdAt DESC LIMIT 1 FOR UPDATE',
      [req.params.orderId],
    );
    if (!purchase) {
      await conn.rollback();
      return res.status(404).json({ message: 'Orden no encontrada' });
    }
    if (purchase.status === 'payment_submitted') {
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
      if (Array.isArray(holders) && holders.length) {
        updates.push('holdersSnapshot = ?');
        params.push(JSON.stringify(holders));
      }
      if (updates.length) {
        params.push(purchase.id);
        await conn.query(`UPDATE purchases SET ${updates.join(', ')} WHERE id = ?`, params);
      }
      await conn.commit();
      return res.json({ orderId: req.params.orderId, status: 'payment_submitted' });
    }
    if (purchase.status !== 'pending_payment') {
      await conn.rollback();
      return res.status(409).json({ message: `La orden está en estado '${purchase.status}'` });
    }

    // Patch the contact + holders alongside the status transition.
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
    if (Array.isArray(holders) && holders.length) {
      updates.push('holdersSnapshot = ?');
      params.push(JSON.stringify(holders));
    }
    params.push(purchase.id);
    await conn.query(`UPDATE purchases SET ${updates.join(', ')} WHERE id = ?`, params);
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
