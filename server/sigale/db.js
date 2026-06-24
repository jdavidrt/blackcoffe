/*
 * ============================================================
 * SÍGALE — DATABASE POOL
 * One mysql2/promise pool, reused across the whole app.
 *
 * Two modes:
 *   LOCAL  — DB_CA_CERT empty → plain TCP to 127.0.0.1:3306, no SSL.
 *            Safe: the socket never leaves the machine.
 *   PROD   — DB_CA_CERT set   → TLS with the DigitalOcean CA cert;
 *            rejectUnauthorized stays true (ADR-0001 §9).
 *
 * GUARDRAIL: DB_NAME must be 'sigale'. This pool must NEVER connect
 * to BlackCoffe's database. See SIGALE_2.0_IMPLEMENTATION_PLAN §3.1.
 *
 * dateStrings:true keeps DATETIME as strings so the driver never
 * shifts them by the Node process timezone (ADR-0001 §8).
 * ============================================================
 */

import { createPool } from 'mysql2/promise';
import fs from 'node:fs';

// ── Guardrail: dedicated `sigale` database only ────────────────────────────────
// On the shared BlackCoffe server, DB_NAME is already taken by BlackCoffe
// ('defaultdb'). Set SIGALE_DB_NAME=sigale in that environment so Sígale
// reads its own var without conflicting. Standalone mode keeps DB_NAME=sigale.
const DB_NAME = process.env.SIGALE_DB_NAME ?? process.env.DB_NAME;
if (DB_NAME !== 'sigale') {
  throw new Error(
    `[sigale/db] Refusing to connect: SIGALE_DB_NAME (or DB_NAME) must be 'sigale' (got '${DB_NAME ?? 'undefined'}'). ` +
      'Sígale never touches the BlackCoffe database — see SIGALE_2.0_IMPLEMENTATION_PLAN §3.1.',
  );
}

// ── SSL: prod uses DigitalOcean CA cert; local skips SSL entirely ──────────────
let ssl;
if (process.env.DB_CA_CERT) {
  ssl = { ca: fs.readFileSync(process.env.DB_CA_CERT) };
  console.log('[sigale/db] SSL enabled — using CA cert from DB_CA_CERT.');
} else {
  ssl = false; // plain TCP; safe for localhost-only connections
  console.log('[sigale/db] DB_CA_CERT not set — connecting without SSL (local dev mode).');
}

export const pool = createPool({
  host:        process.env.DB_HOST || '127.0.0.1',
  port:        Number(process.env.DB_PORT) || 3306,
  user:        process.env.DB_USER,
  password:    process.env.DB_PASSWORD,
  database:    DB_NAME,
  dateStrings: true,
  ssl,
  waitForConnections: true,
  connectionLimit:    10,
});

// Verify connectivity eagerly so boot fails fast with a clear message.
try {
  const conn = await pool.getConnection();
  conn.release();
  console.log(`[${new Date().toISOString()}] [sigale] Connected to MySQL (db=${DB_NAME}, host=${process.env.DB_HOST}:${process.env.DB_PORT || 3306})`);
} catch (err) {
  console.error(`[sigale/db] Cannot connect to MySQL: ${err.message}`);
  console.error('[sigale/db] Check DB_HOST, DB_PORT, DB_USER, DB_PASSWORD in server/.env');
  throw err;
}

export default pool;
