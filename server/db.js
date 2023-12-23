import { createPool } from "mysql2/promise";


export const pool = await createPool({
    database: "pedidos",
    user: "tigzzqsf9not0ws9vjy0",
    host: "aws.connect.psdb.cloud",
    password: "pscale_pw_OdgtqKhxp00cI2T7B1ThuULlixxdlckN1jUQ2ojJ5i3",
    ssl: {
        rejectUnauthorized: false
    }
})
console.log("Conectado a PlanetScale")
//pool.query("SELECT * FROM orders ORDER BY createdAt ASC")
export default pool
