/*
 * ============================================================
 * SÍGALE — SHARED AUTHORIZATION HELPERS (Phase 2: roles + demo)
 * Two per-event guards used across every mutating/scoped admin
 * controller. Both take an open connection/pool and an eventId,
 * and return a Spanish error message (or null) rather than
 * writing the response themselves — callers roll back their own
 * transaction and respond, matching the existing inline-guard
 * style in admin.controllers.js.
 * ============================================================
 */

/**
 * Multi-event read-only-demo guard. Returns a Spanish 409 message when the
 * given event is the permanent demo, else null. Must be called by EVERY
 * mutating admin path that touches tickets/ticket_stages for a specific
 * event; `markUsed` in scan.controllers.js is the one deliberate exception
 * (scanning the seeded demo tickets is the point of the demo, and the write
 * is reversible by the nightly rearm job).
 */
export async function assertNotDemo(conn, eventId) {
  const [[event]] = await conn.query('SELECT isDemo FROM events WHERE id = ?', [eventId]);
  return event?.isDemo ? 'El evento de demostración es de solo lectura' : null;
}

/**
 * Role-based event-ownership guard (Phase 2). `organizer` is `req.organizer`
 * ({ id, username, role }) as set by requireOrganizer. A `super_admin`
 * always passes (role check only — no query). An `event_admin` needs a row
 * in `organizer_events` for this event, else a Spanish 403 message.
 *
 * Same calling convention as assertNotDemo: returns a message string (or
 * null), never writes the response itself.
 */
export async function assertOwnsEvent(conn, organizer, eventId) {
  if (!organizer) return 'Credenciales requeridas';
  if (organizer.role === 'super_admin') return null;
  if (!eventId) return 'No tienes acceso a este evento';
  const [[row]] = await conn.query(
    'SELECT 1 FROM organizer_events WHERE organizerId = ? AND eventId = ? LIMIT 1',
    [organizer.id, eventId],
  );
  return row ? null : 'No tienes acceso a este evento';
}

export default { assertNotDemo, assertOwnsEvent };
