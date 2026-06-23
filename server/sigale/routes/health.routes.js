/*
 * Health route. GET /api/health is the Phase 0 connectivity probe
 * that src/api/client.js#health() targets. It does NOT touch the
 * database — it only proves the Express app is up and reachable
 * through CORS, so the frontend can verify wiring before any data
 * routes exist.
 */
import { Router } from 'express';

const router = Router();

router.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'sigale',
    time: new Date().toISOString(),
  });
});

export default router;
