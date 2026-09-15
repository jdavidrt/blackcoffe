/*
 * Door-scan routes.
 *   POST /api/admin/scan          organizer — mark one ticket used (API-only;
 *                                  no UI calls this anymore, kept for compat)
 *   GET  /api/scan/events         public, rate-limited — events open to public scan
 *   POST /api/scan                public, rate-limited — keyword + hash -> mark used
 * Each mark is idempotent and FOR UPDATE (ADR §6); see scan.controllers.js.
 * The old GET /api/admin/scan/manifest and POST /api/admin/scan/sync routes
 * (offline-cache design, no client ever called them) are removed — dead code,
 * not worth guarding under the new role model.
 */
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireOrganizer } from '../middleware/requireOrganizer.js';
import { scanTicket, listPublicScanEvents, publicScanTicket } from '../controllers/scan.controllers.js';

const router = Router();

// A busy door is roughly ~20 scans/minute; 120/min/IP leaves headroom for
// several devices behind the same NAT while still throttling a keyword
// brute-force attempt (migration 013's stated threat model).
const publicScanLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Demasiadas solicitudes, espera un momento' },
});

router.post('/api/admin/scan', requireOrganizer, scanTicket);

router.get('/api/scan/events', publicScanLimiter, listPublicScanEvents);
router.post('/api/scan', publicScanLimiter, publicScanTicket);

export default router;
