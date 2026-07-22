/*
 * ============================================================
 * SÍGALE — ADMIN CONTROLLER (organizer panel)
 * Login + the purchase-review loop. Inventory transitions use
 * getConnection() + FOR UPDATE (ADR §6). validationHash is a
 * server-generated DETERMINISTIC HMAC over (orderId, seatIndex)
 * keyed by SCAN_HASH_SECRET, minted only at confirm; the QR is
 * built client-side from it and never stored.
 *
 * All handlers except `login` sit behind requireOrganizer.
 * ============================================================
 */

import crypto from 'node:crypto';
import pool from '../db.js';
import { sendErrorEmail } from '../utils/emailNotifier.js';
import { verifyOrganizer } from '../middleware/requireOrganizer.js';
import { BOGOTA, UTC, toSqlUtc } from '../utils/time.js';
import { nextOrderId } from './purchases.controllers.js';

/**
 * Deterministic entry secret for a ticket. Keyed by (orderId, seatIndex) so it
 * is unique per seat (satisfies uqTicketHash) and stable across holder edits,
 * yet unguessable without SCAN_HASH_SECRET — the door-scan security invariant
 * (only confirmed tickets, whose hash nobody can forge, ever scan in). 16 hex
 * chars keeps the QR small; column is CHAR(64) so it fits with room to spare.
 */
const HASH_SECRET =
  process.env.SCAN_HASH_SECRET || 'sigale-dev-scan-secret-change-me';
const validationHashFor = (orderId, seatIndex) =>
  crypto
    .createHmac('sha256', HASH_SECRET)
    .update(`${orderId}:${seatIndex}`)
    .digest('hex')
    .slice(0, 16);

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
 * Review table with optional status filter and orderId search. Since an
 * order is now N rows (one per seat) sharing one orderId, this is a
 * GROUP BY aggregate: quantity = row count, totalAmount = SUM(unitPrice).
 * The order-level columns (status/delivery/createdAt/stage) are invariant
 * across every row of the order, so ANY_VALUE() is correct (not an
 * arbitrary pick — there is only ever one distinct value per group).
 */
export const getAdminPurchases = async (req, res) => {
  try {
    const { status, orderId } = req.query;
    const where = [];
    const params = [];
    if (status) { where.push('t.status = ?'); params.push(status); }
    if (orderId) { where.push('t.orderId = ?'); params.push(orderId); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [rows] = await pool.query(
      `SELECT t.orderId,
              COUNT(*) AS quantity,
              SUM(t.unitPrice) AS totalAmount,
              ANY_VALUE(t.status) AS status,
              ANY_VALUE(t.deliveryMethod) AS deliveryMethod,
              ANY_VALUE(t.deliveryContact) AS deliveryContact,
              CONVERT_TZ(ANY_VALUE(t.createdAt), '${UTC}', '${BOGOTA}') AS createdAt,
              ANY_VALUE(s.name) AS stageName
       FROM tickets t
       JOIN ticket_stages s ON s.id = t.stageId
       ${whereSql}
       GROUP BY t.orderId
       ORDER BY MAX(t.createdAt) DESC LIMIT 500`,
      params,
    );

    if (rows.length === 0) {
      return res.json([]);
    }

    // Second pass: per-row holder data for the orders above, assembled into
    // a `holders[]` array per order (ORDER BY id ASC = insertion order).
    const orderIds = rows.map((r) => r.orderId);
    const placeholders = orderIds.map(() => '?').join(',');
    const [holderRows] = await pool.query(
      `SELECT orderId, holderName, holderIdNumber, holderPhone
       FROM tickets WHERE orderId IN (${placeholders}) ORDER BY id ASC`,
      orderIds,
    );
    const holdersByOrder = {};
    for (const h of holderRows) {
      if (!holdersByOrder[h.orderId]) holdersByOrder[h.orderId] = [];
      holdersByOrder[h.orderId].push({
        name: h.holderName,
        idNumber: h.holderIdNumber,
        phone: h.holderPhone,
      });
    }

    const out = rows.map((r) => ({ ...r, holders: holdersByOrder[r.orderId] || [] }));
    res.json(out);
  } catch (error) {
    sendErrorEmail(req, error, 'getAdminPurchases');
    return res.status(500).json({ message: error.message });
  }
};

/**
 * GET /api/admin/tickets?status=  (organizer)
 * Every ticket row, joined with its stage, so the /tickets page can
 * display, edit, and generate QRs without a second fetch.
 *
 * `status` defaults to 'confirmed' when omitted — load-bearing: it's what
 * keeps DashboardPage (which calls this with no params) from silently
 * ingesting pending/rejected/expired rows into its stats. Pass a
 * comma-separated list, or the literal 'all', to see a wider set (this is
 * what closes the old "rejected/pending orders are invisible outside
 * /admin" gap — TicketsPage's status filter uses this).
 *
 * NOTE: this is read-only and intentionally returns the validationHash —
 * the QR is generated client-side from it. Stays behind requireOrganizer
 * because the hash is the door-scan secret. validationHash is NULL for
 * every non-confirmed row (minted only at confirm), so no QR is possible
 * for those anyway.
 */
export const getAdminTickets = async (req, res) => {
  try {
    const { status } = req.query;
    let whereSql = '';
    let params = [];
    if (!status) {
      whereSql = 'WHERE t.status = ?';
      params = ['confirmed'];
    } else if (status !== 'all') {
      const statuses = String(status).split(',').map((s) => s.trim()).filter(Boolean);
      whereSql = `WHERE t.status IN (${statuses.map(() => '?').join(',')})`;
      params = statuses;
    }

    const [rows] = await pool.query(
      `SELECT t.id, t.orderId, t.holderName, t.holderIdNumber, t.holderPhone,
              t.validationHash, t.isUsed,
              CONVERT_TZ(t.usedAt, '${UTC}', '${BOGOTA}') AS usedAt,
              t.status, t.deliveryMethod, t.deliveryContact, t.unitPrice,
              CONVERT_TZ(t.createdAt, '${UTC}', '${BOGOTA}') AS createdAt,
              s.name AS stageName
       FROM tickets t
       JOIN ticket_stages s ON s.id = t.stageId
       ${whereSql}
       ORDER BY t.createdAt DESC, t.id ASC
       LIMIT 5000`,
      params,
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
 * POST /api/admin/purchases/:orderId/confirm  (organizer)
 * reserved -> sold, seal confirmedAt/confirmedBy on every row of the order,
 * mint a validationHash per row. Guards against an already rejected/expired
 * order. This is the "order converts into a ticket" moment — rows already
 * existed (created at reservation time); confirm transitions them in place
 * rather than spawning new ones.
 */
export const confirmPurchase = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      'SELECT id, stageId, status, holderName, holderIdNumber, holderPhone FROM tickets WHERE orderId = ? ORDER BY id ASC FOR UPDATE',
      [req.params.orderId],
    );
    if (rows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'Orden no encontrada' });
    }
    const status = rows[0].status;
    if (status === 'confirmed') {
      await conn.rollback();
      return res.status(409).json({ message: 'La orden ya está confirmada' });
    }
    if (status === 'rejected' || status === 'expired') {
      await conn.rollback();
      return res.status(409).json({ message: `No se puede confirmar una orden '${status}'` });
    }
    const qty = rows.length;
    const stageId = rows[0].stageId;

    // reserved -> sold on the stage.
    await conn.query(
      'UPDATE ticket_stages SET reservedQuantity = reservedQuantity - ?, soldQuantity = soldQuantity + ? WHERE id = ?',
      [qty, qty, stageId],
    );

    // Seal every row of the order in one shot.
    await conn.query(
      "UPDATE tickets SET status = 'confirmed', confirmedAt = UTC_TIMESTAMP(), confirmedBy = ? WHERE orderId = ?",
      [req.organizer?.username || 'organizer', req.params.orderId],
    );

    // Resolve holder data per row: prefer an admin override sent in the
    // request body, else whatever submitPayment already persisted on the
    // row itself, else a placeholder. Mint the validationHash per row — this is
    // the only place a hash is ever written (never before confirm). Keyed by
    // (orderId, seatIndex) so it is deterministic and stable, not random.
    const overrides = Array.isArray(req.body?.holders) ? req.body.holders : null;
    for (let i = 0; i < rows.length; i++) {
      const o = overrides?.[i];
      const holderName = o?.name || rows[i].holderName || `Boleta ${i + 1}`;
      const holderIdNumber = o?.idNumber || rows[i].holderIdNumber || null;
      const holderPhone = o?.phone || rows[i].holderPhone || null;
      await conn.query(
        'UPDATE tickets SET holderName = ?, holderIdNumber = ?, holderPhone = ?, validationHash = ? WHERE id = ?',
        [holderName, holderIdNumber, holderPhone, validationHashFor(req.params.orderId, i), rows[i].id],
      );
    }

    await conn.commit();
    res.json({ orderId: Number(req.params.orderId), status: 'confirmed', minted: qty });
  } catch (error) {
    await conn.rollback();
    sendErrorEmail(req, error, 'confirmPurchase');
    return res.status(500).json({ message: error.message, sqlMessage: error.sqlMessage });
  } finally {
    conn.release();
  }
};

/**
 * POST /api/admin/purchases/:orderId/reject  (organizer)
 * Frees the reserved cupo and flips every row of the order to 'rejected'.
 * Cannot reject an already confirmed order.
 */
export const rejectPurchase = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      'SELECT id, stageId, status FROM tickets WHERE orderId = ? FOR UPDATE',
      [req.params.orderId],
    );
    if (rows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'Orden no encontrada' });
    }
    const status = rows[0].status;
    if (status === 'confirmed') {
      await conn.rollback();
      return res.status(409).json({ message: 'No se puede rechazar una orden confirmada' });
    }
    if (status === 'rejected') {
      await conn.commit();
      return res.json({ orderId: Number(req.params.orderId), status: 'rejected' });
    }
    // 'expired' orders had their reservedQuantity decremented by sweepExpiredHolds.
    // Attempting the decrement again would cause GREATEST(0 - N, 0) unsigned underflow
    // → CHECK constraint violation. Treat as idempotent: nothing left to release.
    if (status === 'expired') {
      await conn.commit();
      return res.json({ orderId: Number(req.params.orderId), status: 'expired' });
    }
    const qty = rows.length;
    const stageId = rows[0].stageId;

    // Release the held cupo back to the stage.
    await conn.query(
      'UPDATE ticket_stages SET reservedQuantity = GREATEST(reservedQuantity - ?, 0) WHERE id = ?',
      [qty, stageId],
    );
    // Restore to active if the released spot opens availability.
    await conn.query(
      'UPDATE ticket_stages SET status = ? WHERE id = ? AND status = ? AND soldQuantity + reservedQuantity < totalQuantity',
      ['active', stageId, 'sold_out'],
    );
    await conn.query("UPDATE tickets SET status = 'rejected' WHERE orderId = ?", [req.params.orderId]);

    await conn.commit();
    res.json({ orderId: Number(req.params.orderId), status: 'rejected' });
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

    // Only an `active` stage may be sold from — mirrors the public
    // createPurchase guard. A closed/sold_out/upcoming stage (e.g. a
    // superseded earlier etapa) must never take a walk-in sale, or the door
    // could keep selling a stage the sale has already moved past.
    const [[stage]] = await conn.query(
      "SELECT id, eventId, price, totalQuantity, soldQuantity, reservedQuantity " +
        "FROM ticket_stages WHERE id = ? AND status = 'active' FOR UPDATE",
      [stageId],
    );
    if (!stage) {
      await conn.rollback();
      return res.status(409).json({ message: 'La etapa seleccionada no está disponible para venta' });
    }
    const available = stage.totalQuantity - stage.soldQuantity - stage.reservedQuantity;
    if (available < qty) {
      await conn.rollback();
      return res.status(409).json({ message: 'Cupos insuficientes' });
    }

    await conn.query('UPDATE ticket_stages SET soldQuantity = soldQuantity + ? WHERE id = ?', [qty, stageId]);
    // Mark sold_out if walk-in filled the last spot.
    const [fillResult] = await conn.query(
      'UPDATE ticket_stages SET status = ? WHERE id = ? AND status = ? AND soldQuantity + reservedQuantity >= totalQuantity',
      ['sold_out', stageId, 'active'],
    );

    // Cascade: if this stage just sold out, activate the next upcoming stage
    // that has no activatesAt (scheduler-exempt stages need explicit promotion).
    if (fillResult.affectedRows > 0) {
      const [promo] = await conn.query(
        `UPDATE ticket_stages SET status = 'active'
          WHERE eventId = ? AND status = 'upcoming' AND activatesAt IS NULL
          ORDER BY sortOrder ASC LIMIT 1`,
        [eventId],
      );
      // A successor took the active slot — the just-filled stage is now
      // permanently superseded. Close it instead of leaving it 'sold_out',
      // so no later reservation-release ever reopens it (that would collide
      // with the new active stage under uqOneActiveStagePerEvent). See the
      // "sold_out vs closed" invariant in CLAUDE.md.
      if (promo.affectedRows > 0) {
        await conn.query(
          "UPDATE ticket_stages SET status = 'closed' WHERE id = ? AND status = 'sold_out'",
          [stageId],
        );
      }
    }

    // Sequential orderId (shared sequence with public purchases), retry on collision.
    // Walk-ins skip the reservation phase entirely: rows are inserted directly
    // 'confirmed' with a validationHash already minted (all holder data is
    // known upfront), unlike the public flow's pending_payment rows.
    const list = Array.isArray(holders) ? holders : [];
    const confirmedAt = toSqlUtc(new Date().toISOString());
    const confirmedBy = req.organizer?.username || 'organizer';
    let orderId = null;
    let mintedTickets = [];
    for (let i = 0; i < 25; i++) {
      const candidate = await nextOrderId(conn);
      const rows = Array.from({ length: qty }, (_, j) => {
        const h = list[j] || {};
        return {
          holderName: h.name || `Taquilla ${j + 1}`,
          holderIdNumber: h.idNumber || null,
          holderPhone: h.phone || null,
          validationHash: validationHashFor(candidate, j),
        };
      });
      const values = rows.map((r, j) => [
        candidate,
        j === 0 ? candidate : null, // orderAnchor
        eventId,
        stageId,
        stage.price,
        r.holderName,
        r.holderIdNumber,
        r.holderPhone,
        'whatsapp',
        'taquilla',
        'confirmed',
        r.validationHash,
        confirmedAt,
        confirmedBy,
      ]);
      try {
        const [result] = await conn.query(
          `INSERT INTO tickets
             (orderId, orderAnchor, eventId, stageId, unitPrice, holderName, holderIdNumber, holderPhone,
              deliveryMethod, deliveryContact, status, validationHash, confirmedAt, confirmedBy)
           VALUES ?`,
          [values],
        );
        orderId = candidate;
        // Simple multi-row inserts (row count known up front) get a
        // contiguous auto_increment block, so row j's id is insertId + j.
        mintedTickets = rows.map((r, j) => ({
          id: result.insertId + j,
          holderName: r.holderName,
          holderIdNumber: r.holderIdNumber,
          holderPhone: r.holderPhone,
          validationHash: r.validationHash,
        }));
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
 * Hard-reset: delete ALL orders regardless of status, and restore stage
 * inventory (sold + reserved). Intended for dev resets and post-event
 * cleanup — not reversible. Stays behind requireOrganizer.
 */
export const deleteAllPurchases = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Every ticket row — every status — with stageId to restore inventory.
    const [rows] = await conn.query('SELECT stageId, status FROM tickets');

    if (rows.length === 0) {
      await conn.commit();
      return res.json({ ok: true, deleted: 0 });
    }

    // Restore soldQuantity (confirmed) and reservedQuantity (pending/submitted) per stage.
    // IMPORTANT: 'rejected' and 'expired' rows have already had their
    // reservedQuantity decremented (by rejectPurchase / sweepExpiredHolds).
    // Including them here would cause unsigned underflow on the INT UNSIGNED column
    // (GREATEST(0 - N, 0) wraps to ~4B), triggering the chkStageCapacity CHECK.
    const stageSold = {};
    const stageReserved = {};
    for (const r of rows) {
      if (r.status === 'confirmed') {
        stageSold[r.stageId] = (stageSold[r.stageId] || 0) + 1;
      } else if (r.status === 'pending_payment' || r.status === 'payment_submitted') {
        stageReserved[r.stageId] = (stageReserved[r.stageId] || 0) + 1;
      }
      // 'rejected' and 'expired': inventory already released — nothing to restore.
    }
    for (const [stageId, qty] of Object.entries(stageSold)) {
      await conn.query(
        'UPDATE ticket_stages SET soldQuantity = GREATEST(soldQuantity - ?, 0) WHERE id = ?',
        [qty, stageId],
      );
    }
    for (const [stageId, qty] of Object.entries(stageReserved)) {
      await conn.query(
        'UPDATE ticket_stages SET reservedQuantity = GREATEST(reservedQuantity - ?, 0) WHERE id = ?',
        [qty, stageId],
      );
    }

    // Delete every row — this endpoint already means "delete everything".
    await conn.query('DELETE FROM tickets');

    // Reopen any stage whose inventory was fully cleared by this reset.
    await conn.query(
      'UPDATE ticket_stages SET status = ? WHERE status = ? AND soldQuantity + reservedQuantity < totalQuantity',
      ['active', 'sold_out'],
    );

    await conn.commit();
    res.json({ ok: true, deleted: rows.length });
  } catch (error) {
    await conn.rollback();
    sendErrorEmail(req, error, 'deleteAllPurchases');
    return res.status(500).json({ message: error.message });
  } finally {
    conn.release();
  }
};

/**
 * DELETE /api/admin/tickets/:id  (organizer)
 * Remove a single confirmed ticket and restore 1 unit of sold inventory on
 * its stage. Used by the /tickets page trash button.
 *
 * Guard (new since the merge): rows can now exist pre-confirm too, but
 * deleting one seat out of a still-open pending/submitted order has no
 * designed inventory-adjustment path and no product need — reject with 409.
 */
export const deleteAdminTicket = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // FOR UPDATE locks the ticket row so concurrent deletes of the same ticket
    // cannot both decrement soldQuantity (double-decrement bug).
    const [[ticket]] = await conn.query(
      'SELECT id, stageId, status FROM tickets WHERE id = ? FOR UPDATE',
      [req.params.id],
    );
    if (!ticket) {
      await conn.rollback();
      return res.status(404).json({ message: 'Boleta no encontrada' });
    }
    if (ticket.status !== 'confirmed') {
      await conn.rollback();
      return res.status(409).json({ message: `No se puede eliminar una boleta en estado '${ticket.status}'` });
    }

    await conn.query('DELETE FROM tickets WHERE id = ?', [req.params.id]);

    // Restore one sold unit.
    await conn.query(
      'UPDATE ticket_stages SET soldQuantity = GREATEST(soldQuantity - 1, 0) WHERE id = ?',
      [ticket.stageId],
    );
    // Reopen the stage if this deletion freed the last needed spot.
    await conn.query(
      'UPDATE ticket_stages SET status = ? WHERE id = ? AND status = ? AND soldQuantity + reservedQuantity < totalQuantity',
      ['active', ticket.stageId, 'sold_out'],
    );

    await conn.commit();
    res.json({ ok: true });
  } catch (error) {
    await conn.rollback();
    sendErrorEmail(req, error, 'deleteAdminTicket');
    return res.status(500).json({ message: error.message });
  } finally {
    conn.release();
  }
};
