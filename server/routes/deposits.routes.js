import { Router } from "express";
import {
    getDepositsByOrder,
    createDeposit,
    deleteDeposit,
    getDepositsByDate
} from "../controllers/deposits.controllers.js"
const router = Router();

// GET /deposits (every deposit ever, joined with each order's full items: tens of MB) was removed
// 2026-09-26: nothing called it, and one request ran the 512 MB instance out of memory.

router.get('/deposits/:id', getDepositsByOrder);

router.delete('/deposits/:id', deleteDeposit);

router.get('/depositsByDate/:date', getDepositsByDate);

router.post('/deposits', createDeposit);


export default router