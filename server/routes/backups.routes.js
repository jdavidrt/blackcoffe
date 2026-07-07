import { Router } from "express";
import {
    getBackupsByDate,
    restoreOrderFromSnapshot,
    getOrderRestores,
} from "../controllers/backups.controllers.js";

const router = Router();

router.get('/backupsByDate/:date', getBackupsByDate);
router.put('/order/:id/restore', restoreOrderFromSnapshot);
router.get('/orderRestores/:orderId', getOrderRestores);

export default router;
