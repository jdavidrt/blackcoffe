/*
 * Events routes (ADR §7).
 *   GET  /api/events/active   public     — resolver for the one active event
 *   GET  /api/events/:id      public     — event + active stage + cupos
 *   POST /api/events          organizer  — create (requireOrganizer)
 *   PUT  /api/events/:id       organizer  — edit   (requireOrganizer)
 *
 * `/active` is declared before `/:id` so it isn't swallowed by the param route.
 * Security pass (plan §6): the write routes mutate inventory and the single
 * active event, so they re-validate organizer credentials on every call, the
 * same per-request check used for /api/admin/*.
 */
import { Router } from 'express';
import { requireOrganizer } from '../middleware/requireOrganizer.js';
import {
  getActiveEvent,
  getEventById,
  createEvent,
  updateEvent,
} from '../controllers/events.controllers.js';

const router = Router();

router.get('/api/events/active', getActiveEvent);
router.get('/api/events/:id', getEventById);

router.post('/api/events', requireOrganizer, createEvent);
router.put('/api/events/:id', requireOrganizer, updateEvent);

export default router;
