import { Router } from "express";
import {
    getBackupDates,
    getBackupsByDate,
    restoreOrderFromSnapshot,
    getOrderRestores,
} from "../controllers/backups.controllers.js";

const router = Router();

router.get('/backupDates', getBackupDates);
router.get('/backupsByDate/:date', getBackupsByDate);
router.put('/order/:id/restore', restoreOrderFromSnapshot);
router.get('/orderRestores/:orderId', getOrderRestores);

export default router;
