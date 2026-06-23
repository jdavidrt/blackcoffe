/*
 * Purchases routes (ADR §7).
 *   POST /api/purchases                    public  — transactional reserve
 *   POST /api/purchases/:orderId/submitted public  — "ya realicé el pago"
 *
 * The public status (`GET /api/purchases/:orderId`) and recovery
 * (`GET /api/recover`) endpoints were removed: buyers no longer have a
 * "Ver el estado de mi compra" page. Tickets are delivered by the
 * organizer via WhatsApp/email after confirmation.
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
