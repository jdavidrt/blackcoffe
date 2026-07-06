/*
 * ============================================================
 * SÍGALE — SCHEDULED JOBS  [Phase 5, Track A]
 *
 * Two recurring jobs, one minute apart from the wall clock, both
 * comparing against UTC_TIMESTAMP() so they agree with the UTC the
 * schema stores (ADR-0001 §8):
 *
 *   1. activateDueStages — flip `upcoming` stages to `active` once
 *      their scheduled `activatesAt` has arrived. A stage with no
 *      `activatesAt` is left alone (it is activated explicitly at
 *      creation, never on a timer).
 *
 *   2. sweepExpiredHolds — recycle abandoned reservations. Every
 *      `pending_payment` ticket row past its 24h `reservationExpiresAt`
 *      (decision #4) is marked `expired` and its held cupo returned to
 *      the stage, in one FOR UPDATE transaction. `payment_submitted`
 *      is DELIBERATELY excluded: a buyer who sent a receipt waits for
 *      the organizer's manual review, however long that takes.
 *
 * Design notes:
 *   - node-cron schedules in the *server's* local zone, but the jobs
 *     never read the local clock; every comparison is UTC_TIMESTAMP()
 *     in SQL, so the schedule is just "how often", not "at what time".
 *   - An in-flight guard per job prevents overlap if a sweep ever runs
 *     long (it would have to, but cheap insurance).
 *   - Errors are caught and mailed via sendErrorEmail with a synthetic
 *     request, then swallowed — a job failure must never crash boot or
 *     the process.
 *   - Both jobs run once at startup so a server that was down through a
 *     scheduled activation/expiry catches up immediately.
 * ============================================================
 */

import cron from 'node-cron';
import pool from '../db.js';
import { sendErrorEmail } from '../utils/emailNotifier.js';

const EVERY_MINUTE = '* * * * *';

/**
 * Activate every `upcoming` stage whose scheduled time has arrived.
 * Pure UPDATE (no row-by-row work needed); the WHERE guards against
 * touching stages without a schedule or already past `upcoming`.
 *
 * @returns {Promise<number>} stages activated
 */
export async function activateDueStages() {
  const [result] = await pool.query(
    `UPDATE ticket_stages
        SET status = 'active'
      WHERE status = 'upcoming'
        AND activatesAt IS NOT NULL
        AND activatesAt <= UTC_TIMESTAMP()`,
  );
  return result.affectedRows;
}

/**
 * Recycle abandoned holds. Locks the expired `pending_payment` rows,
 * returns each one's cupo to its stage, and marks it `expired` — all
 * inside a single transaction so inventory never tears. Excludes
 * `payment_submitted` (a real payer awaiting review).
 *
 * @returns {Promise<number>} distinct orders expired (not raw row count —
 *   an order can be N rows, and the log line means "N orders")
 */
export async function sweepExpiredHolds() {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Lock the candidates so a concurrent confirm/reject can't race us.
    const [expired] = await conn.query(
      `SELECT id, orderId, stageId
         FROM tickets
        WHERE status = 'pending_payment'
          AND reservationExpiresAt <= UTC_TIMESTAMP()
        FOR UPDATE`,
    );

    if (expired.length === 0) {
      await conn.commit();
      return 0;
    }

    // Group by stage to release the right count of reserved spots.
    const stageCounts = {};
    for (const t of expired) {
      stageCounts[t.stageId] = (stageCounts[t.stageId] || 0) + 1;
    }
    for (const [stageId, qty] of Object.entries(stageCounts)) {
      await conn.query(
        'UPDATE ticket_stages SET reservedQuantity = GREATEST(reservedQuantity - ?, 0) WHERE id = ?',
        [qty, stageId],
      );
      // Reopen the stage if the released hold creates available spots.
      await conn.query(
        'UPDATE ticket_stages SET status = ? WHERE id = ? AND status = ? AND soldQuantity + reservedQuantity < totalQuantity',
        ['active', stageId, 'sold_out'],
      );
    }

    await conn.query(
      `UPDATE tickets SET status = 'expired'
        WHERE status = 'pending_payment' AND reservationExpiresAt <= UTC_TIMESTAMP()`,
    );

    await conn.commit();
    return new Set(expired.map((t) => t.orderId)).size;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

/**
 * Wrap a job: skip if its previous run is still in flight, log the
 * outcome, and never let a failure escape (mail it, then swallow).
 */
function guarded(name, fn) {
  let running = false;
  return async () => {
    if (running) {
      console.warn(`[${new Date().toISOString()}] [sigale/jobs] ${name} still running — skipping this tick`);
      return;
    }
    running = true;
    try {
      const affected = await fn();
      if (affected > 0) {
        console.log(`[${new Date().toISOString()}] [sigale/jobs] ${name}: ${affected} row(s)`);
      }
    } catch (error) {
      console.error(`[${new Date().toISOString()}] [sigale/jobs] ${name} failed:`, error.message);
      // Synthetic request so the notifier can label the source.
      sendErrorEmail({ method: 'JOB', path: `/jobs/${name}` }, error, `scheduler.${name}`);
    } finally {
      running = false;
    }
  };
}

/**
 * Register the recurring jobs and run each once at startup (catch-up).
 * Call after app.listen(). Returns the cron task handles for tests/shutdown.
 */
export function startScheduler() {
  const activate = guarded('activateDueStages', activateDueStages);
  const sweep = guarded('sweepExpiredHolds', sweepExpiredHolds);

  // Catch up on anything missed while the server was down.
  activate();
  sweep();

  const tasks = [
    cron.schedule(EVERY_MINUTE, activate),
    cron.schedule(EVERY_MINUTE, sweep),
  ];

  console.log(`[${new Date().toISOString()}] [sigale/jobs] Scheduler started (activate + sweep, every minute)`);
  return tasks;
}

export default startScheduler;
