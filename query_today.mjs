import { createPool } from 'mysql2/promise';

const pool = await createPool({
  database: 'defaultdb',
  user: 'doadmin',
  port: '25060',
  host: 'pedidos-do-user-16280854-0.c.db.ondigitalocean.com',
  password: 'AVNS_j0uumiaHkFVlV8xxR43',
  ssl: { rejectUnauthorized: false }
});

console.log('=== ALL DEPOSITS CREATED TODAY (2025-10-04) ===\n');

const [deposits] = await pool.query(`
  SELECT * FROM deposits
  WHERE DATE(CONVERT_TZ(depositCreatedAt, '+00:00', '-05:00')) = '2025-10-04'
  ORDER BY depositCreatedAt DESC
`);

console.log(`Total deposits: ${deposits.length}\n`);
console.log(JSON.stringify(deposits, null, 2));

await pool.end();
process.exit(0);
