/*
 * Door-scan routes (Phase 4, offline-first). All organizer-only — the
 * scanner re-sends Basic creds on every call (locked auth model #5).
 *   GET  /api/admin/scan/manifest?eventId=  organizer — offline cache seed
 *   POST /api/admin/scan                    organizer — mark one ticket used
 *   POST /api/admin/scan/sync               organizer — batch reconcile queue
 * Each mark is idempotent and FOR UPDATE (ADR §6); see scan.controllers.js.
 */
import { Router } from 'express';
import { requireOrganizer } from '../middleware/requireOrganizer.js';
import { getScanManifest, scanTicket, syncScans } from '../controllers/scan.controllers.js';

const router = Router();

router.get('/api/admin/scan/manifest', requireOrganizer, getScanManifest);
router.post('/api/admin/scan', requireOrganizer, scanTicket);
router.post('/api/admin/scan/sync', requireOrganizer, syncScans);

export default router;
