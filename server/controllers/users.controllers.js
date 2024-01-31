import pool from '../db.js';

export const authenticate = async (req, res) => {
    try {
        const [result] = await pool.query("SELECT userName FROM users WHERE userName = ? AND pass = ?", [
            req.params.userName,
            req.params.pass
        ]);

        if (result.length > 0) {
            // Si se encuentra un usuario que coincide con las credenciales
            res.json(result[0]);
        } else {
            // Si no se encuentra un usuario que coincida con las credenciales
            res.json({ success: false, message: 'Credenciales incorrectas' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error en la autenticación' });
    }
};