/*
 * Organizer-account routes (Phase 2: roles). Every handler is super_admin-
 * only — account management is not something an event_admin ever touches.
 *   GET   /api/admin/organizers            list every account
 *   POST  /api/admin/organizers            create an account
 *   PATCH /api/admin/organizers/:id        change role / isActive / password
 *   PUT   /api/admin/organizers/:id/events replace an account's event assignments
 */
import { Router } from 'express';
import { requireOrganizer, requireSuperAdmin } from '../middleware/requireOrganizer.js';
import {
  listOrganizers,
  createOrganizer,
  updateOrganizer,
  updateOrganizerEvents,
} from '../controllers/organizers.controllers.js';

const router = Router();

router.get('/api/admin/organizers', requireOrganizer, requireSuperAdmin, listOrganizers);
router.post('/api/admin/organizers', requireOrganizer, requireSuperAdmin, createOrganizer);
router.patch('/api/admin/organizers/:id', requireOrganizer, requireSuperAdmin, updateOrganizer);
router.put('/api/admin/organizers/:id/events', requireOrganizer, requireSuperAdmin, updateOrganizerEvents);

export default router;
