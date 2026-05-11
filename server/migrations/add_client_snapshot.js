import pool from '../db.js';

const columns = [
    ['clientNameSnapshot', 'VARCHAR(100)'],
    ['clientPremisesSnapshot', 'VARCHAR(20)'],
    ['clientMallSnapshot', 'VARCHAR(20)'],
];

export async function runMigrations() {
    for (const [col, type] of columns) {
        try {
            await pool.query(`ALTER TABLE orders ADD COLUMN ${col} ${type} DEFAULT NULL`);
            console.log(`[${new Date().toISOString()}] Migration: Added column ${col} to orders`);
        } catch (err) {
            if (err.code === 'ER_DUP_FIELDNAME') {
                // Column already exists — nothing to do
            } else {
                console.error(`[${new Date().toISOString()}] Migration failed for column ${col}:`, err.message);
            }
        }
    }
}
