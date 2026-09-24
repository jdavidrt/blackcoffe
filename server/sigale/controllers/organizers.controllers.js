/*
 * ============================================================
 * SÍGALE — ORGANIZERS CONTROLLER (account management)
 * Every handler here sits behind requireOrganizer + requireSuperAdmin at
 * the route layer — only a super_admin manages accounts. Passwords are
 * always bcrypt-hashed before they touch the database; passwordHash is
 * never selected back out.
 * ============================================================
 */

import bcrypt from 'bcryptjs';
import pool from '../db.js';
import { sendErrorEmail } from '../utils/emailNotifier.js';

const ROLES = ['super_admin', 'event_admin'];
const MIN_PASSWORD_LEN = 8;

/** Count active super_admins, optionally excluding one id (for a pending demotion/deactivation check). */
async function countOtherActiveSuperAdmins(conn, excludeId) {
  const [[row]] = await conn.query(
    "SELECT COUNT(*) AS n FROM organizers WHERE role = 'super_admin' AND isActive = 1 AND id != ?",
    [excludeId || 0],
  );
  return Number(row.n);
}

/**
 * GET /api/admin/organizers
 * Every account, with its assigned event ids, never the password hash.
 */
export const listOrganizers = async (req, res) => {
  try {
    const [orgs] = await pool.query(
      'SELECT id, username, role, isActive, createdAt FROM organizers ORDER BY createdAt ASC',
    );
    const [assignments] = await pool.query('SELECT organizerId, eventId FROM organizer_events');
    const eventsByOrganizer = {};
    for (const a of assignments) {
      (eventsByOrganizer[a.organizerId] ||= []).push(a.eventId);
    }
    res.json(orgs.map((o) => ({ ...o, eventIds: eventsByOrganizer[o.id] || [] })));
  } catch (error) {
    sendErrorEmail(req, error, 'listOrganizers');
    return res.status(500).json({ message: error.message });
  }
};

/**
 * POST /api/admin/organizers
 * body: { username, password, role }. Duplicate username -> 409.
 */
export const createOrganizer = async (req, res) => {
  try {
    const { username, password, role } = req.body || {};
    const cleanUsername = String(username || '').trim();
    if (!cleanUsername) return res.status(400).json({ message: 'Usuario requerido' });
    if (!password || String(password).length < MIN_PASSWORD_LEN) {
      return res.status(400).json({ message: `La contraseña debe tener al menos ${MIN_PASSWORD_LEN} caracteres` });
    }
    const cleanRole = ROLES.includes(role) ? role : 'event_admin';

    const passwordHash = await bcrypt.hash(String(password), 12);
    const [result] = await pool.query(
      'INSERT INTO organizers (username, passwordHash, role, isActive) VALUES (?, ?, ?, 1)',
      [cleanUsername, passwordHash, cleanRole],
    );
    res.status(201).json({
      id: result.insertId,
      username: cleanUsername,
      role: cleanRole,
      isActive: true,
      eventIds: [],
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Ese usuario ya existe' });
    }
    sendErrorEmail(req, error, 'createOrganizer');
    return res.status(500).json({ message: error.message });
  }
};

/**
 * PATCH /api/admin/organizers/:id
 * body: any of { role, isActive, password }.
 * Guards: a caller cannot change its own role or isActive, and no write may
 * leave zero active super_admins.
 */
export const updateOrganizer = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const targetId = Number(req.params.id);
    const { role, isActive, password } = req.body || {};

    const [[target]] = await conn.query(
      'SELECT id, role, isActive FROM organizers WHERE id = ? FOR UPDATE',
      [targetId],
    );
    if (!target) {
      await conn.rollback();
      return res.status(404).json({ message: 'Cuenta no encontrada' });
    }

    const changingRole = role !== undefined && role !== target.role;
    const changingActive = isActive !== undefined && !!isActive !== !!target.isActive;
    if ((changingRole || changingActive) && targetId === req.organizer?.id) {
      await conn.rollback();
      return res.status(409).json({ message: 'No puedes cambiar tu propio rol o estado' });
    }

    const updates = [];
    const params = [];
    if (role !== undefined) {
      if (!ROLES.includes(role)) {
        await conn.rollback();
        return res.status(400).json({ message: 'Rol inválido' });
      }
      // Demoting the last active super_admin would lock everyone out of
      // account/event management — refuse it (409, matching the demo /
      // stage-invariant style of "this write would break an invariant").
      if (target.role === 'super_admin' && role !== 'super_admin' && Number(target.isActive) === 1) {
        const others = await countOtherActiveSuperAdmins(conn, targetId);
        if (others === 0) {
          await conn.rollback();
          return res.status(409).json({ message: 'Debe quedar al menos un administrador general activo' });
        }
      }
      updates.push('role = ?');
      params.push(role);
    }
    if (isActive !== undefined) {
      const nextActive = isActive ? 1 : 0;
      if (target.role === 'super_admin' && Number(target.isActive) === 1 && nextActive === 0) {
        const others = await countOtherActiveSuperAdmins(conn, targetId);
        if (others === 0) {
          await conn.rollback();
          return res.status(409).json({ message: 'Debe quedar al menos un administrador general activo' });
        }
      }
      updates.push('isActive = ?');
      params.push(nextActive);
    }
    if (password !== undefined) {
      if (String(password).length < MIN_PASSWORD_LEN) {
        await conn.rollback();
        return res.status(400).json({ message: `La contraseña debe tener al menos ${MIN_PASSWORD_LEN} caracteres` });
      }
      updates.push('passwordHash = ?');
      params.push(await bcrypt.hash(String(password), 12));
    }
    if (updates.length === 0) {
      await conn.rollback();
      return res.status(400).json({ message: 'Nada que actualizar' });
    }

    params.push(targetId);
    await conn.query(`UPDATE organizers SET ${updates.join(', ')} WHERE id = ?`, params);
    await conn.commit();

    const [[row]] = await pool.query(
      'SELECT id, username, role, isActive, createdAt FROM organizers WHERE id = ?',
      [targetId],
    );
    res.json(row);
  } catch (error) {
    await conn.rollback();
    sendErrorEmail(req, error, 'updateOrganizer');
    return res.status(500).json({ message: error.message });
  } finally {
    conn.release();
  }
};

/**
 * PUT /api/admin/organizers/:id/events
 * body: { eventIds: [] } — replaces the account's organizer_events rows
 * wholesale. Meaningful only for event_admins (a super_admin's rows are
 * attribution-only), but not blocked either way.
 */
export const updateOrganizerEvents = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const targetId = Number(req.params.id);
    const eventIds = Array.isArray(req.body?.eventIds)
      ? [...new Set(req.body.eventIds.map(Number).filter((n) => Number.isInteger(n) && n > 0))]
      : [];

    const [[target]] = await conn.query('SELECT id FROM organizers WHERE id = ? FOR UPDATE', [targetId]);
    if (!target) {
      await conn.rollback();
      return res.status(404).json({ message: 'Cuenta no encontrada' });
    }

    await conn.query('DELETE FROM organizer_events WHERE organizerId = ?', [targetId]);
    if (eventIds.length > 0) {
      const values = eventIds.map((eventId) => [targetId, eventId]);
      await conn.query('INSERT INTO organizer_events (organizerId, eventId) VALUES ?', [values]);
    }

    await conn.commit();
    res.json({ ok: true, eventIds });
  } catch (error) {
    await conn.rollback();
    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({ message: 'Uno de los eventos no existe' });
    }
    sendErrorEmail(req, error, 'updateOrganizerEvents');
    return res.status(500).json({ message: error.message });
  } finally {
    conn.release();
  }
};
