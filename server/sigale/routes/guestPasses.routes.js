/*
 * Guest-passes routes (organizer): artist/crew/courtesy free-entry roster.
 * Not part of the tickets/purchases pipeline — no price, no scan.
 *   GET    /api/admin/guest-passes?eventId=   organizer — list for one event
 *   POST   /api/admin/guest-passes            organizer — add one entry
 *   POST   /api/admin/guest-passes/bulk       organizer — add many entries (paste flow)
 *   PATCH  /api/admin/guest-passes/:id        organizer — edit an entry
 *   DELETE /api/admin/guest-passes/:id        organizer — remove an entry
 */
import { Router } from 'express';
import { requireOrganizer } from '../middleware/requireOrganizer.js';
import {
  listGuestPasses,
  createGuestPass,
  createGuestPassesBulk,
  updateGuestPass,
  deleteGuestPass,
} from '../controllers/guestPasses.controllers.js';

const router = Router();

router.get('/api/admin/guest-passes', requireOrganizer, listGuestPasses);
router.post('/api/admin/guest-passes', requireOrganizer, createGuestPass);
router.post('/api/admin/guest-passes/bulk', requireOrganizer, createGuestPassesBulk);
router.patch('/api/admin/guest-passes/:id', requireOrganizer, updateGuestPass);
router.delete('/api/admin/guest-passes/:id', requireOrganizer, deleteGuestPass);

export default router;
