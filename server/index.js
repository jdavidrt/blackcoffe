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
import depositRoutes from "./routes/deposits.routes.js";


const app = express();
const __dirname = dirname(fileURLToPath(import.meta.url));

// CORS configuration - allow both production and development domains
app.use(cors({
  origin: [
    'https://blackcofeepedidos.onrender.com',
    'http://localhost:5173',
    'http://localhost:25060'
  ],
  credentials: true
}));

app.use(express.json())
app.use(indexRoutes)
app.use(ordersRoutes)
app.use(productRoutes)
app.use(depositRoutes)
app.use(clientRoutes)
app.use(userRoutes)

// Serve static files from React build
app.use(express.static(join(__dirname, '../client/dist')))

// Fallback route: serve index.html for all other routes (React Router)
// This allows React Router to handle client-side routing
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, '../client/dist', 'index.html'));
});

app.listen(PORT)
console.log(`[${new Date().toISOString()}] BlackCoffe Server running on port ${PORT}`);
