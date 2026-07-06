/*
 * ============================================================
 * SÍGALE — SCAN CONTROLLER (door check-in, offline-first)
 * The server side of Phase 4. Three handlers behind requireOrganizer:
 *
 *   GET  /api/admin/scan/manifest?eventId=  — confirmed validationHash
 *        list, downloaded to the device before doors open so the scanner
 *        validates locally with no network.
 *   POST /api/admin/scan                    — mark a single ticket used.
 *   POST /api/admin/scan/sync               — batch reconcile the queue
 *        a device built while offline.
 *
 * Every mark runs under SELECT … FOR UPDATE (ADR §6) and is IDEMPOTENT:
 *   - unknown hash            -> result 'invalid'
 *   - already used            -> result 'already_used' (no-op), keep the
 *                                EARLIEST usedAt on a conflict
 *   - fresh                   -> result 'ok', stamp usedAt
 *
 * Single-scanner assumption (RISK in the plan §7): two offline devices
 * could both admit the same ticket until they sync. Safe while one device
 * scans the door. The earliest-usedAt rule makes sync deterministic.
 * ============================================================
 */

import pool from '../db.js';
import { sendErrorEmail } from '../utils/emailNotifier.js';
import { BOGOTA, UTC, toSqlUtc } from '../utils/time.js';

/**
 * GET /api/admin/scan/manifest?eventId=  (organizer)
 * Every confirmed ticket for the event, with its current used state, so the
 * device can validate locally. Joins tickets -> purchases (status confirmed).
 * usedAt is returned in Bogotá time for the scan log; the hash is the key the
 * scanner matches against.
 */
export const getScanManifest = async (req, res) => {
  try {
    const { eventId } = req.query;
    if (!eventId) {
      return res.status(400).json({ message: 'eventId requerido' });
    }
    const [rows] = await pool.query(
      `SELECT t.id            AS ticketId,
              t.validationHash AS hash,
              t.holderName,
              t.holderIdNumber,
              t.isUsed,
              CONVERT_TZ(t.usedAt, '${UTC}', '${BOGOTA}') AS usedAt,
              p.orderId,
              s.name           AS stageName
       FROM tickets t
       JOIN purchases p     ON p.id = t.purchaseId
       JOIN ticket_stages s ON s.id = p.stageId
       WHERE p.eventId = ? AND p.status = 'confirmed'
       ORDER BY t.id ASC`,
      [eventId],
    );
    res.json({
      eventId: Number(eventId),
      generatedAt: new Date().toISOString(),
      count: rows.length,
      tickets: rows,
    });
  } catch (error) {
    sendErrorEmail(req, error, 'getScanManifest');
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Core mark-used routine, shared by the single and batch endpoints. Runs in
 * its own transaction with FOR UPDATE. Idempotent and conflict-safe:
 *   - missing hash                          -> { result: 'invalid' }
 *   - already used, incoming usedAt earlier -> rewind usedAt, { result: 'already_used' }
 *   - already used otherwise                -> no-op,         { result: 'already_used' }
 *   - fresh                                 -> stamp usedAt,  { result: 'ok' }
 *
 * @param {string} hash    32-hex validationHash from the QR.
 * @param {string} [clientUsedAt] ISO-8601 timestamp captured on the device
 *                         (when the scan happened offline). When absent the
 *                         server clock stamps the mark.
 */
async function markUsed(hash, clientUsedAt) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // validationHash is only ever populated at confirm time (NULL before —
    // see purchases.controllers.js), so this AND is defense-in-depth, not
    // the primary guard: it never changes behavior today, but makes the
    // "only confirmed tickets scan" invariant explicit and testable rather
    // than resting solely on the implicit absence of a hash.
    const [[ticket]] = await conn.query(
      "SELECT id, holderName, isUsed, usedAt FROM tickets WHERE validationHash = ? AND status = 'confirmed' FOR UPDATE",
      [hash],
    );

    if (!ticket) {
      await conn.rollback();
      return { hash, result: 'invalid' };
    }

    // Resolve the timestamp to persist: a client-supplied (offline) time wins
    // only when it is the earliest we have seen for this ticket.
    const hasClientTime = !!clientUsedAt && !Number.isNaN(Date.parse(clientUsedAt));

    if (ticket.isUsed) {
      // Conflict reconciliation: keep the EARLIEST usedAt across devices.
      if (hasClientTime && ticket.usedAt && new Date(clientUsedAt) < new Date(ticket.usedAt)) {
        await conn.query('UPDATE tickets SET usedAt = ? WHERE id = ?', [
          toSqlUtc(clientUsedAt),
          ticket.id,
        ]);
        await conn.commit();
        return { hash, result: 'already_used', holderName: ticket.holderName, usedAt: clientUsedAt, rewound: true };
      }
      await conn.commit();
      return { hash, result: 'already_used', holderName: ticket.holderName, usedAt: ticket.usedAt };
    }

    // Fresh admit.
    if (hasClientTime) {
      await conn.query('UPDATE tickets SET isUsed = 1, usedAt = ? WHERE id = ?', [
        toSqlUtc(clientUsedAt),
        ticket.id,
      ]);
    } else {
      await conn.query('UPDATE tickets SET isUsed = 1, usedAt = UTC_TIMESTAMP() WHERE id = ?', [
        ticket.id,
      ]);
    }
    await conn.commit();
    return { hash, result: 'ok', holderName: ticket.holderName, usedAt: clientUsedAt || new Date().toISOString() };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

/**
 * POST /api/admin/scan  (organizer)
 * Body: { hash, usedAt? }. Marks one ticket used. Online path for a device
 * with connectivity; offline devices accumulate scans and call /sync instead.
 */
export const scanTicket = async (req, res) => {
  try {
    const { hash, usedAt } = req.body || {};
    if (!hash) {
      return res.status(400).json({ message: 'hash requerido' });
    }
    const outcome = await markUsed(hash, usedAt);
    // 'invalid' is a 404 so the client can branch; 'ok'/'already_used' are 200.
    if (outcome.result === 'invalid') {
      return res.status(404).json(outcome);
    }
    res.json(outcome);
  } catch (error) {
    sendErrorEmail(req, error, 'scanTicket');
    return res.status(500).json({ message: error.message });
  }
};

/**
 * POST /api/admin/scan/sync  (organizer)
 * Body: { scans: [{ hash, usedAt }] }. Reconciles a queue built offline.
 * Each entry runs through the same idempotent mark; the response reports the
 * per-hash outcome so the device can clear its queue and refresh its log.
 */
export const syncScans = async (req, res) => {
  try {
    const scans = Array.isArray(req.body?.scans) ? req.body.scans : null;
    if (!scans) {
      return res.status(400).json({ message: 'scans debe ser un arreglo' });
    }

    const reconciliation = [];
    let admitted = 0;
    let duplicates = 0;
    let invalid = 0;

    for (const scan of scans) {
      if (!scan || !scan.hash) {
        reconciliation.push({ hash: scan?.hash ?? null, result: 'invalid' });
        invalid += 1;
        continue;
      }
      // Process sequentially: each is a short, lock-scoped transaction and the
      // queue at one door is small. Keeps the earliest-usedAt rule deterministic.
      // eslint-disable-next-line no-await-in-loop
      const outcome = await markUsed(scan.hash, scan.usedAt);
      reconciliation.push(outcome);
      if (outcome.result === 'ok') admitted += 1;
      else if (outcome.result === 'already_used') duplicates += 1;
      else invalid += 1;
    }

    res.json({
      synced: scans.length,
      admitted,
      duplicates,
      invalid,
      reconciliation,
    });
  } catch (error) {
    sendErrorEmail(req, error, 'syncScans');
    return res.status(500).json({ message: error.message });
  }
};
