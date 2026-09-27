import pool from '../db.js';

/**
 * Keys of writes already applied (POST /order, POST /deposits), so a phone on a weak signal can
 * resend a payment or an order whose answer got lost without it being applied twice.
 * The key is claimed inside the write's own transaction: a rollback releases it, and a resend
 * that arrives while the first attempt is still running waits for it, then sees the key taken.
 *
 * ponytail: never pruned (~70 rows/day of 36-char keys, a few MB per decade); add a DELETE to the
 * nightly backup job if it ever matters.
 */
export async function runIdempotencyMigrations() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS \`idempotency_keys\` (
              \`requestKey\` varchar(64) NOT NULL,
              \`endpoint\` varchar(32) NOT NULL,
              \`createdAt\` timestamp NOT NULL DEFAULT current_timestamp(),
              PRIMARY KEY (\`requestKey\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
        `);
        console.log(`[${new Date().toISOString()}] Migration: Ensured table idempotency_keys`);
    } catch (err) {
        console.error(`[${new Date().toISOString()}] Migration failed for table idempotency_keys:`, err.message);
    }
}

// Claims the request's Idempotency-Key inside `conn`'s open transaction. Returns false when the
// same write was already applied (the caller rolls back and answers { duplicate: true }).
// Requests without a key (older pages, other callers) are always processed, as before.
export async function claimRequestKey(conn, req, endpoint) {
    const key = req.get('Idempotency-Key');
    if (!key || !/^[\w-]{8,64}$/.test(key)) return true;
    const [result] = await conn.query(
        'INSERT IGNORE INTO idempotency_keys (requestKey, endpoint) VALUES (?, ?)',
        [key, endpoint]
    );
    return result.affectedRows === 1;
}
