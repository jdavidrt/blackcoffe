/*
 * integration.js
 * Adapter that lets BlackCoffe's shared Express app host Sígale routes.
 *
 * BlackCoffe's server/index.js calls:
 *   import { mountSigale, startSigale } from './sigale/integration.js'
 *   mountSigale(app);          // synchronous: registers routes
 *   startSigale();             // async, fire-and-forget: migrations + scheduler
 *
 * Rules:
 *  - mountSigale() must NOT add a second helmet(), cors(), or express.json()
 *    — BlackCoffe's app already has those.
 *  - startSigale() is wrapped in try/catch so a Sigale boot failure never
 *    takes BlackCoffe down (plan S10 rollback safety).
 */

import healthRoutes from './routes/health.routes.js';
import eventsRoutes from './routes/events.routes.js';
import purchasesRoutes from './routes/purchases.routes.js';
import adminRoutes from './routes/admin.routes.js';
import scanRoutes from './routes/scan.routes.js';

import { runMigrations } from './migrations/runMigrations.js';
import { startScheduler } from './jobs/scheduler.js';

/**
 * Mount all Sigale routes onto the shared BlackCoffe Express app.
 * Call this BEFORE express.static + the SPA fallback route in BlackCoffe's index.js.
 *
 * @param {import('express').Application} app
 */
export function mountSigale(app) {
  app.use(healthRoutes);
  app.use(eventsRoutes);
  app.use(purchasesRoutes);
  app.use(adminRoutes);
  app.use(scanRoutes);
  console.log(`[${new Date().toISOString()}] [sigale] Routes mounted on shared app`);
}

/**
 * Run Sigale DB migrations and start the cron scheduler.
 * Designed to be called as fire-and-forget after BlackCoffe's own migrations resolve.
 * Errors are logged and swallowed so BlackCoffe keeps running if Sigale fails to boot.
 */
export async function startSigale() {
  try {
    await runMigrations();
    startScheduler();
    console.log(`[${new Date().toISOString()}] [sigale] Migrations complete, scheduler started`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] [sigale] Boot failed (BlackCoffe unaffected):`, err.message);
  }
}
