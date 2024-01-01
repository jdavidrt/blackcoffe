import { Router } from "express";
import {
    createOrder,
    getOrder,
    getOrders,
    deleteOrder,
    updateOrder
} from "../controllers/orders.controllers.js"
const router = Router();

router.get('/orders/:date', getOrders);

router.get('/order/:id', getOrder);


router.post('/order', createOrder);

router.put('/order/:id', updateOrder);

router.delete('/order/:id', deleteOrder);


export default router