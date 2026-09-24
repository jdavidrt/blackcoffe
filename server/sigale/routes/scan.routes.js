/*
 * Door-scan routes (public, rate-limited).
 *   GET  /api/scan/events  — events open to public scan
 *   POST /api/scan         — keyword + hash -> mark used
 * Each mark is idempotent and FOR UPDATE; see scan.controllers.js.
 */
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { listPublicScanEvents, publicScanTicket } from '../controllers/scan.controllers.js';

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

router.get('/api/scan/events', publicScanLimiter, listPublicScanEvents);
router.post('/api/scan', publicScanLimiter, publicScanTicket);

export default router;
