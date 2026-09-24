/*
 * Admin + auth routes.
 *   POST   /api/login                              public      — bcrypt check, rate-limited
 *   GET    /api/admin/purchases?eventId=           organizer   — one row per order
 *   DELETE /api/admin/purchases?eventId=           super_admin — event-scoped delete-all
 *   POST   /api/admin/purchases/:orderId/confirm   organizer   — reserved->sold, mint hashes
 *   POST   /api/admin/purchases/:orderId/reject    organizer   — free cupo
 *   POST   /api/admin/sales                        organizer   — walk-in
 *   GET    /api/admin/tickets?status=&eventId=     organizer   — ticket rows + stage
 *   PATCH  /api/admin/tickets/:id                  organizer   — edit holder fields
 *   PATCH  /api/admin/tickets/:id/stage            organizer   — move stage
 *   DELETE /api/admin/tickets/:id                  organizer   — confirmed rows only
 * Every /api/admin/* call re-validates credentials via requireOrganizer.
 */
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireOrganizer, requireSuperAdmin } from '../middleware/requireOrganizer.js';
import {
  login,
  getAdminPurchases,
  getAdminTickets,
  confirmPurchase,
  rejectPurchase,
  createWalkInSale,
  updateAdminTicket,
  moveAdminTicketStage,
  deleteAllPurchases,
  deleteAdminTicket,
} from '../controllers/admin.controllers.js';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Demasiados intentos de ingreso, espera un minuto' },
});

router.post('/api/login', loginLimiter, login);

router.get('/api/admin/purchases', requireOrganizer, getAdminPurchases);
router.delete('/api/admin/purchases', requireOrganizer, requireSuperAdmin, deleteAllPurchases);
router.get('/api/admin/tickets', requireOrganizer, getAdminTickets);
router.patch('/api/admin/tickets/:id', requireOrganizer, updateAdminTicket);
router.patch('/api/admin/tickets/:id/stage', requireOrganizer, moveAdminTicketStage);
router.delete('/api/admin/tickets/:id', requireOrganizer, deleteAdminTicket);
router.post('/api/admin/purchases/:orderId/confirm', requireOrganizer, confirmPurchase);
router.post('/api/admin/purchases/:orderId/reject', requireOrganizer, rejectPurchase);
router.post('/api/admin/sales', requireOrganizer, createWalkInSale);

export default router;
