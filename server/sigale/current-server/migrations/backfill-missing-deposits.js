import pool from '../db.js';

/**
 * Migration Script: Backfill Missing Deposit Records
 *
 * Purpose: Create deposit records for paid orders that don't have them
 * Issue: 75 orders were marked as paid without creating corresponding deposit records
 *
 * This script will:
 * 1. Find all paid orders without deposit records
 * 2. Create a single deposit record for each order matching the order's deposit amount
 * 3. Set payment method to "Efectivo" (default for historical records)
 *
 * Run with: node server/migrations/backfill-missing-deposits.js
 */

async function backfillMissingDeposits() {
  const connection = await pool.getConnection();

  try {
    console.log('='.repeat(60));
    console.log('BACKFILL MISSING DEPOSITS MIGRATION');
    console.log('='.repeat(60));
    console.log('\n');

    // Start transaction for data integrity
    await connection.beginTransaction();

    // Step 1: Find all paid orders without deposit records
    console.log('Step 1: Finding paid orders without deposit records...\n');

    const [orphanedOrders] = await connection.query(`
      SELECT
        o.id,
        o.clientId,
        o.deposit,
        o.paidAt,
        DATE(CONVERT_TZ(o.createdAt, '+00:00', '-05:00')) as createdAt
      FROM orders o
      LEFT JOIN deposits d ON o.id = d.orderId
      WHERE o.paid = 1 AND d.depositId IS NULL AND o.deposit > 0
      ORDER BY o.id ASC
    `);

    console.log(`Found ${orphanedOrders.length} paid orders without deposit records\n`);

    if (orphanedOrders.length === 0) {
      console.log('✅ No orders need backfilling. All paid orders have deposit records.');
      await connection.rollback();
      return;
    }

    // Step 2: Preview what will be created
    console.log('Preview of deposits to be created:');
    console.log('-'.repeat(60));
    orphanedOrders.slice(0, 5).forEach(order => {
      console.log(`Order #${order.id}: $${order.deposit} (Client: ${order.clientId}, Paid: ${order.paidAt})`);
    });
    if (orphanedOrders.length > 5) {
      console.log(`... and ${orphanedOrders.length - 5} more orders`);
    }
    console.log('-'.repeat(60));
    console.log('\n');

    // Step 3: Create deposit records
    console.log('Step 2: Creating deposit records...\n');

    let successCount = 0;
    let errorCount = 0;

    for (const order of orphanedOrders) {
      try {
        // Create deposit record
        // Since this is a backfill, we create a single deposit matching the full amount
        const depositRecord = {
          orderId: order.id,
          clientId: order.clientId,
          depositValue: order.deposit,        // Individual amount (in this case, full amount)
          lastDeposit: 0,                     // No previous deposits
          newDeposit: order.deposit,          // New cumulative total
          dueOnDeposit: 0,                    // Fully paid
          paymentMethod: 'Efectivo',          // Default for historical records
          depositCreatedAt: order.paidAt || order.createdAt // Use paidAt if available
        };

        await connection.query(
          `INSERT INTO deposits
           (orderId, clientId, depositValue, lastDeposit, newDeposit, dueOnDeposit, paymentMethod, depositCreatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            depositRecord.orderId,
            depositRecord.clientId,
            depositRecord.depositValue,
            depositRecord.lastDeposit,
            depositRecord.newDeposit,
            depositRecord.dueOnDeposit,
            depositRecord.paymentMethod,
            depositRecord.depositCreatedAt
          ]
        );

        successCount++;

        // Log progress every 10 records
        if (successCount % 10 === 0) {
          console.log(`  ✓ Processed ${successCount}/${orphanedOrders.length} orders...`);
        }
      } catch (error) {
        errorCount++;
        console.error(`  ✗ Error creating deposit for order ${order.id}:`, error.message);
      }
    }

    console.log('\n');
    console.log('='.repeat(60));
    console.log('MIGRATION RESULTS');
    console.log('='.repeat(60));
    console.log(`✅ Successfully created: ${successCount} deposit records`);
    if (errorCount > 0) {
      console.log(`❌ Failed to create: ${errorCount} deposit records`);
    }
    console.log('='.repeat(60));

    // Step 4: Verify the results
    console.log('\nStep 3: Verifying migration results...\n');

    const [remainingOrphaned] = await connection.query(`
      SELECT COUNT(*) as count
      FROM orders o
      LEFT JOIN deposits d ON o.id = d.orderId
      WHERE o.paid = 1 AND d.depositId IS NULL AND o.deposit > 0
    `);

    console.log(`Remaining orphaned orders: ${remainingOrphaned[0].count}`);

    if (remainingOrphaned[0].count === 0) {
      console.log('\n✅ Migration successful! All paid orders now have deposit records.\n');

      // Commit transaction
      await connection.commit();
      console.log('✅ Transaction committed.\n');
    } else {
      console.log('\n⚠️  Some orders still missing deposits. Rolling back...\n');
      await connection.rollback();
      console.log('❌ Transaction rolled back.\n');
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('Stack:', error.stack);

    // Rollback on error
    await connection.rollback();
    console.log('\n❌ Transaction rolled back due to error.\n');
  } finally {
    connection.release();
    await pool.end();
  }
}

// Run the migration
backfillMissingDeposits()
  .then(() => {
    console.log('Migration script completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
