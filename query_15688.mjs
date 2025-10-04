import { createPool } from 'mysql2/promise';

const pool = await createPool({
  database: 'defaultdb',
  user: 'doadmin',
  port: '25060',
  host: 'pedidos-do-user-16280854-0.c.db.ondigitalocean.com',
  password: 'AVNS_j0uumiaHkFVlV8xxR43',
  ssl: { rejectUnauthorized: false }
});

console.log('=== CHECKING ORDER 15688 ===\n');

// Check order details
const [order] = await pool.query('SELECT id, deposit, paid, createdAt FROM orders WHERE id = 15688');
console.log('ORDER DETAILS:');
console.log(JSON.stringify(order, null, 2));

console.log('\n=== DEPOSITS FOR ORDER 15688 ===\n');

const [deposits] = await pool.query(`
  SELECT
    depositId,
    orderId,
    depositValue,
    lastDeposit,
    newDeposit,
    dueOnDeposit,
    paymentMethod,
    DATE_FORMAT(CONVERT_TZ(depositCreatedAt, '+00:00', '-05:00'), '%Y-%m-%d %H:%i:%s') as depositCreatedAt,
    isDeleted
  FROM deposits
  WHERE orderId = 15688
  ORDER BY depositCreatedAt DESC
`);

console.log(`Total deposits: ${deposits.length}\n`);

if (deposits.length > 0) {
  console.log(JSON.stringify(deposits, null, 2));
} else {
  console.log('❌ NO DEPOSITS FOUND FOR ORDER 15688');
}

// Check most recent deposits in the system
console.log('\n=== MOST RECENT 5 DEPOSITS IN SYSTEM ===\n');

const [recent] = await pool.query(`
  SELECT
    depositId,
    orderId,
    depositValue,
    paymentMethod,
    DATE_FORMAT(CONVERT_TZ(depositCreatedAt, '+00:00', '-05:00'), '%Y-%m-%d %H:%i:%s') as depositCreatedAt
  FROM deposits
  ORDER BY depositCreatedAt DESC
  LIMIT 5
`);

console.log(JSON.stringify(recent, null, 2));

await pool.end();
process.exit(0);
