/*
 * ============================================================
 * SIGALE - DATABASE POOL  (shared-server build)
 * One mysql2/promise pool, reused across every Sigale handler.
 *
 * GUARDRAIL: must connect to the `sigale` schema only.
 * In the merged BlackCoffe deployment the host process already
 * uses DB_NAME for BlackCoffe, so Sigale reads its own schema
 * name from SIGALE_DB_NAME and reuses the shared host/port/
 * credentials. See SIGALE_MERGE_INTO_SHARED_SERVER.md S5.
 *
 * SSL: matches BlackCoffe's working DigitalOcean config
 * (rejectUnauthorized:false). If a CA cert path is provided
 * via DB_CA_CERT it is used instead - useful for stricter envs.
 *
 * dateStrings:true keeps DATETIME as strings so the driver never
 * shifts them by the Node process timezone (ADR-0001 S8).
 * ============================================================
 */

import { createPool } from 'mysql2/promise';
import fs from 'node:fs';

// -- Guardrail: dedicated `sigale` database only -------------------------------
const DB_NAME = process.env.SIGALE_DB_NAME || 'sigale';
if (DB_NAME !== 'sigale') {
  throw new Error(
    `[sigale/db] Refusing to connect: SIGALE_DB_NAME must be 'sigale' (got '${DB_NAME}'). ` +
      'Sigale never touches the BlackCoffe database - see SIGALE_2.0_IMPLEMENTATION_PLAN S3.1.',
  );
}

// -- SSL: prefer optional CA cert; otherwise mirror BlackCoffe's working config -
let ssl;
if (process.env.DB_CA_CERT) {
  ssl = { ca: fs.readFileSync(process.env.DB_CA_CERT) };
  console.log('[sigale/db] SSL enabled - using CA cert from DB_CA_CERT.');
} else {
  ssl = { rejectUnauthorized: false };
  console.log('[sigale/db] SSL enabled (rejectUnauthorized:false) - matching shared DigitalOcean config.');
}

export const pool = createPool({
  host:        process.env.DB_HOST,                            // shared instance
  port:        Number(process.env.DB_PORT) || 25060,
  user:        process.env.DB_USER,                            // shared credentials
  password:    process.env.DB_PASSWORD,
  database:    DB_NAME,                                        // 'sigale' - the separate schema
  dateStrings: true,
  ssl,
  waitForConnections: true,
  connectionLimit:    10,
});

// Verify connectivity eagerly so boot fails fast with a clear message.
try {
  const conn = await pool.getConnection();
  conn.release();
  const portStr = process.env.DB_PORT || 25060;
  console.log(`[${new Date().toISOString()}] [sigale] Connected to MySQL (db=${DB_NAME}, host=${process.env.DB_HOST}:${portStr})`);
} catch (err) {
  console.error(`[sigale/db] Cannot connect to MySQL: ${err.message}`);
  console.error('[sigale/db] Check DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, SIGALE_DB_NAME in the host environment');
  throw err;
}

export default pool;
