import { Router } from "express";
import { pool } from "../db.js"
import { sendErrorEmail } from "../utils/emailNotifier.js"
const router = Router();

router.get('/ping', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT 1 + 1 as result')
        res.json(rows)
    } catch (error) {
        sendErrorEmail(req, error, 'ping');
        res.status(500).json({ message: 'Error de conexión con la base de datos' })
    }
})

export default router;