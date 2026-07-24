/*
 * Admin + auth routes (ADR §7, locked auth model #5).
 *   POST   /api/login                          public     — bcrypt check, rate-limited
 *   GET    /api/admin/purchases                organizer  — review table
 *   DELETE /api/admin/purchases                organizer  — hard-reset all confirmed purchases+tickets
 *   POST   /api/admin/purchases/:orderId/confirm organizer  — reserved->sold, seal every row of the order
 *   POST   /api/admin/purchases/:orderId/reject  organizer  — free cupo
 *   POST   /api/admin/sales                    organizer  — walk-in
 * Every /api/admin/* call re-validates credentials via requireOrganizer.
 */
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireOrganizer } from '../middleware/requireOrganizer.js';
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
router.delete('/api/admin/purchases', requireOrganizer, deleteAllPurchases);
router.get('/api/admin/tickets', requireOrganizer, getAdminTickets);
router.patch('/api/admin/tickets/:id', requireOrganizer, updateAdminTicket);
router.patch('/api/admin/tickets/:id/stage', requireOrganizer, moveAdminTicketStage);
router.delete('/api/admin/tickets/:id', requireOrganizer, deleteAdminTicket);
router.post('/api/admin/purchases/:orderId/confirm', requireOrganizer, confirmPurchase);
router.post('/api/admin/purchases/:orderId/reject', requireOrganizer, rejectPurchase);
router.post('/api/admin/sales', requireOrganizer, createWalkInSale);

export default router;
