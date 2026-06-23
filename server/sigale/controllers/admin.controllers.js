/*
 * ============================================================
 * SÍGALE — ADMIN CONTROLLER (organizer panel)
 * Login + the purchase-review loop. Inventory transitions use
 * getConnection() + FOR UPDATE (ADR §6). validationHash is a
 * server-generated RANDOM secret (decision #3), minted only at
 * confirm; the QR is built client-side and never stored.
 *
 * All handlers except `login` sit behind requireOrganizer.
 * ============================================================
 */

import crypto from 'node:crypto';
import pool from '../db.js';
import { sendErrorEmail } from '../utils/emailNotifier.js';
import { verifyOrganizer } from '../middleware/requireOrganizer.js';
import { BOGOTA, UTC } from '../utils/time.js';
import { nextOrderId } from './purchases.controllers.js';

/** 128-bit random entry secret -> 32 hex chars (CHAR(64) reserved). */
const randomValidationHash = () => crypto.randomBytes(16).toString('hex');

/**
 * POST /api/login  (public, rate-limited at the route)
 * Validates username + bcrypt password via the shared verifyOrganizer
 * (constant-time against username enumeration, plan §6). Returns ok only
 * (no token): the client re-sends Basic creds on each /api/admin/* call.
 */
export const login = async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ message: 'Usuario y contraseña requeridos' });
    }
    const organizer = await verifyOrganizer(username, password);
    if (!organizer) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }
    res.json({ ok: true, username: organizer.username });
  } catch (error) {
    sendErrorEmail(req, error, 'login');
    return res.status(500).json({ message: error.message });
  }
};

/**
 * GET /api/admin/purchases?status=&orderId=  (organizer)
 * Review table with optional status filter and orderId search.
 */
export const getAdminPurchases = async (req, res) => {
  try {
    const { status, orderId } = req.query;
    const where = [];
    const params = [];
    if (status) { where.push('p.status = ?'); params.push(status); }
    if (orderId) { where.push('p.orderId = ?'); params.push(orderId); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [rows] = await pool.query(
      `SELECT p.id, p.orderId, p.quantity, p.totalAmount, p.status, p.deliveryMethod, p.deliveryContact,
              p.holdersSnapshot,
              CONVERT_TZ(p.createdAt, '${UTC}', '${BOGOTA}') AS createdAt,
              s.name AS stageName
       FROM purchases p
       JOIN ticket_stages s ON s.id = p.stageId
       ${whereSql}
       ORDER BY p.createdAt DESC LIMIT 500`,
      params,
    );
    // Parse the JSON holders column once on the way out so the client gets
    // a real array (mysql2 sometimes hands JSON columns back as strings).
    const out = rows.map((r) => {
      let holders = r.holdersSnapshot;
      if (typeof holders === 'string') {
        try { holders = JSON.parse(holders); } catch { holders = []; }
      }
      return { ...r, holders: Array.isArray(holders) ? holders : [] };
    });
    res.json(out);
  } catch (error) {
    sendErrorEmail(req, error, 'getAdminPurchases');
    return res.status(500).json({ message: error.message });
  }
};

/**
 * GET /api/admin/tickets  (organizer)
 * Every minted ticket from a confirmed purchase, joined with its stage + the
 * order so the /tickets page can display, edit, and generate QRs without
 * having to chase the purchase row separately.
 *
 * NOTE: this is read-only and intentionally returns the validationHash —
 * the QR is generated client-side from it. Stays behind requireOrganizer
 * because the hash is the door-scan secret.
 */
export const getAdminTickets = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT t.id, t.purchaseId, t.holderName, t.holderIdNumber, t.holderPhone,
              t.validationHash, t.isUsed,
              CONVERT_TZ(t.usedAt, '${UTC}', '${BOGOTA}') AS usedAt,
              p.orderId, p.deliveryMethod, p.deliveryContact, p.totalAmount,
              p.quantity AS purchaseQuantity,
              CONVERT_TZ(p.createdAt, '${UTC}', '${BOGOTA}') AS purchaseCreatedAt,
              s.name AS stageName, s.price AS stagePrice,
              e.id AS eventId, e.name AS eventName
       FROM tickets t
       JOIN purchases p ON p.id = t.purchaseId
       JOIN ticket_stages s ON s.id = p.stageId
       JOIN events e ON e.id = p.eventId
       WHERE p.status = 'confirmed'
       ORDER BY p.createdAt DESC, t.id ASC
       LIMIT 5000`,
    );
    res.json(rows);
  } catch (error) {
    sendErrorEmail(req, error, 'getAdminTickets');
    return res.status(500).json({ message: error.message });
  }
};

/**
 * PATCH /api/admin/tickets/:id  (organizer)
 * Edit the holder data on a minted ticket. The validationHash is intentionally
 * NOT mutable — once a ticket is minted its scannable secret is fixed.
 */
export const updateAdminTicket = async (req, res) => {
  try {
    const { holderName, holderIdNumber, holderPhone } = req.body || {};
    const updates = [];
    const params = [];
    if (holderName !== undefined) {
      updates.push('holderName = ?');
      params.push(String(holderName).slice(0, 160));
    }
    if (holderIdNumber !== undefined) {
      updates.push('holderIdNumber = ?');
      params.push(holderIdNumber ? String(holderIdNumber).slice(0, 40) : null);
    }
    if (holderPhone !== undefined) {
      updates.push('holderPhone = ?');
      params.push(holderPhone ? String(holderPhone).slice(0, 20) : null);
    }
    if (updates.length === 0) {
      return res.status(400).json({ message: 'Nada que actualizar' });
    }
    params.push(req.params.id);
    const [result] = await pool.query(
      `UPDATE tickets SET ${updates.join(', ')} WHERE id = ?`,
      params,
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Boleta no encontrada' });
    }
    res.json({ ok: true });
  } catch (error) {
    sendErrorEmail(req, error, 'updateAdminTicket');
    return res.status(500).json({ message: error.message });
  }
};

/**
 * POST /api/admin/purchases/:id/confirm  (organizer)
 * reserved -> sold, seal confirmedAt/confirmedBy, mint N tickets with
 * random validationHash. Guards against an already rejected/expired row.
 */
export const confirmPurchase = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[purchase]] = await conn.query(
      'SELECT id, stageId, quantity, status, holdersSnapshot FROM purchases WHERE id = ? FOR UPDATE',
      [req.params.id],
    );
    if (!purchase) {
      await conn.rollback();
      return res.status(404).json({ message: 'Orden no encontrada' });
    }
    if (purchase.status === 'confirmed') {
      await conn.rollback();
      return res.status(409).json({ message: 'La orden ya está confirmada' });
    }
    if (purchase.status === 'rejected' || purchase.status === 'expired') {
      await conn.rollback();
      return res.status(409).json({ message: `No se puede confirmar una orden '${purchase.status}'` });
    }

    // reserved -> sold on the stage.
    await conn.query(
      'UPDATE ticket_stages SET reservedQuantity = reservedQuantity - ?, soldQuantity = soldQuantity + ? WHERE id = ?',
      [purchase.quantity, purchase.quantity, purchase.stageId],
    );

    // Seal the purchase.
    await conn.query(
      "UPDATE purchases SET status = 'confirmed', confirmedAt = UTC_TIMESTAMP(), confirmedBy = ? WHERE id = ?",
      [req.organizer?.username || 'organizer', purchase.id],
    );

    // Mint tickets (one per spot). Prefer holders sent in the request body
    // (admin override), then fall back to the purchase-time snapshot.
    let holders = Array.isArray(req.body?.holders) ? req.body.holders : null;
    if (!holders || holders.length === 0) {
      let snapshot = purchase.holdersSnapshot;
      if (typeof snapshot === 'string') {
        try { snapshot = JSON.parse(snapshot); } catch { snapshot = []; }
      }
      holders = Array.isArray(snapshot) ? snapshot : [];
    }
    for (let i = 0; i < purchase.quantity; i++) {
      const h = holders[i] || {};
      await conn.query(
        `INSERT INTO tickets (purchaseId, holderName, holderIdNumber, holderPhone, validationHash, isUsed)
         VALUES (?, ?, ?, ?, ?, 0)`,
        [purchase.id, h.name || `Boleta ${i + 1}`, h.idNumber || null, h.phone || null, randomValidationHash()],
      );
    }

    await conn.commit();
    res.json({ id: purchase.id, status: 'confirmed', minted: purchase.quantity });
  } catch (error) {
    await conn.rollback();
    sendErrorEmail(req, error, 'confirmPurchase');
    return res.status(500).json({ message: error.message, sqlMessage: error.sqlMessage });
  } finally {
    conn.release();
  }
};

/**
 * POST /api/admin/purchases/:id/reject  (organizer)
 * Frees the reserved cupo. Not destructive of any minted tickets (there are
 * none before confirm). Cannot reject an already confirmed purchase.
 */
export const rejectPurchase = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[purchase]] = await conn.query(
      'SELECT id, stageId, quantity, status FROM purchases WHERE id = ? FOR UPDATE',
      [req.params.id],
    );
    if (!purchase) {
      await conn.rollback();
      return res.status(404).json({ message: 'Orden no encontrada' });
    }
    if (purchase.status === 'confirmed') {
      await conn.rollback();
      return res.status(409).json({ message: 'No se puede rechazar una orden confirmada' });
    }
    if (purchase.status === 'rejected') {
      await conn.commit();
      return res.json({ id: purchase.id, status: 'rejected' });
    }

    // Release the held cupo back to the stage.
    await conn.query(
      'UPDATE ticket_stages SET reservedQuantity = GREATEST(reservedQuantity - ?, 0) WHERE id = ?',
      [purchase.quantity, purchase.stageId],
    );
    await conn.query("UPDATE purchases SET status = 'rejected' WHERE id = ?", [purchase.id]);

    await conn.commit();
    res.json({ id: purchase.id, status: 'rejected' });
  } catch (error) {
    await conn.rollback();
    sendErrorEmail(req, error, 'rejectPurchase');
    return res.status(500).json({ message: error.message });
  } finally {
    conn.release();
  }
};

/**
 * POST /api/admin/sales  (organizer)
 * Walk-in / door sale: draws stage inventory directly and confirms in one
 * step (reserved is skipped — soldQuantity += qty under the lock).
 */
export const createWalkInSale = async (req, res) => {
  const { eventId, stageId, quantity, holders } = req.body || {};
  const qty = Number(quantity);
  if (!eventId || !stageId || !Number.isInteger(qty) || qty < 1) {
    return res.status(400).json({ message: 'Datos de venta inválidos' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[stage]] = await conn.query(
      'SELECT id, price, totalQuantity, soldQuantity, reservedQuantity FROM ticket_stages WHERE id = ? FOR UPDATE',
      [stageId],
    );
    if (!stage) {
      await conn.rollback();
      return res.status(404).json({ message: 'Etapa no encontrada' });
    }
    const available = stage.totalQuantity - stage.soldQuantity - stage.reservedQuantity;
    if (available < qty) {
      await conn.rollback();
      return res.status(409).json({ message: 'Cupos insuficientes' });
    }

    await conn.query('UPDATE ticket_stages SET soldQuantity = soldQuantity + ? WHERE id = ?', [qty, stageId]);

    // Sequential orderId (shared sequence with public purchases), retry on collision.
    const totalAmount = Number(stage.price) * qty;
    let orderId = null;
    let purchaseId = null;
    for (let i = 0; i < 25; i++) {
      const candidate = await nextOrderId(conn);
      try {
        const [r] = await conn.query(
          `INSERT INTO purchases
             (eventId, stageId, quantity, totalAmount, orderId, deliveryMethod, deliveryContact,
              status, reservationExpiresAt, confirmedAt, confirmedBy)
           VALUES (?, ?, ?, ?, ?, 'whatsapp', ?, 'confirmed', UTC_TIMESTAMP(), UTC_TIMESTAMP(), ?)`,
          [eventId, stageId, qty, totalAmount, candidate, 'taquilla', req.organizer?.username || 'organizer'],
        );
        orderId = candidate;
        purchaseId = r.insertId;
        break;
      } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') continue;
        throw err;
      }
    }
    if (!orderId) {
      await conn.rollback();
      return res.status(500).json({ message: 'No se pudo asignar número de orden' });
    }

    const list = Array.isArray(holders) ? holders : [];
    // Collect the minted rows (with their validationHash) so the seller's
    // screen can render the QR immediately, without a follow-up fetch.
    const mintedTickets = [];
    for (let i = 0; i < qty; i++) {
      const h = list[i] || {};
      const holderName = h.name || `Taquilla ${i + 1}`;
      const holderIdNumber = h.idNumber || null;
      const holderPhone = h.phone || null;
      const validationHash = randomValidationHash();
      const [tr] = await conn.query(
        `INSERT INTO tickets (purchaseId, holderName, holderIdNumber, holderPhone, validationHash, isUsed)
         VALUES (?, ?, ?, ?, ?, 0)`,
        [purchaseId, holderName, holderIdNumber, holderPhone, validationHash],
      );
      mintedTickets.push({ id: tr.insertId, holderName, holderIdNumber, holderPhone, validationHash });
    }

    await conn.commit();
    res.json({
      orderId,
      status: 'confirmed',
      minted: qty,
      tickets: mintedTickets,
    });
  } catch (error) {
    await conn.rollback();
    sendErrorEmail(req, error, 'createWalkInSale');
    return res.status(500).json({ message: error.message });
  } finally {
    conn.release();
  }
};

/**
 * DELETE /api/admin/purchases  (organizer)
 * Hard-reset: delete all confirmed purchases + their tickets for all events,
 * and restore soldQuantity on each affected stage. Intended for dev resets
 * and post-event cleanup — not reversible. Stays behind requireOrganizer.
 */
export const deleteAllPurchases = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Grab all confirmed purchases with stageId + quantity to restore inventory.
    const [purchases] = await conn.query(
      "SELECT id, stageId, quantity FROM purchases WHERE status = 'confirmed'",
    );

    if (purchases.length === 0) {
      await conn.commit();
      return res.json({ ok: true, deleted: 0 });
    }

    const ids = purchases.map((p) => p.id);
    const placeholders = ids.map(() => '?').join(',');

    // Delete child tickets first (FK: tickets.purchaseId -> purchases.id).
    await conn.query(`DELETE FROM tickets WHERE purchaseId IN (${placeholders})`, ids);

    // Restore soldQuantity per stage.
    const stageQty = {};
    for (const p of purchases) {
      stageQty[p.stageId] = (stageQty[p.stageId] || 0) + p.quantity;
    }
    for (const [stageId, qty] of Object.entries(stageQty)) {
      await conn.query(
        'UPDATE ticket_stages SET soldQuantity = GREATEST(soldQuantity - ?, 0) WHERE id = ?',
        [qty, stageId],
      );
    }

    // Now delete the purchases themselves.
    await conn.query(`DELETE FROM purchases WHERE id IN (${placeholders})`, ids);

    await conn.commit();
    res.json({ ok: true, deleted: purchases.length });
  } catch (error) {
    await conn.rollback();
    sendErrorEmail(req, error, 'deleteAllPurchases');
    return res.status(500).json({ message: error.message });
  } finally {
    conn.release();
  }
};
