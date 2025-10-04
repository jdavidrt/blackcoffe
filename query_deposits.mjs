import { createPool } from 'mysql2/promise';

const pool = await createPool({
  database: 'defaultdb',
  user: 'doadmin',
  port: '25060',
  host: 'pedidos-do-user-16280854-0.c.db.ondigitalocean.com',
  password: 'AVNS_j0uumiaHkFVlV8xxR43',
  ssl: { rejectUnauthorized: false }
});

console.log('=== TODAY\'S DEPOSITS (2025-10-04) ===\n');

const [deposits] = await pool.query(`
  SELECT
    d.depositId,
    d.orderId,
    d.depositValue,
    d.lastDeposit,
    d.newDeposit,
    d.dueOnDeposit,
    d.paymentMethod,
    DATE_FORMAT(CONVERT_TZ(d.depositCreatedAt, '+00:00', '-05:00'), '%Y-%m-%d %H:%i:%s') as depositCreatedAt,
    d.isDeleted,
    o.paid as orderPaid,
    c.clientName,
    c.premises,
    c.mall
  FROM deposits d
  JOIN orders o ON d.orderId = o.id
  JOIN clients c ON o.clientId = c.id
  WHERE DATE(CONVERT_TZ(d.depositCreatedAt, '+00:00', '-05:00')) = '2025-10-04'
  ORDER BY d.depositCreatedAt DESC
`);

console.log(`Total deposits today: ${deposits.length}\n`);

// Calculate totals
let totalDeposited = 0;
let activeCount = 0;
let deletedCount = 0;

deposits.forEach(d => {
  if (d.isDeleted === 0) {
    totalDeposited += d.depositValue;
    activeCount++;
  } else {
    deletedCount++;
  }
});

console.log(`Active deposits: ${activeCount}`);
console.log(`Deleted deposits: ${deletedCount}`);
console.log(`Total deposited today: $${totalDeposited.toLocaleString()}\n`);

console.log('=== DEPOSIT DETAILS ===\n');

deposits.forEach((d, i) => {
  console.log(`${i + 1}. Order #${d.orderId} - ${d.clientName} (${d.premises}) - ${d.mall}`);
  console.log(`   Deposit: $${d.depositValue.toLocaleString()} | Payment Method: ${d.paymentMethod}`);
  console.log(`   Created: ${d.depositCreatedAt}`);
  console.log(`   Last Deposit: $${d.lastDeposit} → New Total: $${d.newDeposit} → Due: $${d.dueOnDeposit}`);
  console.log(`   Status: ${d.isDeleted === 1 ? '❌ DELETED' : '✅ ACTIVE'} | Order Paid: ${d.orderPaid === 1 ? '✅ YES' : '❌ NO'}`);
  console.log('');
});

await pool.end();
process.exit(0);
