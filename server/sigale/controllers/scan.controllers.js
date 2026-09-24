/*
 * ============================================================
 * SÍGALE — SCAN CONTROLLER (online door check-in)
 * Public, keyword-gated door scanning:
 *
 *   GET  /api/scan/events  — events open to public scan
 *   POST /api/scan         — { eventId, keyword, hash } -> mark used
 *
 * Every mark runs under SELECT … FOR UPDATE and is IDEMPOTENT:
 *   - unknown / unconfirmed hash  -> 'invalid'
 *   - hash of another event       -> 'wrong_event'
 *   - already used                -> 'already_used' (no-op)
 *   - fresh                       -> 'ok', usedAt stamped
 * The database is the single arbiter, so two devices scanning the
 * same ticket at once cannot both admit it.
 * ============================================================
 */

import pool from '../db.js';
import { sendErrorEmail } from '../utils/emailNotifier.js';
import { BOGOTA, UTC } from '../utils/time.js';

/**
 * Core mark-used routine. Runs in its own transaction with FOR UPDATE.
 *
 * @param {string} hash    16-hex validationHash from the QR.
 * @param {object} opts
 * @param {number|string} opts.eventId  The ticket must belong to this event —
 *                 a hash scanned under the wrong event's keyword never marks
 *                 entry.
 */
async function markUsed(hash, { eventId }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // validationHash is only ever populated at confirm time (NULL before),
    // so the status filter is defense-in-depth: it makes the "only
    // confirmed tickets scan" invariant explicit.
    const [[ticket]] = await conn.query(
      "SELECT id, eventId, holderName, isUsed, usedAt FROM tickets WHERE validationHash = ? AND status = 'confirmed' FOR UPDATE",
      [hash],
    );

    if (!ticket) {
      await conn.rollback();
      return { hash, result: 'invalid' };
    }
    if (Number(ticket.eventId) !== Number(eventId)) {
      await conn.rollback();
      return { hash, result: 'wrong_event' };
    }

    if (ticket.isUsed) {
      await conn.commit();
      return { hash, result: 'already_used', holderName: ticket.holderName, usedAt: ticket.usedAt };
    }

    await conn.query('UPDATE tickets SET isUsed = 1, usedAt = UTC_TIMESTAMP() WHERE id = ?', [ticket.id]);
    await conn.commit();
    return { hash, result: 'ok', holderName: ticket.holderName, usedAt: new Date().toISOString() };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

/**
 * ── Public scanner ─────────────────────────────────────────────────────────
 * No organizer login: anyone opens /scan, picks an event, types its
 * scanKeyword, and can then scan + mark-used FOR THAT EVENT ONLY. Rate-
 * limited at the route (both endpoints) — a low-stakes shared door code is a
 * brute-forceable secret if left unthrottled.
 */

/**
 * GET /api/scan/events  (public, rate-limited)
 * Every event that currently allows public scanning — has a keyword set and
 * isn't archived. Deliberately leaks nothing else about the event (no
 * scanKeyword itself, no venue/slug/stage data) — just enough to pick one.
 */
export const listPublicScanEvents = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, name, CONVERT_TZ(eventDate, '${UTC}', '${BOGOTA}') AS eventDate
         FROM events
        WHERE scanKeyword IS NOT NULL AND isArchived = 0
        ORDER BY eventDate DESC`,
    );
    res.json(rows);
  } catch (error) {
    sendErrorEmail(req, error, 'listPublicScanEvents');
    return res.status(500).json({ message: error.message });
  }
};

/**
 * POST /api/scan  (public, rate-limited)
 * body: { eventId, keyword, hash }. Validates the keyword for that event
 * (trimmed, case-insensitive — never rely on DB collation for this compare),
 * then marks the ticket used, scoped to that event: a correct keyword for
 * event A can only ever admit event A's tickets.
 */
export const publicScanTicket = async (req, res) => {
  try {
    const { eventId, keyword, hash } = req.body || {};
    if (!eventId || !keyword || !hash) {
      return res.status(400).json({ message: 'eventId, keyword y hash son requeridos' });
    }
    const [[event]] = await pool.query(
      'SELECT scanKeyword FROM events WHERE id = ? AND isArchived = 0',
      [eventId],
    );
    const matches = event?.scanKeyword
      && String(keyword).trim().toLowerCase() === String(event.scanKeyword).trim().toLowerCase();
    if (!matches) {
      return res.status(403).json({ message: 'Palabra clave incorrecta' });
    }

    const outcome = await markUsed(hash, { eventId });
    if (outcome.result === 'invalid') {
      return res.status(404).json(outcome);
    }
    if (outcome.result === 'wrong_event') {
      return res.status(409).json({ ...outcome, message: 'Esta boleta es de otro evento' });
    }
    res.json(outcome);
  } catch (error) {
    sendErrorEmail(req, error, 'publicScanTicket');
    return res.status(500).json({ message: error.message });
  }
};
