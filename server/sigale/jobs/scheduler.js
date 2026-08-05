/*
 * ============================================================
 * SÍGALE — SCHEDULED JOBS  [Phase 5, Track A]
 *
 * Two recurring jobs, one minute apart from the wall clock, both
 * comparing against UTC_TIMESTAMP() so they agree with the UTC the
 * schema stores (ADR-0001 §8):
 *
 *   1. activateDueStages — flip `upcoming` stages to `active` once
 *      their scheduled `activatesAt` has arrived, demoting whichever stage
 *      of the same event it supersedes to `closed` first (only one stage
 *      per event may be `active` — enforced at the DB level by migration
 *      007's unique index; `closed` rather than `sold_out` because several
 *      handlers auto-reopen a `sold_out` stage once its held inventory
 *      frees up, which must never happen to a superseded stage). A stage
 *      with no `activatesAt` is left alone (it is activated explicitly at
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
const NIGHTLY_AT_MIDNIGHT_BOGOTA = '0 5 * * *'; // 05:00 UTC = 00:00 America/Bogota (UTC-5)

/**
 * Activate every `upcoming` stage whose scheduled time has arrived. Locks
 * the due stages, then per event: demote whatever is currently `active`
 * to `closed` before promoting the due stage — never both `active` at once.
 *
 * @returns {Promise<number>} stages activated
 */
export async function activateDueStages() {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [due] = await conn.query(
      `SELECT id, eventId FROM ticket_stages
        WHERE status = 'upcoming'
          AND activatesAt IS NOT NULL
          AND activatesAt <= UTC_TIMESTAMP()
        FOR UPDATE`,
    );

    for (const stage of due) {
      await conn.query(
        "UPDATE ticket_stages SET status = 'closed' WHERE eventId = ? AND status = 'active'",
        [stage.eventId],
      );
      await conn.query(
        "UPDATE ticket_stages SET status = 'active' WHERE id = ?",
        [stage.id],
      );
    }

    await conn.commit();
    return due.length;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
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
      `SELECT id, orderId, eventId, stageId
         FROM tickets
        WHERE status = 'pending_payment'
          AND reservationExpiresAt <= UTC_TIMESTAMP()
        FOR UPDATE`,
    );

    if (expired.length === 0) {
      await conn.commit();
      return 0;
    }

    // Group by stage to release the right count of reserved spots; remember
    // each stage's event so the restore check below can be scoped to it.
    const stageCounts = {};
    const stageEvents = {};
    for (const t of expired) {
      stageCounts[t.stageId] = (stageCounts[t.stageId] || 0) + 1;
      stageEvents[t.stageId] = t.eventId;
    }
    for (const [stageId, qty] of Object.entries(stageCounts)) {
      await conn.query(
        'UPDATE ticket_stages SET reservedQuantity = GREATEST(reservedQuantity - ?, 0) WHERE id = ?',
        [qty, stageId],
      );
      // Reopen the stage if the released hold creates available spots — but
      // only when its event has no OTHER active stage, so a sweep can never
      // resurrect a second 'active' stage for the same event (multi-event
      // makes this likelier than in the single-event world that motivated
      // migration 007's uqOneActiveStagePerEvent).
      const [[{ activeCount }]] = await conn.query(
        "SELECT COUNT(*) AS activeCount FROM ticket_stages WHERE eventId = ? AND status = 'active'",
        [stageEvents[stageId]],
      );
      if (Number(activeCount) === 0) {
        await conn.query(
          'UPDATE ticket_stages SET status = ? WHERE id = ? AND status = ? AND soldQuantity + reservedQuantity < totalQuantity',
          ['active', stageId, 'sold_out'],
        );
      }
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
 * Rearm the permanent demo event's seeded tickets every night so the demo
 * stays scannable indefinitely. Visitors who scan a demo QR during the day
 * legitimately see "already_used" (that's the point — the scan loop is part
 * of the demo); this job resets isUsed so tomorrow's visitors see "ok"
 * again. No FOR UPDATE / transaction needed: it only flips a used-flag on
 * rows that hold no inventory counters.
 *
 * @returns {Promise<number>} tickets rearmed
 */
export async function rearmDemoTickets() {
  const [result] = await pool.query(
    `UPDATE tickets SET isUsed = 0, usedAt = NULL
      WHERE isUsed = 1
        AND eventId IN (SELECT id FROM events WHERE isDemo = 1)`,
  );
  return result.affectedRows;
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
  const rearmDemo = guarded('rearmDemoTickets', rearmDemoTickets);

  // Catch up on anything missed while the server was down. Deliberately
  // NOT done for rearmDemo — unlike the other two (inventory-correctness
  // jobs), an unplanned restart mid-day prematurely clearing "already_used"
  // on demo tickets is a cosmetic-only downside not worth the catch-up.
  activate();
  sweep();

  const tasks = [
    cron.schedule(EVERY_MINUTE, activate),
    cron.schedule(EVERY_MINUTE, sweep),
    cron.schedule(NIGHTLY_AT_MIDNIGHT_BOGOTA, rearmDemo),
  ];

  console.log(`[${new Date().toISOString()}] [sigale/jobs] Scheduler started (activate + sweep every minute, demo rearm nightly)`);
  return tasks;
}

export default startScheduler;
