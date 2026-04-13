import express from "express";
import cors from "cors";
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { PORT } from "./config.js";
import { sendErrorEmail } from "./utils/emailNotifier.js";

import indexRoutes from "./routes/index.routes.js";
import ordersRoutes from "./routes/orders.routes.js";
import productRoutes from "./routes/products.routes.js";
import clientRoutes from "./routes/clients.routes.js";
import userRoutes from "./routes/users.routes.js";
import depositRoutes from "./routes/deposits.routes.js";
import queryRoutes from "./routes/query.routes.js";


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
app.use(queryRoutes)

// ── Global error middleware ── must be after all routes, before the * fallback ──
app.use(async (err, req, res, next) => {
    console.error(`[${new Date().toISOString()}] Unhandled error on ${req.method} ${req.path}:`, err.message);
    sendErrorEmail(req, err, 'GlobalErrorHandler'); // fire-and-forget (not awaited)
    if (!res.headersSent) {
        res.status(500).json({ message: err.message || 'Error interno del servidor' });
    }
});
// ─────────────────────────────────────────────────────────────────────────────

// Serve static files from React build
app.use(express.static(join(__dirname, '../client/dist')))

// Fallback route: serve index.html for all other routes (React Router)
// This allows React Router to handle client-side routing
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, '../client/dist', 'index.html'));
});

app.listen(PORT)
console.log(`[${new Date().toISOString()}] BlackCoffe Server running on port ${PORT}`);
