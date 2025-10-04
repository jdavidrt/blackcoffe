import { Router } from "express";
import {
    createOrder,
    getOrder,
    getCollectedOrders,
    getOrders,
    deleteOrder,
    updateOrder,
    getUnPaidOrders,
    getUnPaidOrdersbyClientId,
    getNotDeliveredOrders,
    getDeliveredOrders,
    getDepositedOrdersByDate,
    getOrphanedOrders,
    getAbandonedOrders,
    markOrderAsAbandoned,
    unmarkOrderAsAbandoned
} from "../controllers/orders.controllers.js"
const router = Router();

router.get('/orders/', getOrders);

router.get('/orphanedOrders/', getOrphanedOrders);

router.get('/notDeliveredOrders/', getNotDeliveredOrders);

router.get('/deliveredOrders/:date', getDeliveredOrders);

router.get('/collectedOrders/:date', getCollectedOrders);

router.get('/depositedOrdersByDate/:date', getDepositedOrdersByDate);

router.get('/unPaidOrders/:mall', getUnPaidOrders);

router.get('/unPaidOrdersByClient/:clientId', getUnPaidOrdersbyClientId);

router.get('/order/:id', getOrder);

router.post('/order', createOrder);

router.put('/order/:id', updateOrder);

router.delete('/order/:id', deleteOrder);

router.get('/abandonedOrders', getAbandonedOrders);

router.put('/order/:id/abandon', markOrderAsAbandoned);

router.put('/order/:id/reactivate', unmarkOrderAsAbandoned);

export default router