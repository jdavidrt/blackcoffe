/*
 * ============================================================
 * SÍGALE — GUEST PASSES CONTROLLER (organizer)
 * Free-entry roster for artists/crew/courtesy guests. Deliberately
 * separate from tickets/purchases: no price, no stage, no lifecycle,
 * no QR/scan integration — a plain name+ID list scoped to an event
 * and to a band from that event's own lineup, for door staff to
 * check manually.
 *
 * All handlers sit behind requireOrganizer (wired at the route).
 * ============================================================
 */

import pool from '../db.js';
import { sendErrorEmail } from '../utils/emailNotifier.js';
import { fromUtc } from '../utils/time.js';

const TYPES = ['artist', 'crew', 'courtesy'];
const MAX_BULK_ENTRIES = 200;

const cleanStr = (value, maxLen) => String(value ?? '').trim().slice(0, maxLen);

/**
 * GET /api/admin/guest-passes?eventId=
 * Every guest pass row for one event, grouped by band, newest first within each.
 */
export const listGuestPasses = async (req, res) => {
  try {
    const { eventId } = req.query;
    if (!eventId) return res.status(400).json({ message: 'eventId es requerido' });

    const [rows] = await pool.query(
      `SELECT id, eventId, band, holderName, holderIdNumber, type, ${fromUtc('createdAt', 'createdAt')}
       FROM guest_passes WHERE eventId = ? ORDER BY band, createdAt DESC, id DESC`,
      [eventId],
    );
    res.json(rows);
  } catch (error) {
    sendErrorEmail(req, error, 'listGuestPasses');
    return res.status(500).json({ message: error.message });
  }
};

/**
 * POST /api/admin/guest-passes
 * body: { eventId, band, holderName, holderIdNumber, type }
 */
export const createGuestPass = async (req, res) => {
  try {
    const { eventId, band, holderName, holderIdNumber, type } = req.body || {};
    if (!eventId) return res.status(400).json({ message: 'eventId es requerido' });
    if (!band || !String(band).trim()) return res.status(400).json({ message: 'Banda requerida' });
    if (!holderName || !String(holderName).trim()) return res.status(400).json({ message: 'Nombre requerido' });
    if (!holderIdNumber || !String(holderIdNumber).trim()) {
      return res.status(400).json({ message: 'Número de identificación requerido' });
    }
    if (!TYPES.includes(type)) return res.status(400).json({ message: 'Tipo inválido' });

    const cleanBand = cleanStr(band, 160);
    const cleanName = cleanStr(holderName, 160);
    const cleanId = cleanStr(holderIdNumber, 40);

    const [result] = await pool.query(
      `INSERT INTO guest_passes (eventId, band, holderName, holderIdNumber, type) VALUES (?, ?, ?, ?, ?)`,
      [eventId, cleanBand, cleanName, cleanId, type],
    );
    res.json({
      id: result.insertId,
      eventId: Number(eventId),
      band: cleanBand,
      holderName: cleanName,
      holderIdNumber: cleanId,
      type,
    });
  } catch (error) {
    sendErrorEmail(req, error, 'createGuestPass');
    return res.status(500).json({ message: error.message });
  }
};

/**
 * POST /api/admin/guest-passes/bulk
 * body: { eventId, band, type, entries: [{ holderName, holderIdNumber }, ...] }
 * Inserts every entry under the same band+type in one multi-row INSERT.
 */
export const createGuestPassesBulk = async (req, res) => {
  try {
    const { eventId, band, type, entries } = req.body || {};
    if (!eventId) return res.status(400).json({ message: 'eventId es requerido' });
    if (!band || !String(band).trim()) return res.status(400).json({ message: 'Banda requerida' });
    if (!TYPES.includes(type)) return res.status(400).json({ message: 'Tipo inválido' });
    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ message: 'La lista de invitados está vacía' });
    }
    if (entries.length > MAX_BULK_ENTRIES) {
      return res.status(400).json({ message: `Máximo ${MAX_BULK_ENTRIES} invitados por lote` });
    }

    const cleanBand = cleanStr(band, 160);
    const rows = entries
      .map((entry) => ({
        holderName: cleanStr(entry?.holderName, 160),
        holderIdNumber: cleanStr(entry?.holderIdNumber, 40),
      }))
      .filter((row) => row.holderName && row.holderIdNumber);

    if (rows.length === 0) {
      return res.status(400).json({ message: 'Ninguna fila tiene nombre e identificación válidos' });
    }

    const values = rows.flatMap((row) => [eventId, cleanBand, row.holderName, row.holderIdNumber, type]);
    const placeholders = rows.map(() => '(?, ?, ?, ?, ?)').join(', ');
    const [result] = await pool.query(
      `INSERT INTO guest_passes (eventId, band, holderName, holderIdNumber, type) VALUES ${placeholders}`,
      values,
    );

    const firstId = result.insertId;
    const guests = rows.map((row, i) => ({
      id: firstId + i,
      eventId: Number(eventId),
      band: cleanBand,
      holderName: row.holderName,
      holderIdNumber: row.holderIdNumber,
      type,
    }));
    res.json({ inserted: rows.length, guests });
  } catch (error) {
    sendErrorEmail(req, error, 'createGuestPassesBulk');
    return res.status(500).json({ message: error.message });
  }
};

/**
 * PATCH /api/admin/guest-passes/:id
 * body: any of { band, holderName, holderIdNumber, type }
 */
export const updateGuestPass = async (req, res) => {
  try {
    const { id } = req.params;
    const { band, holderName, holderIdNumber, type } = req.body || {};

    const sets = [];
    const values = [];
    if (band !== undefined) {
      if (!String(band).trim()) return res.status(400).json({ message: 'Banda requerida' });
      sets.push('band = ?');
      values.push(cleanStr(band, 160));
    }
    if (holderName !== undefined) {
      if (!String(holderName).trim()) return res.status(400).json({ message: 'Nombre requerido' });
      sets.push('holderName = ?');
      values.push(cleanStr(holderName, 160));
    }
    if (holderIdNumber !== undefined) {
      if (!String(holderIdNumber).trim()) return res.status(400).json({ message: 'Número de identificación requerido' });
      sets.push('holderIdNumber = ?');
      values.push(cleanStr(holderIdNumber, 40));
    }
    if (type !== undefined) {
      if (!TYPES.includes(type)) return res.status(400).json({ message: 'Tipo inválido' });
      sets.push('type = ?');
      values.push(type);
    }
    if (sets.length === 0) return res.status(400).json({ message: 'Nada para actualizar' });

    values.push(id);
    const [result] = await pool.query(`UPDATE guest_passes SET ${sets.join(', ')} WHERE id = ?`, values);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Registro no encontrado' });

    const [[row]] = await pool.query(
      `SELECT id, eventId, band, holderName, holderIdNumber, type, ${fromUtc('createdAt', 'createdAt')}
       FROM guest_passes WHERE id = ?`,
      [id],
    );
    res.json(row);
  } catch (error) {
    sendErrorEmail(req, error, 'updateGuestPass');
    return res.status(500).json({ message: error.message });
  }
};

/**
 * DELETE /api/admin/guest-passes/:id
 */
export const deleteGuestPass = async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM guest_passes WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Registro no encontrado' });
    res.json({ ok: true });
  } catch (error) {
    sendErrorEmail(req, error, 'deleteGuestPass');
    return res.status(500).json({ message: error.message });
  }
};
