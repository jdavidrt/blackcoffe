/*
 * ============================================================
 * SÍGALE — INTEGRATION SEAM  (shared-server build)
 *
 * The single mounting point between BlackCoffe's host Express
 * app and Sígale's self-contained subtree. The host calls:
 *
 *   import { mountSigale, startSigale } from './sigale/integration.js';
 *
 *   mountSigale(app);   // BEFORE express.static + app.get('*')
 *   ...
 *   app.listen(PORT, () => { ... startSigale(); });
 *
 * Order matters: Sígale's /api/* routers must mount before the
 * SPA fallback in index.js, or GETs get swallowed by index.html.
 *
 * Boot safety (plan §10): startSigale() catches its own errors
 * so a Sígale migration failure can NEVER take BlackCoffe down.
 * The error is logged and emailed via Sígale's notifier, then
 * swallowed; the host process keeps serving BlackCoffe traffic.
 * ============================================================
 */

import healthRoutes from './routes/health.routes.js';
import eventsRoutes from './routes/events.routes.js';
import purchasesRoutes from './routes/purchases.routes.js';
import adminRoutes from './routes/admin.routes.js';
import scanRoutes from './routes/scan.routes.js';

import { runMigrations } from './migrations/runMigrations.js';
import { startScheduler } from './jobs/scheduler.js';
import { sendErrorEmail } from './utils/emailNotifier.js';

/**
 * Mount every Sígale router on the host Express app.
 * All Sígale routes live under /api/* so they cannot collide
 * with BlackCoffe's unprefixed paths (orders, clients, products,
 * users, deposits, ping, query).
 *
 * @param {import('express').Express} app
 */
export function mountSigale(app) {
  app.use(healthRoutes);
  app.use(eventsRoutes);
  app.use(purchasesRoutes);
  app.use(adminRoutes);
  app.use(scanRoutes);
  console.log(`[${new Date().toISOString()}] [sigale] Routes mounted on host app`);
}

/**
 * Run Sígale migrations against the `sigale` schema, then start
 * the recurring jobs. Errors are caught and swallowed (plan §10)
 * — a Sígale boot failure must never crash BlackCoffe.
 */
export async function startSigale() {
  try {
    await runMigrations();
    startScheduler();
    console.log(`[${new Date().toISOString()}] [sigale] Boot complete (migrations + scheduler)`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] [sigale] Boot failed — BlackCoffe keeps serving:`, err.message);
    // Fire-and-forget: notifier never throws.
    sendErrorEmail({ method: 'BOOT', path: '/sigale/startup' }, err, 'startSigale');
  }
}

export default { mountSigale, startSigale };
