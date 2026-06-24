/*
 * ============================================================
 * SÍGALE — EXPRESS ENTRY POINT
 * Mirrors current-server/index.js (BlackCoffe) but is a fully
 * SEPARATE app: its own pool (db.js → DB_NAME=sigale), its own
 * migrations, its own routes. It must never import or run any
 * file under server/current-server/ (read-only BlackCoffe ref).
 *
 * Boot order matches BlackCoffe: runMigrations() resolves before
 * app.listen() so the schema exists before the first request.
 * ============================================================
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import { PORT } from './config.js';
import { sendErrorEmail } from './utils/emailNotifier.js';
import { runMigrations } from './migrations/runMigrations.js';
import { startScheduler } from './jobs/scheduler.js';

import healthRoutes from './routes/health.routes.js';
import eventsRoutes from './routes/events.routes.js';
import purchasesRoutes from './routes/purchases.routes.js';
import adminRoutes from './routes/admin.routes.js';
import scanRoutes from './routes/scan.routes.js';

const app = express();

app.use(helmet());

// CORS — Sígale origins only. Add the production frontend domain here
// when it is known (the shared server's CORS list must include it).
app.use(
  cors({
    origin: [
      'http://localhost:5173', // Vite dev server
      'http://localhost:25060', // local backend
      // 'https://sigale.onrender.com', // TODO: Sígale production frontend
    ],
    credentials: true,
  }),
);

// Cap request bodies (plan §6): no endpoint needs more than a small JSON
// payload, so an oversized body is rejected (413) before it reaches a handler.
app.use(express.json({ limit: '64kb' }));

// ── Routes ─────────────────────────────────────────────────────────────────────
app.use(healthRoutes);
app.use(eventsRoutes);
app.use(purchasesRoutes);
app.use(adminRoutes);
app.use(scanRoutes);

// ── Global error middleware ── after all routes ─────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] [sigale] Unhandled error on ${req.method} ${req.path}:`, err.message);
  sendErrorEmail(req, err, 'GlobalErrorHandler'); // fire-and-forget (not awaited)
  if (!res.headersSent) {
    res.status(500).json({ message: err.message || 'Error interno del servidor' });
  }
});

// ── Boot: migrate, then listen ──────────────────────────────────────────────────
runMigrations()
  .then(() => {
    app.listen(PORT);
    console.log(`[${new Date().toISOString()}] [sigale] Server running on port ${PORT}`);
    // Recurring jobs (Phase 5): auto-activate stages + sweep abandoned holds.
    startScheduler();
  })
  .catch((err) => {
    console.error(`[${new Date().toISOString()}] [sigale] Migrations failed, server not started:`, err.message);
    process.exit(1);
  });
