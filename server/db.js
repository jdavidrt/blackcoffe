import { createPool } from "mysql2/promise";


export const pool = await createPool({
    database: "pedidos",
    user: "yrmz3a94ulovkmralvpm",
    host: "aws.connect.psdb.cloud",
    password: "pscale_pw_v4pQggEkGunrDk8C3dccPryoIcU6gkSgCvJoPgZwmft",
    ssl: {
        rejectUnauthorized: false
    }
})
console.log("Conectado a PlanetScale")
//pool.query("SELECT * FROM orders ORDER BY createdAt ASC")
export default pool
