import { createPool } from "mysql2/promise";


export const pool = await createPool({
    database: process.env.DB_NAME,
    user:     process.env.DB_USER,
    port:     process.env.DB_PORT,
    host:     process.env.DB_HOST,
    password: process.env.DB_PASSWORD,
    ssl: {
        rejectUnauthorized: false
    }
})
console.log(`[${new Date().toISOString()}] Connected to DigitalOcean Database`);
export default pool
