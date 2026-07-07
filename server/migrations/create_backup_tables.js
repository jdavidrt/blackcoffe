import pool from '../db.js';

/**
 * Order Backup / Restore tables (feature "Copias de seguridad").
 *
 * Idempotent CREATE TABLE IF NOT EXISTS — safe to run on every boot, matching
 * the logging style of add_client_snapshot.js. No FK constraints (repo
 * convention): a dangling snapshotId in order_restores after pruning is fine,
 * because restoredFromDate is denormalized so the badge survives pruning.
 */
const tables = [
    {
        name: 'order_snapshots',
        ddl: `
            CREATE TABLE IF NOT EXISTS \`order_snapshots\` (
              \`id\` int NOT NULL AUTO_INCREMENT,
              \`orderId\` int NOT NULL,
              \`snapshotDate\` date NOT NULL,
              \`itemsGz\` mediumblob,
              \`deposit\` int DEFAULT NULL,
              \`paid\` tinyint(1) DEFAULT '0',
              \`paidAt\` datetime DEFAULT NULL,
              \`createdAt\` timestamp NOT NULL DEFAULT current_timestamp(),
              PRIMARY KEY (\`id\`),
              UNIQUE KEY \`uq_snapshot_order_day\` (\`orderId\`,\`snapshotDate\`),
              KEY \`idx_snapshot_date\` (\`snapshotDate\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
        `,
    },
    {
        name: 'order_restores',
        ddl: `
            CREATE TABLE IF NOT EXISTS \`order_restores\` (
              \`id\` int NOT NULL AUTO_INCREMENT,
              \`orderId\` int NOT NULL,
              \`snapshotId\` int NOT NULL,
              \`restoredFromDate\` date NOT NULL,
              \`restoredBy\` varchar(255) DEFAULT NULL,
              \`restoredAt\` datetime DEFAULT NULL,
              \`createdAt\` timestamp NOT NULL DEFAULT current_timestamp(),
              PRIMARY KEY (\`id\`),
              KEY \`idx_restores_order\` (\`orderId\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
        `,
    },
];

export async function runBackupMigrations() {
    for (const { name, ddl } of tables) {
        try {
            await pool.query(ddl);
            console.log(`[${new Date().toISOString()}] Migration: Ensured table ${name}`);
        } catch (err) {
            console.error(`[${new Date().toISOString()}] Migration failed for table ${name}:`, err.message);
        }
    }
}
