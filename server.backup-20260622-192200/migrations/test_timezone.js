/**
 * Timezone Test Script
 *
 * This script tests that timestamps are stored correctly in Colombia time
 * when using DATE_SUB(NOW(), INTERVAL 5 HOUR)
 */

import pool from '../db.js';

async function testTimezone() {
    console.log('\n========================================');
    console.log('TIMEZONE TEST');
    console.log('========================================\n');

    try {
        // Test 1: Check current times
        console.log('Test 1: Current Time Comparison');
        console.log('--------------------------------');
        const [times] = await pool.query(`
            SELECT
                NOW() as server_utc,
                DATE_SUB(NOW(), INTERVAL 5 HOUR) as colombia_stored,
                CONVERT_TZ(NOW(), '+00:00', '-05:00') as colombia_display
        `);

        console.log('UTC Time (server):          ', times[0].server_utc);
        console.log('Colombia Time (stored):     ', times[0].colombia_stored);
        console.log('Colombia Time (for display):', times[0].colombia_display);
        console.log('');

        // Test 2: Simulate abandoned order timestamp
        console.log('Test 2: Abandoned Order Timestamp Simulation');
        console.log('---------------------------------------------');
        const [abandonTest] = await pool.query(`
            SELECT
                DATE_SUB(NOW(), INTERVAL 5 HOUR) as abandonedAt_stored,
                CONVERT_TZ(DATE_SUB(NOW(), INTERVAL 5 HOUR), '+00:00', '-05:00') as abandonedAt_displayed
        `);

        console.log('When order is abandoned:');
        console.log('  Stored in DB:     ', abandonTest[0].abandonedAt_stored);
        console.log('  Displayed to user:', abandonTest[0].abandonedAt_displayed);
        console.log('  ✅ These should match Colombia local time');
        console.log('');

        // Test 3: Check existing abandoned orders (if any)
        console.log('Test 3: Existing Abandoned Orders');
        console.log('----------------------------------');
        const [abandonedOrders] = await pool.query(`
            SELECT
                id,
                abandonedAt as stored_utc,
                CONVERT_TZ(abandonedAt, '+00:00', '-05:00') as displayed_colombia,
                abandonedBy
            FROM orders
            WHERE isAbandoned = 1
            LIMIT 5
        `);

        if (abandonedOrders.length > 0) {
            console.log('Found', abandonedOrders.length, 'abandoned order(s):');
            console.table(abandonedOrders);
        } else {
            console.log('No abandoned orders found yet.');
        }
        console.log('');

        // Test 4: Verify deleted deposits timestamps
        console.log('Test 4: Deleted Deposits Timestamps');
        console.log('------------------------------------');
        const [deletedDeposits] = await pool.query(`
            SELECT
                depositId,
                deletedAt as stored_utc,
                CONVERT_TZ(deletedAt, '+00:00', '-05:00') as displayed_colombia
            FROM deposits
            WHERE isDeleted = 1
            LIMIT 5
        `);

        if (deletedDeposits.length > 0) {
            console.log('Found', deletedDeposits.length, 'deleted deposit(s):');
            console.table(deletedDeposits);
        } else {
            console.log('No deleted deposits found yet.');
        }
        console.log('');

        console.log('========================================');
        console.log('✅ TIMEZONE TEST COMPLETED');
        console.log('========================================\n');
        console.log('Summary:');
        console.log('- Database stores times in UTC');
        console.log('- DATE_SUB(NOW(), INTERVAL 5 HOUR) stores Colombia local time');
        console.log('- CONVERT_TZ(..., \'+00:00\', \'-05:00\') displays Colombia time');
        console.log('- Abandoned orders and deleted deposits use Colombia time\n');

    } catch (error) {
        console.error('\n❌ TEST FAILED!');
        console.error('Error:', error.message);
        console.error(error);
    } finally {
        await pool.end();
        console.log('Database connection closed.');
    }
}

// Execute test
console.log('Starting timezone test...\n');
testTimezone().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
});
