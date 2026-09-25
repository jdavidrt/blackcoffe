import pool from '../db.js';

/**
 * Hot-path indexes (docs/PERFORMANCE_AUDIT.md, QW1).
 *
 * Additive only: ADD INDEX never changes or removes rows. Each index is created
 * only when its name is missing, so this is safe to run on every boot.
 * - ALGORITHM=INPLACE, LOCK=NONE: reads and writes keep flowing while it builds;
 *   if MySQL can't build it online it refuses (logged) instead of locking the table.
 * - lock_wait_timeout=10: if a long transaction holds the table, give up after 10 s
 *   (retried on the next boot) instead of queueing the app's queries behind the DDL.
 */
const indexes = [
    { table: 'orders', name: 'idx_orders_paid', columns: 'paid' },
    { table: 'orders', name: 'idx_orders_client_paid', columns: 'clientId, paid' },
    { table: 'deposits', name: 'idx_deposits_order', columns: 'orderId' },
];

export async function runIndexMigrations() {
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query('SET SESSION lock_wait_timeout = 10');
        for (const { table, name, columns } of indexes) {
            try {
                const [existing] = await conn.query(
                    'SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1',
                    [table, name]
                );
                if (existing.length > 0) continue;
                await conn.query(`ALTER TABLE ${table} ADD INDEX ${name} (${columns}), ALGORITHM=INPLACE, LOCK=NONE`);
                console.log(`[${new Date().toISOString()}] Migration: Added index ${name} on ${table}`);
            } catch (err) {
                console.error(`[${new Date().toISOString()}] Migration failed for index ${name}:`, err.message);
            }
        }
        await conn.query('SET SESSION lock_wait_timeout = DEFAULT');
    } catch (err) {
        console.error(`[${new Date().toISOString()}] Index migrations skipped:`, err.message);
    } finally {
        conn?.release();
    }
}
