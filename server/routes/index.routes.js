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

// Timeouts, dropped connections and Render 502/503s never reach a controller, so no
// catch block emails about them. client/src/main.jsx reports them here instead.
router.post('/clientError', (req, res) => {
    const { error, request } = req.body || {};
    sendErrorEmail(req, { message: `${error} — ${request}`.slice(0, 300) }, 'clientError');
    res.sendStatus(204);
})

export default router;