import { createPool } from "mysql2/promise";


export const pool = await createPool({
    database: "pedidos",
    user: "f5j2ui6boqbfu283vixi",
    host: "aws.connect.psdb.cloud",
    password: "pscale_pw_MeGcl1jRTiDWMTV7nya05uIkJW0Hh5b9v97KoITFnST",
    ssl: {
        rejectUnauthorized: false
    }
})
console.log("Conectado a PlanetScale")
//pool.query("SELECT * FROM orders ORDER BY createdAt ASC")
export default pool
