/*
 * ============================================================
 * SÍGALE — SEED FROM 1.0 localStorage EXPORT (migration helper)
 *
 * Reads a JSON file produced by the 1.0 app's /copy-event export
 * (the value stored under the `sigale-event-data` key) and inserts
 * the event + tickets into the 2.0 MySQL schema.
 *
 * Usage (from the repo root, after DB is up):
 *   node --env-file=.env server/seed/seedFromLocalStorage.js <path-to-export.json>
 *
 * Or from server/:
 *   node --env-file=.env seed/seedFromLocalStorage.js <path>
 *
 * What it does:
 *   1. Demotes any current active event.
 *   2. Inserts the event and creates one ticket_stage per ticketType.
 *   3. For every 1.0 ticket: one purchases row (status='confirmed',
 *      quantity=1) + one tickets row (preserving the original validationHash).
 *
 * Idempotent on the EVENT: if an event with the same name already exists
 * it is left untouched and the script exits. Tickets are NOT individually
 * idempotent — do not run twice against the same DB without clearing first.
 *
 * Requires DB_NAME=sigale (enforced by db.js).
 * ============================================================
 */

import fs from 'fs';
import path from 'path';
import pool from '../db.js';
import { BOGOTA, UTC, toSqlUtc } from '../utils/time.js';

// ---------------------------------------------------------------------------
// Read the input file
// ---------------------------------------------------------------------------
const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Usage: node seed/seedFromLocalStorage.js <path-to-export.json>');
  process.exit(1);
}

const raw = fs.readFileSync(path.resolve(inputPath), 'utf-8');
const exported = JSON.parse(raw);

// Support both the raw storage blob { event, tickets } and
// a wrapping object in case the user copied the whole localStorage dump.
const data = exported.event ? exported : exported['sigale-event-data'];
if (!data?.event) {
  console.error('[seed] Could not find event data in the JSON file. Expected { event, tickets } structure.');
  process.exit(1);
}

const { event, tickets = [] } = data;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Combine the 1.0 date string (YYYY-MM-DD) and time string (HH:mm)
 * into a 'YYYY-MM-DD HH:mm:ss' wall-clock string in Bogotá.
 */
function bogotaDatetime(dateStr, timeStr = '00:00') {
  return `${dateStr} ${timeStr}:00`;
}

/**
 * Pad a short validationHash to 32 hex chars (the 2.0 minimum).
 * The 1.0 hash is 16 chars; we right-pad with '0's so we can store
 * it in the CHAR(64) column without MySQL treating it as a CHAR pad.
 * The scanner will look up by this exact value.
 */
function padHash(hash) {
  return hash.padEnd(32, '0');
}

/**
 * Zero-pad a number to produce a 3-char orderId (e.g. 1 → '001').
 * CHAR(3) fits up to 999. Overflow is caught before the INSERT.
 */
function orderId(n) {
  if (n > 999) throw new Error(`Too many tickets for CHAR(3) orderId: ${n}`);
  return String(n).padStart(3, '0');
}

// ---------------------------------------------------------------------------
// Main seed
// ---------------------------------------------------------------------------
async function seed() {
  const conn = await pool.getConnection();
  try {
    // ── Idempotency check ─────────────────────────────────────────────────────
    const [[existing]] = await conn.query(
      'SELECT id FROM events WHERE name = ? LIMIT 1',
      [event.name],
    );
    if (existing) {
      console.log(`[seed] Event '${event.name}' already exists (id=${existing.id}) — left unchanged.`);
      console.log('[seed] To re-import, delete the existing event from the DB first.');
      return;
    }

    await conn.beginTransaction();

    // ── Demote any currently active event ────────────────────────────────────
    await conn.query('UPDATE events SET isActive = 0 WHERE isActive = 1');

    // ── Build datetimes (Bogotá → UTC via CONVERT_TZ) ─────────────────────────
    const eventDatetimeBogota = bogotaDatetime(event.date, event.entranceTime);
    // 1.0 has no separate openingTime; use the same as eventDate.
    const openingTimeBogota = eventDatetimeBogota;

    // ── Insert event ─────────────────────────────────────────────────────────
    const [evRes] = await conn.query(
      `INSERT INTO events
         (name, description, artists, eventDate, openingTime,
          venue, venueCapacity, flyerImageUrl, bankQrImageUrl,
          whatsappNumber, isActive)
       VALUES (?, NULL, CAST('[]' AS JSON),
               CONVERT_TZ(?, '${BOGOTA}', '${UTC}'),
               CONVERT_TZ(?, '${BOGOTA}', '${UTC}'),
               ?, ?, NULL, NULL, NULL, 1)`,
      [
        event.name,
        eventDatetimeBogota,
        openingTimeBogota,
        event.venue,
        // venueCapacity: minimum we know is the number of sold tickets.
        // The organizer can raise this via /admin later.
        Math.max(tickets.length, 1),
      ],
    );
    const eventId = evRes.insertId;
    console.log(`[seed] Event '${event.name}' created (id=${eventId})`);

    // ── Build ticket_stages from ticketTypes ──────────────────────────────────
    // ticketTypes: { preventa: 50000, vip: 100000 }
    const stageMap = {}; // typeName (lowercase) → stageId
    const typeEntries = Object.entries(event.ticketTypes || {});

    // Count how many tickets of each type exist (for soldQuantity + totalQuantity).
    const soldByType = {};
    for (const t of tickets) {
      const key = (t.ticketType || '').toLowerCase();
      soldByType[key] = (soldByType[key] || 0) + 1;
    }

    for (let i = 0; i < typeEntries.length; i++) {
      const [typeName, price] = typeEntries[i];
      const sold = soldByType[typeName.toLowerCase()] || 0;
      const [stRes] = await conn.query(
        `INSERT INTO ticket_stages
           (eventId, name, price, totalQuantity, soldQuantity,
            reservedQuantity, sortOrder, activatesAt, status)
         VALUES (?, ?, ?, ?, ?, 0, ?, NULL, 'active')`,
        [
          eventId,
          // Capitalize stage name for display (e.g. 'preventa' → 'Preventa').
          typeName.charAt(0).toUpperCase() + typeName.slice(1),
          price,
          // totalQuantity = sold count (minimum known capacity).
          Math.max(sold, 1),
          sold,
          i, // sortOrder
        ],
      );
      stageMap[typeName.toLowerCase()] = stRes.insertId;
      console.log(`[seed]   Stage '${typeName}' (id=${stRes.insertId}), price=${price}, sold=${sold}`);
    }

    // ── Insert purchases + tickets ────────────────────────────────────────────
    let orderIdx = 1;
    let skipped = 0;

    for (const t of tickets) {
      const typeKey = (t.ticketType || '').toLowerCase();
      const stageId = stageMap[typeKey];
      if (!stageId) {
        console.warn(`[seed]   SKIP ticket ${t.ticketId}: unknown type '${t.ticketType}'`);
        skipped++;
        continue;
      }

      const price = event.ticketTypes[typeKey] ?? event.ticketTypes[t.ticketType] ?? 0;

      // Use the purchaseDate as confirmedAt (noon Bogotá → UTC).
      const confirmedBogota = bogotaDatetime(t.purchaseDate, '12:00');
      const confirmedUtc = toSqlUtc(
        new Date(confirmedBogota.replace(' ', 'T') + '-05:00').toISOString(),
      );

      // reservationExpiresAt: 24h after purchase (in the past for migrated records).
      const expiredUtc = toSqlUtc(
        new Date(new Date(confirmedBogota.replace(' ', 'T') + '-05:00').getTime() + 24 * 3600 * 1000).toISOString(),
      );

      const oid = orderId(orderIdx++);

      const [pRes] = await conn.query(
        `INSERT INTO purchases
           (eventId, stageId, quantity, totalAmount, orderId,
            deliveryMethod, deliveryContact, status,
            idempotencyKey, reservationExpiresAt, confirmedAt, confirmedBy)
         VALUES (?, ?, 1, ?, ?, 'whatsapp', ?, 'confirmed',
                 NULL, ?, ?, 'migrated-from-1.0')`,
        [
          eventId,
          stageId,
          price,
          oid,
          t.buyerPhone && t.buyerPhone !== '000' ? t.buyerPhone : '000',
          expiredUtc,
          confirmedUtc,
        ],
      );
      const purchaseId = pRes.insertId;

      // validationHash: pad 1.0's 16-char hash to 32 chars.
      const vHash = padHash(t.validationHash || '');

      // usedAt: if checkedIn, convert checkInTime ISO → UTC SQL string.
      const usedAt = t.checkedIn && t.checkInTime ? toSqlUtc(t.checkInTime) : null;

      await conn.query(
        `INSERT INTO tickets
           (purchaseId, holderName, holderIdNumber, holderPhone,
            validationHash, isUsed, usedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          purchaseId,
          t.buyerName,
          t.buyerId || null,
          t.buyerPhone && t.buyerPhone !== '000' ? t.buyerPhone : null,
          vHash,
          t.checkedIn ? 1 : 0,
          usedAt,
        ],
      );
    }

    await conn.commit();

    const inserted = orderIdx - 1 - skipped;
    console.log(`[seed] Done. ${inserted} ticket(s) migrated, ${skipped} skipped.`);
    if (skipped > 0) {
      console.log('[seed] Skipped tickets had unknown ticketTypes not found in event.ticketTypes.');
    }
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[seed] Failed:', err.message);
    process.exit(1);
  });
