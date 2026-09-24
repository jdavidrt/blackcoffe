/*
 * Events routes.
 *   GET   /api/events/all            organizer  — events the caller can manage (role-scoped)
 *   GET   /api/events/by-slug/:slug  public     — event + stages + cupos, by slug
 *   GET   /api/events                public     — published events, for the root landing grid
 *   GET   /api/events/:id            public     — event + stages + cupos, by id
 *   POST  /api/events                super_admin — create
 *   PUT   /api/events/:id            organizer  — edit (assertOwnsEvent inside)
 *   PATCH /api/events/:id/archive    super_admin — archive / unarchive
 *
 * Route order matters: literal paths (/all, /by-slug/:slug) must be declared
 * before the bare list (/) and the param route (/:id). The write routes
 * re-validate organizer credentials on every call.
 */
import { Router } from 'express';
import { requireOrganizer, requireSuperAdmin } from '../middleware/requireOrganizer.js';
import {
  listAllEvents,
  getEventBySlug,
  listPublishedEvents,
  getEventById,
  createEvent,
  updateEvent,
  archiveEvent,
} from '../controllers/events.controllers.js';

const router = Router();

router.get('/api/events/all', requireOrganizer, listAllEvents);
router.get('/api/events/by-slug/:slug', getEventBySlug);
router.get('/api/events', listPublishedEvents);
router.get('/api/events/:id', getEventById);

router.post('/api/events', requireOrganizer, requireSuperAdmin, createEvent);
router.put('/api/events/:id', requireOrganizer, updateEvent);
router.patch('/api/events/:id/archive', requireOrganizer, requireSuperAdmin, archiveEvent);

export default router;
