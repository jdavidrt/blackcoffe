/*
 * requireOrganizer — per-request credential check (locked decision #5:
 * no JWT/session). Reads HTTP Basic credentials, bcrypt-compares the
 * password against the organizers row. HTTPS-only in production so the
 * header isn't exposed. Attach to every /api/admin/* route and to the
 * organizer-only event writes.
 *
 * Security pass (plan §6): `verifyOrganizer` is the single credential
 * check shared with POST /api/login. When the username does not exist it
 * still runs a bcrypt.compare against a fixed dummy hash, so a missing
 * user and a wrong password take the same time — no username enumeration
 * through response latency.
 */
import bcrypt from 'bcryptjs';
import pool from '../db.js';

// Fixed hash of a throwaway value. Comparing against it for unknown users
// keeps the timing identical to the wrong-password path (it never matches).
const DUMMY_HASH = '$2a$12$8AlCy6IHo6C3xI.jXtqpa.PrdjiTaYcODntdfnez/8mNHghkMbGwW';

/** Parse a Basic auth header into { username, password } or null. */
function parseBasic(header) {
  if (!header || !header.startsWith('Basic ')) return null;
  try {
    const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
    const i = decoded.indexOf(':');
    if (i < 0) return null;
    return { username: decoded.slice(0, i), password: decoded.slice(i + 1) };
  } catch {
    return null;
  }
}

/**
 * Validate a username/password pair against the organizers table in
 * constant-ish time. Returns the organizer ({ id, username }) on success,
 * or null on any failure. Always performs exactly one bcrypt.compare.
 */
export async function verifyOrganizer(username, password) {
  if (!username || !password) {
    await bcrypt.compare(password || '', DUMMY_HASH); // keep timing flat
    return null;
  }
  const [[organizer]] = await pool.query(
    'SELECT id, username, passwordHash FROM organizers WHERE username = ? LIMIT 1',
    [username],
  );
  const hash = organizer ? organizer.passwordHash : DUMMY_HASH;
  const ok = await bcrypt.compare(password, hash);
  if (!organizer || !ok) return null;
  return { id: organizer.id, username: organizer.username };
}

export async function requireOrganizer(req, res, next) {
  const creds = parseBasic(req.headers.authorization);
  if (!creds) {
    return res.status(401).json({ message: 'Credenciales requeridas' });
  }
  try {
    const organizer = await verifyOrganizer(creds.username, creds.password);
    if (!organizer) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }
    req.organizer = organizer;
    next();
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export default requireOrganizer;
