import { Router } from "express";
import {
    createOrder,
    getOrder,
    getCollectedOrders,
    getOrders,
    deleteOrder,
    updateOrder,
    getUnPaidOrders,
    getUnPaidOrdersbyClientId
} from "../controllers/orders.controllers.js"
const router = Router();

router.get('/orders/:date', getOrders);

router.get('/collectedOrders/:date', getCollectedOrders);

router.get('/unPaidOrders/:mall', getUnPaidOrders);

router.get('/unPaidOrdersByClient/:clientId', getUnPaidOrdersbyClientId);

router.get('/order/:id', getOrder);

router.post('/order', createOrder);

router.put('/order/:id', updateOrder);

router.delete('/order/:id', deleteOrder);


export default router