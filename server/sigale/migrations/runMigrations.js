/*
 * ============================================================
 * SIGALE - MIGRATION RUNNER
 * Same boot mechanic as BlackCoffe (current-server runs
 * runMigrations() before app.listen), but Sigale's own:
 * it applies every *.sql file in this folder, in name order.
 *
 * APPLIED-ONCE via a `schema_migrations` ledger. The DDL is
 * still idempotent (CREATE TABLE IF NOT EXISTS / guarded
 * ALTERs), but a file that has already been recorded is
 * skipped rather than re-run. This matters after the
 * tickets<->purchases cutover: the pre-cutover migrations
 * (001 purchases/tickets, 004, 005 tickets_v2) declare FK
 * constraint names (fkPurchase*, fkTicketV2*) that the RENAME
 * carried onto the `*_legacy_v1` / merged `tickets` tables.
 * Re-running those CREATEs now throws ER_FK_DUP_NAME (1826),
 * which aborted the whole boot loop and silently blocked every
 * later migration (e.g. 006_guest_passes). See the cutover
 * reconciliation below.
 *
 * GUARDRAIL (SIGALE_2.0_IMPLEMENTATION_PLAN 3.1): refuses to
 * run unless DB_NAME=sigale. db.js enforces the same on the
 * pool; this is defense in depth.
 * ============================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pool from '../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Strip SQL comments and split a file into individual statements.
 * Inline `-- ...` comments are stripped too (not only full-line ones):
 * some column comments contain a ';' (e.g. "-- COP; DECIMAL, never FLOAT"),
 * which would otherwise split a statement in two. The DDL has no string
 * literals containing '--' or ';', so stripping to end-of-line is safe and
 * a split on ';' then yields exactly one entry per statement. The pool
 * intentionally does NOT enable multipleStatements.
 */
function splitStatements(sql) {
  return sql
    .split('\n')
    .map((line) => line.replace(/--.*$/, '')) // drop full-line AND inline comments
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// Pre-cutover migrations whose obsolete DDL now collides with the FK
// constraint names the tickets<->purchases cutover renamed onto the
// `*_legacy_v1` / merged `tickets` tables. Once the cutover has run they
// must never be re-attempted.
const PRE_CUTOVER_MIGRATIONS = [
  '001_init.sql',
  '002_event_address.sql',
  '003_sequential_orderid.sql',
  '004_holders_snapshot.sql',
  '005_tickets_merge_schema.sql',
];

export async function runMigrations() {
  const resolvedDbName = process.env.SIGALE_DB_NAME ?? process.env.DB_NAME;
  if (resolvedDbName !== 'sigale') {
    throw new Error(
      `[sigale/migrations] Refusing to run: SIGALE_DB_NAME (or DB_NAME) must be 'sigale' (got '${resolvedDbName ?? 'undefined'}').`,
    );
  }

  // Ledger of applied migrations. Additive, Sigale-owned, idempotent.
  await pool.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       filename  VARCHAR(255) NOT NULL,
       appliedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
       PRIMARY KEY (filename)
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  );

  // Self-heal: if the tickets<->purchases cutover already ran (legacy tables
  // present) mark the pre-cutover migrations as applied so their obsolete,
  // now-colliding DDL is skipped instead of aborting the whole loop. This
  // makes a redeploy on already-cut-over production reconcile itself with no
  // manual SQL, while a fresh (pre-cutover) install is untouched.
  const [[{ cutover }]] = await pool.query(
    `SELECT COUNT(*) AS cutover FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tickets_legacy_v1'`,
  );
  if (cutover) {
    await pool.query(
      `INSERT IGNORE INTO schema_migrations (filename) VALUES ${PRE_CUTOVER_MIGRATIONS.map(() => '(?)').join(', ')}`,
      PRE_CUTOVER_MIGRATIONS,
    );
  }

  const [appliedRows] = await pool.query('SELECT filename FROM schema_migrations');
  const applied = new Set(appliedRows.map((r) => r.filename));

  const files = fs
    .readdirSync(__dirname)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (applied.has(file)) {
      continue;
    }
    const sql = fs.readFileSync(path.join(__dirname, file), 'utf8');
    const statements = splitStatements(sql);
    for (const statement of statements) {
      await pool.query(statement);
    }
    await pool.query('INSERT IGNORE INTO schema_migrations (filename) VALUES (?)', [file]);
    console.log(`[${new Date().toISOString()}] [sigale/migrations] Applied ${file} (${statements.length} statements)`);
  }
}

export default runMigrations;
