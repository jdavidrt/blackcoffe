/*
 * ============================================================
 * SÍGALE — SEED THE INITIAL ORGANIZER
 * Manual, one-off script (NOT run automatically at boot):
 *
 *     node server/seed/seedOrganizer.js
 *
 * Security:
 *   - The password is read from ORGANIZER_INITIAL_PASSWORD at
 *     runtime and bcrypt-hashed here. Use a freshly generated
 *     value; never commit it.
 *   - Only the hash is ever written to the database.
 *   - Idempotent: re-running does not duplicate the organizer.
 *
 * Requires DB_NAME=sigale (enforced by db.js).
 * ============================================================
 */

import bcrypt from 'bcryptjs';
import pool from '../db.js';

const username = process.env.ORGANIZER_USERNAME || 'David';
const password = process.env.ORGANIZER_INITIAL_PASSWORD;

async function seed() {
  if (!password) {
    throw new Error(
      'Set ORGANIZER_INITIAL_PASSWORD to a freshly generated value before seeding.',
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  // Idempotent: insert once; on a repeat run the unique username
  // collides and we leave the existing row untouched.
  // This script only ever bootstraps the FIRST account, so
  // it is always a super_admin — every account created afterwards (via the
  // organizers-admin API) defaults to event_admin instead.
  const [result] = await pool.query(
    "INSERT INTO organizers (username, passwordHash, role, isActive) VALUES (?, ?, 'super_admin', 1) " +
      'ON DUPLICATE KEY UPDATE id = id',
    [username, passwordHash],
  );

  if (result.affectedRows === 1) {
    console.log(`[sigale/seed] Organizer '${username}' created.`);
  } else {
    console.log(`[sigale/seed] Organizer '${username}' already exists — left unchanged.`);
  }
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[sigale/seed] Failed:', err.message);
    process.exit(1);
  });
