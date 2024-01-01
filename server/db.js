import { createPool } from "mysql2/promise";


export const pool = await createPool({
    database: "pedidos",
    user: "sc3guundom615xsufy73",
    host: "aws.connect.psdb.cloud",
    password: "pscale_pw_oEEk4zfyPJ2uNhVZu7FB2doHNR2EExOUE5E3xV9dKYa",
    ssl: {
        rejectUnauthorized: false
    }
})
console.log("Conectado a PlanetScale")
//pool.query("SELECT * FROM orders ORDER BY createdAt ASC")
export default pool
