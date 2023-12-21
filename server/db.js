import { createPool } from "mysql2/promise";


export const pool = await createPool({
    database: "pedidos",
    user: "if359poxmv1ank0wc15l",
    host: "aws.connect.psdb.cloud",
    password: "pscale_pw_z6AtWoOnXvQDvS9YIY8pFhCZeD9FTn7T9LZXdar0tRE",
    ssl: {
        rejectUnauthorized: false
    }
})
console.log("Conectado a PlanetScale")
//pool.query('CREATE TABLE prueba(name VARCHAR(100))')