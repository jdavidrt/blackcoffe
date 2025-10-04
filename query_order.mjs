import { createPool } from 'mysql2/promise';

const pool = await createPool({
  database: 'defaultdb',
  user: 'doadmin',
  port: '25060',
  host: 'pedidos-do-user-16280854-0.c.db.ondigitalocean.com',
  password: 'AVNS_j0uumiaHkFVlV8xxR43',
  ssl: { rejectUnauthorized: false }
});

console.log('=== DEPOSITS FOR ORDER 15266 ===\n');

const [deposits] = await pool.query(`
  SELECT * FROM deposits
  WHERE orderId = 15266
  ORDER BY depositCreatedAt ASC
`);

console.log(`Total deposits: ${deposits.length}\n`);

if (deposits.length > 0) {
  console.log(JSON.stringify(deposits, null, 2));
} else {
  console.log('❌ NO DEPOSITS FOUND FOR ORDER 15266');
  console.log('\nThis confirms the data integrity issue:');
  console.log('Order 15266 has deposit = 80000, but no deposit records exist.');
}

await pool.end();
process.exit(0);
