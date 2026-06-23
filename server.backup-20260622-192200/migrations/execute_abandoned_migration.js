/**
 * Database Migration Script - Add Abandoned Orders Fields
 *
 * This script adds the abandoned order tracking columns to the orders table.
 * It can be safely run multiple times - if columns exist, it will skip them.
 *
 * Usage: node server/migrations/execute_abandoned_migration.js
 */

import pool from '../db.js';

async function executeMigration() {
    console.log('\n========================================');
    console.log('BLACKCOFFE DATABASE MIGRATION');
    console.log('Adding Abandoned Orders Fields');
    console.log('Date:', new Date().toISOString());
    console.log('========================================\n');

    try {
        // Step 1: Check if columns already exist
        console.log('Step 1: Checking existing table structure...');
        const [columns] = await pool.query(`
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = 'defaultdb'
            AND TABLE_NAME = 'orders'
        `);

        const existingColumns = columns.map(col => col.COLUMN_NAME);
        console.log('Existing columns:', existingColumns.join(', '));

        const requiredColumns = ['isAbandoned', 'abandonedAt', 'abandonedBy', 'abandonReason'];
        const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));

        if (missingColumns.length === 0) {
            console.log('\n✅ All abandoned order columns already exist!');
            console.log('No migration needed.\n');

            // Show current structure
            console.log('Current orders table structure:');
            const [structure] = await pool.query('DESCRIBE orders');
            console.table(structure);

            await pool.end();
            return;
        }

        console.log('Missing columns:', missingColumns.join(', '));
        console.log('\n⚠️  Migration required!\n');

        // Step 2: Execute migration
        console.log('Step 2: Adding abandoned order columns...');

        const migrationSQL = `
            ALTER TABLE orders
            ADD COLUMN isAbandoned TINYINT(1) DEFAULT 0 AFTER paid,
            ADD COLUMN abandonedAt DATETIME NULL AFTER isAbandoned,
            ADD COLUMN abandonedBy VARCHAR(255) NULL AFTER abandonedAt,
            ADD COLUMN abandonReason TEXT NULL AFTER abandonedBy
        `;

        console.log('Executing SQL:');
        console.log(migrationSQL);
        console.log('');

        await pool.query(migrationSQL);

        console.log('✅ Migration executed successfully!\n');

        // Step 3: Verify changes
        console.log('Step 3: Verifying migration...');
        const [newStructure] = await pool.query('DESCRIBE orders');

        console.log('Updated orders table structure:');
        console.table(newStructure);

        // Step 4: Check default values
        console.log('\nStep 4: Checking default values...');
        const [stats] = await pool.query(`
            SELECT
                COUNT(*) as total_orders,
                SUM(CASE WHEN isAbandoned = 0 OR isAbandoned IS NULL THEN 1 ELSE 0 END) as active_orders,
                SUM(CASE WHEN isAbandoned = 1 THEN 1 ELSE 0 END) as abandoned_orders
            FROM orders
        `);

        console.log('Order Statistics:');
        console.table(stats);

        // Step 5: Test query (same as used in application)
        console.log('\nStep 5: Testing application query...');
        const [testResults] = await pool.query(`
            SELECT orders.id, orders.paid, orders.isAbandoned,
                   clients.clientName, clients.premises
            FROM orders
            JOIN clients ON orders.clientId = clients.id
            WHERE orders.paid = 0
              AND (orders.isAbandoned = 0 OR orders.isAbandoned IS NULL)
            LIMIT 5
        `);

        console.log('Sample unpaid, non-abandoned orders:');
        console.table(testResults);

        console.log('\n========================================');
        console.log('✅ MIGRATION COMPLETED SUCCESSFULLY!');
        console.log('========================================\n');
        console.log('Next steps:');
        console.log('1. Test abandoning an order via /cobrarOrden/:id');
        console.log('2. Check abandoned orders page at /ordenesAbandonadas');
        console.log('3. Verify main dashboard excludes abandoned orders');
        console.log('4. Test reactivating an abandoned order\n');

    } catch (error) {
        console.error('\n❌ MIGRATION FAILED!');
        console.error('Error:', error.message);
        console.error('\nFull error details:');
        console.error(error);

        // Check if error is due to columns already existing
        if (error.code === 'ER_DUP_FIELDNAME') {
            console.log('\n⚠️  Columns may already exist. Running verification...');
            try {
                const [structure] = await pool.query('DESCRIBE orders');
                console.log('\nCurrent orders table structure:');
                console.table(structure);
            } catch (verifyError) {
                console.error('Could not verify table structure:', verifyError.message);
            }
        }

        console.log('\nTroubleshooting:');
        console.log('1. Check database connection in server/db.js');
        console.log('2. Ensure database user has ALTER TABLE privileges');
        console.log('3. Review migration SQL in server/migrations/add_abandoned_fields.sql');
        console.log('4. See MIGRATION_INSTRUCTIONS.md for manual execution steps\n');
    } finally {
        // Close database connection
        await pool.end();
        console.log('Database connection closed.');
    }
}

// Execute migration
console.log('Starting migration...\n');
executeMigration().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
});
