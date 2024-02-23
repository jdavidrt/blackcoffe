import { Router } from "express";
import {
    getDeposits,
    getDepositsByOrder,
    createDeposit,
    getDepositsByDate
} from "../controllers/deposits.controllers.js"
const router = Router();

router.get('/deposits', getDeposits);

router.get('/deposits/:id', getDepositsByOrder);

router.get('/depositsByDate/:date', getDepositsByDate);

router.get('/deposits', getDeposits);

router.post('/deposits', createDeposit);


export default router