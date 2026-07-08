/*
 * ============================================================
 * SÍGALE — SEED THE INITIAL ORGANIZER
 * Manual, one-off script (NOT run automatically at boot):
 *
 *     node server/seed/seedOrganizer.js
 *
 * Security (SIGALE_2.0_IMPLEMENTATION_PLAN §6, ADR §9):
 *   - The password is read from ORGANIZER_INITIAL_PASSWORD at
 *     runtime and bcrypt-hashed here. The plaintext printed in
 *     the ADR is considered LEAKED — do not reuse it; set a
 *     freshly rotated value in the environment instead.
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
      'Set ORGANIZER_INITIAL_PASSWORD to a freshly rotated value before seeding. ' +
        'Never reuse the plaintext printed in ADR-0001 (treat it as leaked).',
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  // Idempotent: insert once; on a repeat run the unique username
  // collides and we leave the existing row untouched.
  const [result] = await pool.query(
    'INSERT INTO organizers (username, passwordHash) VALUES (?, ?) ' +
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
