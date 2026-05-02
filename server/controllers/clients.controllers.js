import pool from '../db.js'
import { sendErrorEmail } from '../utils/emailNotifier.js'
import { pickAndValidate, CLIENT_UPDATE_SCHEMA } from '../utils/validation.js'

export const getAllClients = async (req, res) => {
    try {
        const [result] = await pool.query("SELECT * FROM clients WHERE isDeleted = 0 ORDER BY CAST(premises AS SIGNED), clientname ASC")
        res.json(result)
    } catch (error) {
        sendErrorEmail(req, error, 'getAllClients');
        return res.status(500).json({ message: 'Error procesando la solicitud' });
    }
}

export const getClients = async (req, res) => {
    try {
        const [result] = await pool.query("SELECT id, premises, clientName, phoneNumber FROM clients WHERE mall = ? AND isDeleted = 0 ORDER BY CAST(premises AS SIGNED), clientname ASC", [
            req.params.mall,
        ]);
        res.json(result)
    } catch (error) {
        sendErrorEmail(req, error, 'getClients');
        return res.status(500).json({ message: 'Error procesando la solicitud' });
    }
}

export const getClient = async (req, res) => {
    try {
        const [result] = await pool.query("SELECT * FROM clients WHERE id = ?", [
            req.params.id,
        ]);

        if (result.length === 0)
            return res.status(404).json({ message: "Client not found" });

        res.json(result[0]);
    } catch (error) {
        sendErrorEmail(req, error, 'getClient');
        return res.status(500).json({ message: 'Error procesando la solicitud' });
    }
}

export const createClient = async (req, res) => {
    try {
        // Audit fix 2.7: validate before insert.
        const { value, errors } = pickAndValidate(req.body, CLIENT_UPDATE_SCHEMA);
        if (errors) return res.status(400).json({ message: errors[0] });

        const { premises, clientName, mall, phoneNumber } = value;
        if (!premises || !clientName || !mall) {
            return res.status(400).json({ message: 'premises, clientName y mall son requeridos' });
        }
        await pool.query(
            "INSERT INTO clients(premises, clientName, mall, phoneNumber) VALUES (?, ?, ?, ?)",
            [premises, clientName, mall, phoneNumber || null]
        );
        res.json({ premises, clientName, mall, phoneNumber: phoneNumber || null });
    } catch (error) {
        sendErrorEmail(req, error, 'createClient');
        // Audit fix 2.9 — do not leak SQL state.
        return res.status(500).json({ message: 'Error creando cliente' });
    }
}

export const updateClient = async (req, res) => {
    try {
        // Audit fix 2.7: whitelist allowed columns; isDeleted/deletedAt/etc. cannot be set this way.
        const { value, errors } = pickAndValidate(req.body, CLIENT_UPDATE_SCHEMA);
        if (errors) return res.status(400).json({ message: errors[0] });
        if (Object.keys(value).length === 0) {
            return res.status(400).json({ message: 'No hay campos válidos para actualizar' });
        }
        const result = await pool.query("UPDATE clients SET ? WHERE id = ?", [
            value,
            req.params.id,
        ]);
        res.json(result);
    } catch (error) {
        sendErrorEmail(req, error, 'updateClient');
        return res.status(500).json({ message: 'Error actualizando cliente' });
    }
}

export const deleteClient = async (req, res) => {
    try {
        const [result] = await pool.query(
            "UPDATE clients SET isDeleted = 1, deletedAt = NOW() WHERE id = ? AND isDeleted = 0",
            [req.params.id]
        );
        if (result.affectedRows === 0)
            return res.status(404).json({ message: "Client not found or already deleted" });
        return res.sendStatus(204);
    } catch (error) {
        sendErrorEmail(req, error, 'deleteClient');
        return res.status(500).json({ message: 'Error procesando la solicitud' });
    }
};

export const restoreClient = async (req, res) => {
    try {
        const [result] = await pool.query(
            "UPDATE clients SET isDeleted = 0, deletedAt = NULL WHERE id = ? AND isDeleted = 1",
            [req.params.id]
        );
        if (result.affectedRows === 0)
            return res.status(404).json({ message: "Client not found or not deleted" });
        return res.sendStatus(204);
    } catch (error) {
        sendErrorEmail(req, error, 'restoreClient');
        return res.status(500).json({ message: 'Error procesando la solicitud' });
    }
};

export const getDeletedClients = async (req, res) => {
    try {
        const [result] = await pool.query(
            "SELECT * FROM clients WHERE isDeleted = 1 ORDER BY deletedAt DESC"
        );
        res.json(result);
    } catch (error) {
        sendErrorEmail(req, error, 'getDeletedClients');
        return res.status(500).json({ message: 'Error procesando la solicitud' });
    }
};
