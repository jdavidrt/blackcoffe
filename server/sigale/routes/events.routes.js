/*
 * Events routes (ADR §7, extended for multi-event).
 *   GET  /api/events/active     public     — deploy-window compat only; resolver
 *                                             for the old "one active event" (isActive)
 *   GET  /api/events/all        organizer  — every event, for the panel selector
 *   GET  /api/events/by-slug/:slug public  — event + active stage + cupos, by slug
 *   GET  /api/events            public     — published events, for the root landing grid
 *   GET  /api/events/:id        public     — event + active stage + cupos, by id
 *   POST /api/events            organizer  — create (requireOrganizer)
 *   PUT  /api/events/:id        organizer  — edit   (requireOrganizer)
 *
 * Route order matters: literal paths (/active, /all, /by-slug/:slug) must be
 * declared before the bare list (/) and the param route (/:id), or they'd be
 * swallowed as a slug/id value.
 * Security pass (plan §6): the write routes mutate inventory, so they
 * re-validate organizer credentials on every call, the same per-request
 * check used for /api/admin/*.
 */
import { Router } from 'express';
import { requireOrganizer } from '../middleware/requireOrganizer.js';
import {
  getActiveEvent,
  listAllEvents,
  getEventBySlug,
  listPublishedEvents,
  getEventById,
  createEvent,
  updateEvent,
} from '../controllers/events.controllers.js';

const router = Router();

router.get('/api/events/active', getActiveEvent);
router.get('/api/events/all', requireOrganizer, listAllEvents);
router.get('/api/events/by-slug/:slug', getEventBySlug);
router.get('/api/events', listPublishedEvents);
router.get('/api/events/:id', getEventById);

router.post('/api/events', requireOrganizer, createEvent);
router.put('/api/events/:id', requireOrganizer, updateEvent);

export default router;
