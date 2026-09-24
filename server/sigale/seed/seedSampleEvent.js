/*
 * ============================================================
 * SÍGALE — SEED A SAMPLE EVENT (local testing only)
 * Manual, one-off script (NOT run automatically at boot):
 *
 *     node server/seed/seedSampleEvent.js
 *
 * Purpose: give a freshly migrated local `sigale` database one
 * published event (slug `prueba-local`, online sales open) with
 * two ticket stages, so the public purchase flow (reserve ->
 * submit -> confirm -> scan) is testable at /prueba-local on the
 * first boot without first building an event through /create-event.
 *
 * Mirrors events.controllers.js#createEvent:
 *   - Bogota wall-clock datetimes converted to UTC on write
 *     (CONVERT_TZ), so activatesAt <= UTC_TIMESTAMP() compares
 *     like with like.
 *   - Explicit column lists, DECIMAL prices, artists as JSON.
 *   - The first stage is seeded `active`; the second has no
 *     activatesAt, so the sold-out cascade promotes it.
 *
 * Idempotent: keyed on the event name. Re-running leaves the
 * existing sample event untouched.
 *
 * Requires DB_NAME=sigale (enforced by db.js).
 * ============================================================
 */

import pool from '../db.js';
import { BOGOTA, UTC } from '../utils/time.js';

// All datetimes below are Bogota wall-clock; the INSERTs convert them to UTC.
const SAMPLE = {
  slug: 'prueba-local',
  name: 'Noche Astromelias — Evento de Prueba',
  description: 'Evento sembrado para pruebas locales del flujo completo de Sígale.',
  artists: ['DJ Charly', 'Las Astromelias', 'Invitado Sorpresa'],
  eventDate: '2026-08-15 21:00:00', // 9:00 PM Bogota
  openingTime: '2026-08-15 20:00:00', // 8:00 PM Bogota (doors)
  venue: 'Teatro Local de Pruebas',
  venueCapacity: 200, // aforo: Sigma(stage.totalQuantity) must be <= this
  flyerImageUrl: null,
  bankQrImageUrl: null,
  whatsappNumber: '573001234567',
  stages: [
    // sortOrder, status, activatesAt (Bogota wall-clock or null)
    { name: 'Preventa', price: 50000, totalQuantity: 100, sortOrder: 0, status: 'active', activatesAt: null },
    { name: 'General', price: 70000, totalQuantity: 100, sortOrder: 1, status: 'upcoming', activatesAt: null },
  ],
};

async function seed() {
  const conn = await pool.getConnection();
  try {
    // Idempotency: bail if the sample event already exists.
    const [[existing]] = await conn.query('SELECT id FROM events WHERE name = ? LIMIT 1', [SAMPLE.name]);
    if (existing) {
      console.log(`[sigale/seed] Sample event already exists (id=${existing.id}) — left unchanged.`);
      return;
    }

    await conn.beginTransaction();

    const [result] = await conn.query(
      `INSERT INTO events
         (slug, name, description, artists, eventDate, openingTime, venue, venueCapacity,
          flyerImageUrl, bankQrImageUrl, whatsappNumber, isPublished, salesOpen)
       VALUES (?, ?, ?, CAST(? AS JSON),
               CONVERT_TZ(?, '${BOGOTA}', '${UTC}'),
               CONVERT_TZ(?, '${BOGOTA}', '${UTC}'),
               ?, ?, ?, ?, ?, 1, 1)`,
      [
        SAMPLE.slug,
        SAMPLE.name,
        SAMPLE.description,
        JSON.stringify(SAMPLE.artists),
        SAMPLE.eventDate,
        SAMPLE.openingTime,
        SAMPLE.venue,
        SAMPLE.venueCapacity,
        SAMPLE.flyerImageUrl,
        SAMPLE.bankQrImageUrl,
        SAMPLE.whatsappNumber,
      ],
    );

    const eventId = result.insertId;

    for (const s of SAMPLE.stages) {
      await conn.query(
        `INSERT INTO ticket_stages
           (eventId, name, price, totalQuantity, soldQuantity, reservedQuantity, sortOrder, activatesAt, status)
         VALUES (?, ?, ?, ?, 0, 0, ?, CONVERT_TZ(?, '${BOGOTA}', '${UTC}'), ?)`,
        [eventId, s.name, s.price, s.totalQuantity, s.sortOrder, s.activatesAt, s.status],
      );
    }

    await conn.commit();
    console.log(
      `[sigale/seed] Sample event '${SAMPLE.name}' created (id=${eventId}) ` +
        `with ${SAMPLE.stages.length} stages; '${SAMPLE.stages[0].name}' is active.`,
    );
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[sigale/seed] Failed:', err.message);
    process.exit(1);
  });
