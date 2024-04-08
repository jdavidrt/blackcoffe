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
console.log("Conectado a PlanetScale")
/*pool.query(`select`)
    .then(results => {
        console.log("Resultado de la consulta:", results);
    })
    .catch(error => {
        console.error("Error al ejecutar la consulta:", error);
    });?
    */

export default pool
