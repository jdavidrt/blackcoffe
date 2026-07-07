import cron from 'node-cron';
import { gzipSync, gunzipSync } from 'node:zlib';
import pool from '../db.js';
import { sendErrorEmail } from '../utils/emailNotifier.js';

// 21-day retention window for snapshots (order_restores is never pruned).
const RETENTION_DAYS = 21;

// Colombia "today" (UTC-5, no DST) as YYYY-MM-DD — same convention as
// deposits.controllers.js (createDeposit) so calendar days line up.
const colombiaToday = () =>
    new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10);

// Normalize a paidAt value (datetime string or null) to its YYYY-MM-DD prefix
// for delta comparison. dateStrings:true means the pool hands us strings.
const normPaidAt = (v) => (v ? String(v).slice(0, 10) : null);

/**
 * runOrderBackup — pure, directly testable nightly snapshot pass.
 *
 * 1. Prune snapshots older than the retention window (BEFORE writing, so an
 *    untouched unpaid order whose only snapshot ages out gets a fresh baseline
 *    in this same run instead of vanishing for a day).
 * 2. Select eligible orders (unpaid, OR paid-today, OR paid-but-already-snapshotted).
 * 3. Load the latest snapshot per order in one query.
 * 4. Delta-compare items (byte-exact) + deposit + paid + paidAt; write only on change.
 *
 * @returns {Promise<{eligible:number, written:number, pruned:number}>}
 */
export async function runOrderBackup() {
    const today = colombiaToday();

    // 1. Prune first.
    const [pruneResult] = await pool.query(
        'DELETE FROM order_snapshots WHERE snapshotDate < DATE_SUB(?, INTERVAL ? DAY)',
        [today, RETENTION_DAYS]
    );
    const pruned = pruneResult.affectedRows || 0;

    // 2. Eligible orders. Pre-deploy paid orders (no snapshots + paidAt != today)
    //    are never eligible → no backfill. See plan "Eligibility per run".
    const [orders] = await pool.query(
        `SELECT id, items, deposit, paid, paidAt
           FROM orders
          WHERE paid = 0
             OR (paid = 1 AND (DATE(paidAt) = ?
                               OR EXISTS (SELECT 1 FROM order_snapshots s WHERE s.orderId = orders.id)))`,
        [today]
    );

    // 3. Latest snapshot per order (served by the unique key on (orderId, snapshotDate)).
    const [snapRows] = await pool.query(
        `SELECT s.orderId, s.itemsGz, s.deposit, s.paid, s.paidAt
           FROM order_snapshots s
           JOIN (SELECT orderId, MAX(snapshotDate) AS md
                   FROM order_snapshots GROUP BY orderId) m
             ON m.orderId = s.orderId AND m.md = s.snapshotDate`
    );
    const latest = new Map();
    for (const r of snapRows) latest.set(r.orderId, r);

    // 4. Delta + write.
    let written = 0;
    for (const order of orders) {
        const currentItems = order.items || '';
        const prev = latest.get(order.id);

        if (prev) {
            let prevItems = '';
            try { prevItems = gunzipSync(prev.itemsGz).toString('utf8'); } catch { prevItems = ''; }
            const unchanged =
                prevItems === currentItems &&
                Number(prev.deposit) === Number(order.deposit) &&
                Number(prev.paid) === Number(order.paid) &&
                normPaidAt(prev.paidAt) === normPaidAt(order.paidAt);
            if (unchanged) continue;
        }

        const itemsGz = gzipSync(Buffer.from(currentItems, 'utf8'));
        await pool.query(
            `INSERT INTO order_snapshots (orderId, snapshotDate, itemsGz, deposit, paid, paidAt)
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                itemsGz = VALUES(itemsGz), deposit = VALUES(deposit),
                paid = VALUES(paid), paidAt = VALUES(paidAt)`,
            [order.id, today, itemsGz, order.deposit, order.paid, normPaidAt(order.paidAt)]
        );
        written++;
    }

    return { eligible: orders.length, written, pruned };
}

/**
 * Wrap runOrderBackup: skip if a previous run is still in flight, log the
 * outcome, and never let a failure escape (mail it, then swallow). Pattern
 * replicated (not imported) from Sigale's scheduler guarded() helper.
 */
function guardedRun() {
    let running = false;
    return async () => {
        if (running) {
            console.warn(`[${new Date().toISOString()}] [jobs] orderBackup still running — skipping this tick`);
            return;
        }
        running = true;
        try {
            const { eligible, written, pruned } = await runOrderBackup();
            console.log(`[${new Date().toISOString()}] [jobs] orderBackup: eligible=${eligible} written=${written} pruned=${pruned}`);
        } catch (error) {
            console.error(`[${new Date().toISOString()}] [jobs] orderBackup failed:`, error.message);
            sendErrorEmail({ method: 'JOB', path: '/jobs/orderBackup' }, error, 'orderBackup');
        } finally {
            running = false;
        }
    };
}

/**
 * Register the nightly snapshot job: 23:00 Mon–Sat, America/Bogota.
 * No startup catch-up run (user decision) — the eligibility clause is the only
 * mechanism that captures a paid order's final state if the server was down at
 * 23:00. Call after app.listen(). Returns the cron task handle.
 */
export function startOrderBackupJob() {
    const run = guardedRun();
    const task = cron.schedule('0 23 * * 1-6', run, { timezone: 'America/Bogota' });
    console.log(`[${new Date().toISOString()}] [jobs] orderBackup scheduled (23:00 Mon–Sat, America/Bogota)`);
    return task;
}

export default startOrderBackupJob;
