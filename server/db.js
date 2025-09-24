import { createPool } from "mysql2/promise";


export const pool = await createPool({
    database: "defaultdb",
    user: "doadmin",
    port: "25060",
    host: "pedidos-do-user-16280854-0.c.db.ondigitalocean.com",
    password: "AVNS_j0uumiaHkFVlV8xxR43",
    ssl: {
        rejectUnauthorized: false
    }
})
console.log(`[${new Date().toISOString()}] Connected to DigitalOcean Database`);
export default pool
