/*
 * ============================================================
 * SIGALE - MIGRATION RUNNER
 * Same boot mechanic as BlackCoffe (current-server runs
 * runMigrations() before app.listen), but Sigale's own:
 * it applies every *.sql file in this folder, in name order.
 *
 * Idempotent by construction - the DDL uses CREATE TABLE IF
 * NOT EXISTS - so re-running on every boot is safe, and a
 * shared-server redeploy can never run destructive DDL.
 *
 * GUARDRAIL (SIGALE_2.0_IMPLEMENTATION_PLAN 3.1): refuses to
 * run unless SIGALE_DB_NAME=sigale (shared-server build -
 * BlackCoffe owns DB_NAME). db.js enforces the same on the
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

export async function runMigrations() {
  // Shared-server build: Sigale's schema name comes from SIGALE_DB_NAME so it
  // never collides with BlackCoffe's DB_NAME in the host process environment.
  const sigaleDbName = process.env.SIGALE_DB_NAME || 'sigale';
  if (sigaleDbName !== 'sigale') {
    throw new Error(
      `[sigale/migrations] Refusing to run: SIGALE_DB_NAME must be 'sigale' (got '${sigaleDbName}').`,
    );
  }

  const files = fs
    .readdirSync(__dirname)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(__dirname, file), 'utf8');
    const statements = splitStatements(sql);
    for (const statement of statements) {
      await pool.query(statement);
    }
    console.log(`[${new Date().toISOString()}] [sigale/migrations] Applied ${file} (${statements.length} statements)`);
  }
}

export default runMigrations;
