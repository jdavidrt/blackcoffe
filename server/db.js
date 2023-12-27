import { createPool } from "mysql2/promise";


export const pool = await createPool({
    database: "pedidos",
    user: "45g4ryuirjhy6oueq6p0",
    host: "aws.connect.psdb.cloud",
    password: "pscale_pw_QIDeHaGOd9YvfvstY4yNIyQYd6y4Ln3EXidSXE0Xc3",
    ssl: {
        rejectUnauthorized: false
    }
})
console.log("Conectado a PlanetScale")
//pool.query("SELECT * FROM orders ORDER BY createdAt ASC")
export default pool
