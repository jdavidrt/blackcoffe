/*
 * ============================================================
 * SÍGALE — ONE-OFF MIGRATION: merge purchases + tickets -> tickets_v2
 *
 * Manually run only. NOT picked up by runMigrations.js (which only
 * applies *.sql files in server/migrations/, not this scripts/ folder),
 * and NOT auto-applied on boot. This is the data-copy half of the
 * purchases/tickets merge described in docs/architecture/TICKETS_SCHEMA.md
 * — migration 005 (005_tickets_merge_schema.sql) already created the
 * empty tickets_v2 table; this script copies existing production rows
 * into it, verifies the copy, and (only when explicitly told to) cuts
 * over by renaming tables.
 *
 * Importing server/db.js (below) already enforces DB_NAME=sigale and
 * connects eagerly — same guardrail every other Sígale script relies on.
 *
 * Usage (run from server/):
 *   node migrations/scripts/merge_purchases_into_tickets.js --dry-run
 *   node migrations/scripts/merge_purchases_into_tickets.js --migrate --yes
 *   node migrations/scripts/merge_purchases_into_tickets.js --verify
 *   node migrations/scripts/merge_purchases_into_tickets.js --cutover --yes
 *
 * Modes (mutually exclusive; --dry-run is the default when none given):
 *   --dry-run   Read-only. Reports what would be copied. No writes.
 *   --migrate   Copies purchases (+ their tickets, if confirmed) into
 *               tickets_v2. Idempotent/resumable: an orderId already
 *               present in tickets_v2 is skipped, so re-running after an
 *               interruption is safe. Requires --yes.
 *   --verify    Runs the post-copy verification queries and reports
 *               PASS/FAIL for each. Safe to run any number of times,
 *               before or after --migrate.
 *   --cutover   RENAME TABLE tickets -> tickets_legacy_v1, purchases ->
 *               purchases_legacy_v1, tickets_v2 -> tickets. This is the
 *               moment the new schema goes live — do NOT run until
 *               --verify reports all PASS, and only in the same release
 *               as the rewritten controllers (they already query the
 *               final table name `tickets`, not `tickets_v2`). Requires
 *               --yes. The old tables survive under their _legacy_v1
 *               names — nothing is dropped by this script.
 *
 * --migrate and --cutover both additionally require --yes so a bare
 * invocation can never mutate anything by accident.
 * ============================================================
 */

import pool from '../../db.js';

const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);
const MIGRATE = has('--migrate');
const VERIFY = has('--verify');
const CUTOVER = has('--cutover');
// --dry-run is the implicit default whenever none of the write/verify/cutover
// flags are given — no separate branch needed, runMigration(false) already
// does exactly that.
const CONFIRMED = has('--yes');

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

/**
 * Build the tickets_v2 row array for one purchase. Mirrors the shape the
 * live controllers insert (server/controllers/purchases.controllers.js /
 * admin.controllers.js), so a migrated row is indistinguishable from one
 * created by the new code.
 */
function buildRows(purchase, existingTickets, holdersSnapshot) {
  const qty = purchase.quantity;
  const unitPrice = round2(Number(purchase.totalAmount) / qty);
  const rows = [];

  for (let i = 0; i < qty; i++) {
    const isConfirmed = purchase.status === 'confirmed';
    // Confirmed orders already minted real tickets rows — copy them
    // 1:1, byte-for-byte on the hash, so an issued QR keeps scanning.
    const existing = isConfirmed ? existingTickets[i] : null;
    const holder = !isConfirmed ? (holdersSnapshot?.[i] || null) : null;

    rows.push([
      purchase.orderId,
      i === 0 ? purchase.orderId : null, // orderAnchor
      purchase.eventId,
      purchase.stageId,
      unitPrice,
      existing ? (existing.holderName ?? null) : (holder?.name ?? null),
      existing ? (existing.holderIdNumber ?? null) : (holder?.idNumber ?? null),
      existing ? (existing.holderPhone ?? null) : (holder?.phone ?? null),
      purchase.deliveryMethod,
      purchase.deliveryContact,
      purchase.status,
      i === 0 ? (purchase.idempotencyKey ?? null) : null,
      purchase.reservationExpiresAt,
      purchase.createdAt,
      purchase.confirmedAt,
      purchase.confirmedBy,
      // Never mint a hash for a row that was never actually confirmed —
      // this is the mechanism that keeps unpaid/rejected orders un-scannable.
      existing ? existing.validationHash : null,
      existing ? existing.isUsed : 0,
      existing ? existing.usedAt : null,
    ]);
  }
  return rows;
}

const INSERT_COLUMNS = `
  orderId, orderAnchor, eventId, stageId, unitPrice,
  holderName, holderIdNumber, holderPhone,
  deliveryMethod, deliveryContact, status, idempotencyKey,
  reservationExpiresAt, createdAt, confirmedAt, confirmedBy,
  validationHash, isUsed, usedAt
`;

async function runMigration(write) {
  const [purchases] = await pool.query('SELECT * FROM purchases ORDER BY orderId ASC');
  const [alreadyDoneRows] = await pool.query('SELECT DISTINCT orderId FROM tickets_v2');
  const alreadyDone = new Set(alreadyDoneRows.map((r) => r.orderId));

  let confirmedOrders = 0;
  let confirmedTickets = 0;
  let syntheticOrders = 0;
  let syntheticTickets = 0;
  let skipped = 0;

  for (const purchase of purchases) {
    if (alreadyDone.has(purchase.orderId)) {
      skipped++;
      continue;
    }

    let existingTickets = [];
    let holdersSnapshot = null;
    if (purchase.status === 'confirmed') {
      const [t] = await pool.query(
        'SELECT * FROM tickets WHERE purchaseId = ? ORDER BY id ASC',
        [purchase.id],
      );
      existingTickets = t;
    } else if (purchase.holdersSnapshot) {
      try {
        holdersSnapshot = typeof purchase.holdersSnapshot === 'string'
          ? JSON.parse(purchase.holdersSnapshot)
          : purchase.holdersSnapshot;
      } catch {
        holdersSnapshot = null;
      }
    }

    const rows = buildRows(purchase, existingTickets, holdersSnapshot);

    if (purchase.status === 'confirmed') {
      confirmedOrders++;
      confirmedTickets += rows.length;
    } else {
      syntheticOrders++;
      syntheticTickets += rows.length;
    }

    if (write) {
      await pool.query(`INSERT INTO tickets_v2 (${INSERT_COLUMNS}) VALUES ?`, [rows]);
    }
  }

  console.log(`\n${write ? 'MIGRATED' : 'DRY RUN — would migrate'}:`);
  console.log(`  Confirmed orders:  ${confirmedOrders} (${confirmedTickets} ticket rows, hashes preserved)`);
  console.log(`  Other orders:      ${syntheticOrders} (${syntheticTickets} synthesized rows, no hash)`);
  console.log(`  Already migrated (skipped, resumable): ${skipped}`);
  console.log(`  Total purchases seen: ${purchases.length}`);
  if (!write) {
    console.log('\nRe-run with --migrate --yes to actually write these rows.');
  }
}

async function runVerification() {
  const checks = [
    {
      name: 'Row count matches quantity per order',
      sql: `SELECT p.orderId, p.quantity, COUNT(v.id) AS actual
            FROM purchases p LEFT JOIN tickets_v2 v ON v.orderId = p.orderId
            GROUP BY p.orderId, p.quantity HAVING COUNT(v.id) <> p.quantity LIMIT 10`,
    },
    {
      name: 'SUM(unitPrice) matches totalAmount per order (±0.01)',
      sql: `SELECT p.orderId, p.totalAmount, SUM(v.unitPrice) AS actual
            FROM purchases p LEFT JOIN tickets_v2 v ON v.orderId = p.orderId
            GROUP BY p.orderId, p.totalAmount HAVING ABS(p.totalAmount - SUM(v.unitPrice)) > 0.01 LIMIT 10`,
    },
    {
      name: 'Every existing confirmed ticket hash survived, unchanged',
      sql: `SELECT t.id, t.validationHash FROM tickets t
            LEFT JOIN tickets_v2 v ON v.validationHash = t.validationHash
            WHERE v.id IS NULL LIMIT 10`,
    },
    {
      name: 'No hash exists on a non-confirmed row',
      sql: `SELECT id, status FROM tickets_v2
            WHERE status <> 'confirmed' AND validationHash IS NOT NULL LIMIT 10`,
    },
    {
      name: 'Every confirmed row got a hash (none lost)',
      sql: `SELECT id FROM tickets_v2 WHERE status = 'confirmed' AND validationHash IS NULL LIMIT 10`,
    },
  ];

  console.log('\nVerification:');
  let allPassed = true;
  for (const check of checks) {
    const [rows] = await pool.query(check.sql);
    const passed = rows.length === 0;
    allPassed = allPassed && passed;
    console.log(`  [${passed ? 'PASS' : 'FAIL'}] ${check.name}`);
    if (!passed) {
      console.log(`    ${rows.length} violation(s), sample:`, rows);
    }
  }

  const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM tickets_v2');
  const [[{ expected }]] = await pool.query('SELECT COALESCE(SUM(quantity), 0) AS expected FROM purchases');
  const countOk = Number(total) === Number(expected);
  allPassed = allPassed && countOk;
  console.log(`  [${countOk ? 'PASS' : 'FAIL'}] Overall row count (tickets_v2=${total}, expected=${expected})`);

  console.log(`\n${allPassed ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED — do not cut over yet'}`);
  return allPassed;
}

async function runCutover() {
  console.log('Running verification before cutover...');
  const ok = await runVerification();
  if (!ok) {
    console.error('\nRefusing to cut over: verification failed. Fix the migration and re-run --verify first.');
    process.exit(1);
  }
  console.log('\nCutting over (RENAME TABLE — atomic, near-instant)...');
  await pool.query(
    'RENAME TABLE tickets TO tickets_legacy_v1, purchases TO purchases_legacy_v1, tickets_v2 TO tickets',
  );
  console.log('Done. `tickets` is now the merged schema; old tables are tickets_legacy_v1 / purchases_legacy_v1.');
  console.log('Keep the _legacy_v1 tables for a retention window before dropping them in a later migration.');
}

async function main() {
  if ((MIGRATE || CUTOVER) && !CONFIRMED) {
    console.error(`Refusing to run ${MIGRATE ? '--migrate' : '--cutover'} without --yes.`);
    process.exit(1);
  }

  if (CUTOVER) {
    await runCutover();
  } else if (VERIFY) {
    await runVerification();
  } else {
    await runMigration(MIGRATE);
  }

  await pool.end();
}

main().catch((error) => {
  console.error('Migration script failed:', error);
  process.exit(1);
});
