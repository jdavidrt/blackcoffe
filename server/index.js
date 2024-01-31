import express from "express";
import cors from "cors";
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { PORT } from "./config.js";

import indexRoutes from "./routes/index.routes.js";
import ordersRoutes from "./routes/orders.routes.js";
import productRoutes from "./routes/products.routes.js";
import clientRoutes from "./routes/clients.routes.js";
import userRoutes from "./routes/users.routes.js";


const app = express();
const __dirname = dirname(fileURLToPath(import.meta.url));
app.use(cors());
app.use(express.json())
app.use(indexRoutes)
app.use(ordersRoutes)
app.use(productRoutes)
app.use(clientRoutes)
app.use(userRoutes)
app.use(express.static(join(__dirname, '../client/dist')))
app.listen(PORT)
console.log(`Servidor corriendo en puerto ` + PORT);
