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
    getDepositedOrdersByDate
} from "../controllers/orders.controllers.js"
const router = Router();

router.get('/orders/', getOrders);

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


export default router