import { Router } from "express";
import {
    getDeposits,
    getDepositsByOrder,
    createDeposit
} from "../controllers/deposits.controllers.js"
const router = Router();

router.get('/deposits', getDeposits);

router.get('/deposits/:id', getDepositsByOrder);

router.post('/deposits', createDeposit);


export default router