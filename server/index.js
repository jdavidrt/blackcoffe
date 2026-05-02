import express from "express";
import cors from "cors";
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { PORT, ALLOWED_ORIGINS, IS_PRODUCTION } from "./config.js";
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

// CORS configuration — allow-list driven from env (audit fix 2.6).
// In production, ALLOWED_ORIGINS env var (comma-separated) is the source of truth;
// in dev, localhost ports are auto-included. See server/config.js.
app.use(cors({
  origin: (origin, callback) => {
    // Allow same-origin / curl / mobile apps (no Origin header) only when not in prod,
    // OR for the "/factura/:id" public invoice path (handled by middleware order — this
    // CORS check runs before routes, so we keep it permissive for null-origin in dev).
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    console.warn(`[CORS] Rejected origin: ${origin}`);
    return callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true
}));
console.log(`[${new Date().toISOString()}] CORS allow-list (${IS_PRODUCTION ? 'prod' : 'dev'}):`, ALLOWED_ORIGINS);

app.use(express.json())
app.use(indexRoutes)
app.use(ordersRoutes)
app.use(productRoutes)
app.use(depositRoutes)
app.use(clientRoutes)
app.use(userRoutes)
app.use(queryRoutes)

// ── Global error middleware ── must be after all routes, before the * fallback ──
// Audit fix 2.9: never leak err.message (which often contains SQL state, table
// names, or stack hints). Log full detail server-side, send a generic body.
app.use(async (err, req, res, next) => {
    console.error(`[${new Date().toISOString()}] Unhandled error on ${req.method} ${req.path}:`, err.message);
    sendErrorEmail(req, err, 'GlobalErrorHandler'); // fire-and-forget (not awaited)
    if (!res.headersSent) {
        res.status(500).json({ message: 'Error interno del servidor' });
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
