/*
 * Purchases routes (public, one-way).
 *   POST /api/purchases                    — transactional reserve
 *   POST /api/purchases/:orderId/submitted — "ya realicé el pago"
 * Tickets are delivered by the organizer via WhatsApp/email after
 * confirmation; there is no public order-status endpoint.
 */
import { Router } from 'express';
import {
  createPurchase,
  submitPayment,
} from '../controllers/purchases.controllers.js';

const router = Router();

router.post('/api/purchases', createPurchase);
router.post('/api/purchases/:orderId/submitted', submitPayment);

export default router;
