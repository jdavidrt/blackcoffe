/*
 * ============================================================
 * SÍGALE — EVENTS CONTROLLER
 * Read the active event (public) and create/edit it (organizer).
 *
 * Conventions (ADR-0001):
 *   - Money as DECIMAL; timestamps persisted UTC, read back as -05:00
 *     with CONVERT_TZ; eventDate/openingTime/activatesAt are Bogotá
 *     wall-clock from the organizer, converted to UTC on write.
 *   - Inventory-touching writes use getConnection() transactions
 *     (events + ticket_stages must commit together).
 *   - Explicit column lists on every INSERT (no `SET ?` mass-assignment).
 *   - Aforo invariant (Σ stage.totalQuantity ≤ venueCapacity) validated
 *     in the app; 409 on violation.
 *
 * Organizer-only writes (create/edit) sit behind requireOrganizer at
 * the route layer (per-request bcrypt check, plan §6); the read routes
 * (active / by id) stay public.
 * ============================================================
 */

import pool from '../db.js';
import { sendErrorEmail } from '../utils/emailNotifier.js';
import { BOGOTA, UTC } from '../utils/time.js';

// Columns we expose to the public, with datetimes converted to Bogotá time.
const EVENT_SELECT = `
  SELECT id, slug, name, description, artists, venue, address, venueCapacity,
         flyerImageUrl, bankQrImageUrl, whatsappNumber, isActive,
         isPublished, isDemo, salesOpen,
         CONVERT_TZ(eventDate,   '${UTC}', '${BOGOTA}') AS eventDate,
         CONVERT_TZ(openingTime, '${UTC}', '${BOGOTA}') AS openingTime,
         CONVERT_TZ(createdAt,   '${UTC}', '${BOGOTA}') AS createdAt
  FROM events`;

// Lightweight row shape for the root landing grid — no stages, no address.
const EVENT_LIST_SELECT = `
  SELECT id, slug, name, venue, flyerImageUrl, isDemo,
         CONVERT_TZ(eventDate, '${UTC}', '${BOGOTA}') AS eventDate
  FROM events`;

const STAGE_SELECT = `
  SELECT id, eventId, name, price, totalQuantity, soldQuantity, reservedQuantity,
         sortOrder, status,
         CONVERT_TZ(activatesAt, '${UTC}', '${BOGOTA}') AS activatesAt
  FROM ticket_stages
  WHERE eventId = ?
  ORDER BY sortOrder ASC`;

/**
 * Shape a full event response: the event, all its stages (each with
 * `cuposRestantes` = total - sold - reserved), and the single active stage.
 */
async function buildEventPayload(conn, eventRow) {
  const [stages] = await conn.query(STAGE_SELECT, [eventRow.id]);

  const decorated = stages.map((s) => ({
    ...s,
    cuposRestantes: Number(s.totalQuantity) - Number(s.soldQuantity) - Number(s.reservedQuantity),
  }));

  // artists is JSON in the DB; mysql2 may hand it back as a string.
  let artists = eventRow.artists;
  if (typeof artists === 'string') {
    try {
      artists = JSON.parse(artists);
    } catch {
      artists = [];
    }
  }

  return {
    ...eventRow,
    artists,
    stages: decorated,
    activeStage: decorated.find((s) => s.status === 'active') || null,
  };
}

/**
 * GET /api/events/active  (public)
 * Resolver for "the one active event" (events.isActive = 1).
 */
export const getActiveEvent = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const [[event]] = await conn.query(`${EVENT_SELECT} WHERE isActive = 1 LIMIT 1`);
    if (!event) {
      return res.status(404).json({ message: 'No hay un evento activo' });
    }
    res.json(await buildEventPayload(conn, event));
  } catch (error) {
    sendErrorEmail(req, error, 'getActiveEvent');
    return res.status(500).json({ message: error.message });
  } finally {
    conn.release();
  }
};

/**
 * GET /api/events/:id  (public)
 * Event + active stage + cupos restantes.
 */
export const getEventById = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const [[event]] = await conn.query(`${EVENT_SELECT} WHERE id = ? LIMIT 1`, [req.params.id]);
    if (!event) {
      return res.status(404).json({ message: 'Evento no encontrado' });
    }
    res.json(await buildEventPayload(conn, event));
  } catch (error) {
    sendErrorEmail(req, error, 'getEventById');
    return res.status(500).json({ message: error.message });
  } finally {
    conn.release();
  }
};

/**
 * GET /api/events  (public)
 * Root landing grid: every published event, newest first. Lightweight rows
 * (no stages/address) — the landing card only needs flyer/name/date/venue.
 */
export const listPublishedEvents = async (req, res) => {
  try {
    const [rows] = await pool.query(`${EVENT_LIST_SELECT} WHERE isPublished = 1 ORDER BY eventDate DESC`);
    res.json(rows);
  } catch (error) {
    sendErrorEmail(req, error, 'listPublishedEvents');
    return res.status(500).json({ message: error.message });
  }
};

/**
 * GET /api/events/all  (organizer — requireOrganizer at the route)
 * Every event regardless of isPublished, for the organizer's event selector.
 */
export const listAllEvents = async (req, res) => {
  try {
    const [rows] = await pool.query(`${EVENT_LIST_SELECT} ORDER BY eventDate DESC`);
    res.json(rows);
  } catch (error) {
    sendErrorEmail(req, error, 'listAllEvents');
    return res.status(500).json({ message: error.message });
  }
};

/**
 * GET /api/events/by-slug/:slug  (public)
 * Event + active stage + cupos restantes, resolved by URL slug. Deliberately
 * does NOT filter isPublished — an organizer can share an unpublished event's
 * link privately before flipping "visible en la página principal" (soft
 * launch). isPublished only gates the root landing list above.
 */
export const getEventBySlug = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const [[event]] = await conn.query(`${EVENT_SELECT} WHERE slug = ? LIMIT 1`, [req.params.slug]);
    if (!event) {
      return res.status(404).json({ message: 'Evento no encontrado' });
    }
    res.json(await buildEventPayload(conn, event));
  } catch (error) {
    sendErrorEmail(req, error, 'getEventBySlug');
    return res.status(500).json({ message: error.message });
  } finally {
    conn.release();
  }
};

// ── Validation helpers ─────────────────────────────────────────────────────────

const REQUIRED_EVENT_FIELDS = ['name', 'eventDate', 'openingTime', 'venue', 'venueCapacity'];

// Words that would shadow a real static route or asset if used as an event
// slug (every event lives at /:slug at the app root). Deliberately does NOT
// include 'demo' — that slug is protected by the DB's uqEventSlug uniqueness
// instead (it's ordinary event data, not a literal app route), so attempting
// to claim it surfaces the ER_DUP_ENTRY 409 below, not this one.
const RESERVED_SLUGS = new Set([
  'admin', 'scan', 'compra', 'tickets', 'dashboard', 'evento', 'edit',
  'edit-event', 'create-event', 'sell-tickets', 'guest-passes',
  'lista-puerta', 'validate-qr', 'api', 'assets', 'sw.js', 'manifest.json',
  'robots.txt', 'favicon.ico',
]);
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Validate a submitted slug. A missing/empty slug is valid (deploy-window
 * compat — the old frontend doesn't send one; only the new create/edit form
 * requires it client-side). Returns an error message string, or null.
 */
function validateSlug(slug) {
  if (slug === undefined || slug === null || slug === '') {
    return null;
  }
  if (typeof slug !== 'string' || slug.length > 80 || !SLUG_PATTERN.test(slug)) {
    return 'La URL del evento solo puede tener letras minúsculas, números y guiones, sin espacios';
  }
  if (RESERVED_SLUGS.has(slug)) {
    return 'Esa URL está reservada, elige otra';
  }
  return null;
}

/**
 * Validate the create/edit payload. Returns an error message string, or null.
 * Enforces the aforo invariant: Σ stage.totalQuantity ≤ venueCapacity.
 */
function validateEventPayload(body) {
  for (const f of REQUIRED_EVENT_FIELDS) {
    if (body[f] === undefined || body[f] === null || body[f] === '') {
      return `Falta el campo obligatorio: ${f}`;
    }
  }
  if (!Array.isArray(body.stages) || body.stages.length === 0) {
    return 'El evento necesita al menos una etapa de boletas';
  }
  const capacity = Number(body.venueCapacity);
  if (!Number.isFinite(capacity) || capacity <= 0) {
    return 'venueCapacity debe ser un número positivo';
  }
  let sum = 0;
  for (const s of body.stages) {
    if (!s.name || s.price == null || s.totalQuantity == null) {
      return 'Cada etapa requiere name, price y totalQuantity';
    }
    sum += Number(s.totalQuantity);
  }
  if (sum > capacity) {
    return `La suma de cupos de las etapas (${sum}) supera el aforo (${capacity})`;
  }
  return null;
}

/**
 * Insert the event's stages. Explicit columns; eventDate-relative datetimes
 * (activatesAt) are Bogotá wall-clock converted to UTC on write.
 */
async function insertStages(conn, eventId, stages) {
  for (let i = 0; i < stages.length; i++) {
    const s = stages[i];
    await conn.query(
      `INSERT INTO ticket_stages
         (eventId, name, price, totalQuantity, soldQuantity, reservedQuantity, sortOrder, activatesAt, status)
       VALUES (?, ?, ?, ?, 0, 0, ?, CONVERT_TZ(?, '${BOGOTA}', '${UTC}'), ?)`,
      [
        eventId,
        s.name,
        s.price,
        s.totalQuantity,
        s.sortOrder ?? i,
        s.activatesAt || null,
        s.status || 'upcoming',
      ],
    );
  }
}

/**
 * POST /api/events  (organizer — requireOrganizer at the route)
 * Creates the event + its stages in one transaction and marks it the
 * single active event (clears isActive on all others).
 */
export const createEvent = async (req, res) => {
  const validationError = validateEventPayload(req.body);
  if (validationError) {
    return res.status(409).json({ message: validationError });
  }
  const slugError = validateSlug(req.body.slug);
  if (slugError) {
    return res.status(409).json({ message: slugError });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const b = req.body;
    // isActive is never written by this API anymore (multi-event: there is
    // no more "the one active event" — see isPublished). isDemo is never
    // settable via the public API either; only the one-off prod flip sets it.
    const [result] = await conn.query(
      `INSERT INTO events
         (slug, name, description, artists, eventDate, openingTime, venue, address, venueCapacity,
          flyerImageUrl, bankQrImageUrl, whatsappNumber, isActive, isPublished, salesOpen)
       VALUES (?, ?, ?, CAST(? AS JSON),
               CONVERT_TZ(?, '${BOGOTA}', '${UTC}'),
               CONVERT_TZ(?, '${BOGOTA}', '${UTC}'),
               ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      [
        b.slug || null,
        b.name,
        b.description || null,
        JSON.stringify(b.artists || []),
        b.eventDate,
        b.openingTime,
        b.venue,
        b.address || null,
        b.venueCapacity,
        b.flyerImageUrl || null,
        b.bankQrImageUrl || null,
        b.whatsappNumber || null,
        b.isPublished ? 1 : 0,
        b.salesOpen ? 1 : 0,
      ],
    );

    const eventId = result.insertId;
    await insertStages(conn, eventId, b.stages);

    await conn.commit();

    const [[event]] = await conn.query(`${EVENT_SELECT} WHERE id = ? LIMIT 1`, [eventId]);
    res.status(201).json(await buildEventPayload(conn, event));
  } catch (error) {
    await conn.rollback();
    if (error.code === 'ER_DUP_ENTRY' && /uqEventSlug/.test(error.sqlMessage || '')) {
      return res.status(409).json({ message: 'Esa URL ya está en uso' });
    }
    sendErrorEmail(req, error, 'createEvent');
    return res.status(500).json({ message: error.message, sqlMessage: error.sqlMessage });
  } finally {
    conn.release();
  }
};

/**
 * PUT /api/events/:id  (organizer — requireOrganizer at the route)
 * Edits the event's fields and reconciles its stages in one transaction.
 *
 * Stage reconciliation (safe when tickets exist):
 *   - Submitted stage has an id that matches an existing stage → UPDATE in-place
 *     (soldQuantity / reservedQuantity / status are preserved).
 *   - Submitted stage has no id (or id not found) → INSERT new stage.
 *   - Existing stage not present in the submitted list:
 *       • No tickets reference it → DELETE.
 *       • Tickets exist → leave it (organizer must handle manually).
 */
export const updateEvent = async (req, res) => {
  const validationError = validateEventPayload(req.body);
  if (validationError) {
    return res.status(409).json({ message: validationError });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const b = req.body;
    const eventId = req.params.id;

    const [[current]] = await conn.query(
      'SELECT isDemo, isPublished, salesOpen FROM events WHERE id = ? FOR UPDATE',
      [eventId],
    );
    if (!current) {
      await conn.rollback();
      return res.status(404).json({ message: 'Evento no encontrado' });
    }
    const isDemo = Number(current.isDemo) === 1;

    // Demo row: slug/isDemo are permanently fixed — skip slug validation and
    // never write either column, regardless of what the form submits. The
    // edit form re-submits the unchanged slug 'demo' on every save; without
    // this carve-out a routine copy/flyer fix on the demo would risk tripping
    // slug validation for no reason. Every other field stays editable.
    if (!isDemo) {
      const slugError = validateSlug(b.slug);
      if (slugError) {
        await conn.rollback();
        return res.status(409).json({ message: slugError });
      }
    }

    // isPublished/salesOpen fall back to the current value when the body
    // omits them (deploy-window compat: the old form doesn't send these
    // fields, so an edit through it must not silently unpublish/close sales
    // on an existing event).
    const isPublished = b.isPublished !== undefined ? (b.isPublished ? 1 : 0) : Number(current.isPublished);
    const salesOpen = b.salesOpen !== undefined ? (b.salesOpen ? 1 : 0) : Number(current.salesOpen);

    const updates = [
      'name = ?', 'description = ?', 'artists = CAST(? AS JSON)',
      `eventDate = CONVERT_TZ(?, '${BOGOTA}', '${UTC}')`,
      `openingTime = CONVERT_TZ(?, '${BOGOTA}', '${UTC}')`,
      'venue = ?', 'address = ?', 'venueCapacity = ?', 'flyerImageUrl = ?', 'bankQrImageUrl = ?',
      'whatsappNumber = ?', 'isPublished = ?', 'salesOpen = ?',
    ];
    const params = [
      b.name,
      b.description || null,
      JSON.stringify(b.artists || []),
      b.eventDate,
      b.openingTime,
      b.venue,
      b.address || null,
      b.venueCapacity,
      b.flyerImageUrl || null,
      b.bankQrImageUrl || null,
      b.whatsappNumber || null,
      isPublished,
      salesOpen,
    ];
    if (!isDemo) {
      updates.push('slug = ?');
      params.push(b.slug || null);
    }
    params.push(eventId);

    const [result] = await conn.query(
      `UPDATE events SET ${updates.join(', ')} WHERE id = ?`,
      params,
    );

    if (result.affectedRows === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'Evento no encontrado' });
    }

    // ── Reconcile stages ────────────────────────────────────────────────────────
    const [existingStages] = await conn.query(
      'SELECT id FROM ticket_stages WHERE eventId = ?',
      [eventId],
    );
    const existingIdSet = new Set(existingStages.map((s) => s.id));
    const submittedIdSet = new Set(b.stages.filter((s) => s.id).map((s) => Number(s.id)));

    // Shift all existing sortOrders out of the way so the update loop can write
    // real values without hitting the (eventId, sortOrder) unique constraint.
    if (existingStages.length > 0) {
      await conn.query(
        'UPDATE ticket_stages SET sortOrder = sortOrder + 10000 WHERE eventId = ?',
        [eventId],
      );
    }

    // Delete stages no longer in the form, only when no tickets reference them.
    for (const id of existingIdSet) {
      if (!submittedIdSet.has(id)) {
        const [[{ cnt }]] = await conn.query(
          'SELECT COUNT(*) AS cnt FROM tickets WHERE stageId = ?',
          [id],
        );
        if (Number(cnt) === 0) {
          await conn.query('DELETE FROM ticket_stages WHERE id = ?', [id]);
        } else {
          // Tickets exist — can't delete, but it must never stay sellable: a
          // stage left 'active' after being dropped from the form silently
          // forks inventory from any same-named replacement inserted below
          // (this is how a duplicate "active" stage reached production).
          // 'closed' (not 'sold_out') — this stage is permanently retired,
          // and 'sold_out' auto-reopens elsewhere once inventory frees up.
          await conn.query(
            "UPDATE ticket_stages SET status = 'closed' WHERE id = ? AND status != 'closed'",
            [id],
          );
        }
      }
    }

    // Update existing stages or insert new ones.
    for (let i = 0; i < b.stages.length; i++) {
      const s = b.stages[i];
      const stageId = s.id ? Number(s.id) : null;

      if (stageId && existingIdSet.has(stageId)) {
        // Guard: totalQuantity must not drop below already-sold + reserved inventory.
        const [[inv]] = await conn.query(
          'SELECT soldQuantity, reservedQuantity FROM ticket_stages WHERE id = ?',
          [stageId],
        );
        const floor = Number(inv?.soldQuantity || 0) + Number(inv?.reservedQuantity || 0);
        if (Number(s.totalQuantity) < floor) {
          await conn.rollback();
          return res.status(409).json({
            message: `La etapa "${s.name}" tiene ${floor} cupos vendidos/reservados; no se puede reducir el aforo a ${s.totalQuantity}.`,
          });
        }

        // UPDATE — preserve soldQuantity, reservedQuantity, and status.
        await conn.query(
          `UPDATE ticket_stages SET
             name = ?, price = ?, totalQuantity = ?, sortOrder = ?,
             activatesAt = CONVERT_TZ(?, '${BOGOTA}', '${UTC}')
           WHERE id = ? AND eventId = ?`,
          [
            s.name,
            s.price,
            s.totalQuantity,
            s.sortOrder ?? i,
            s.activatesAt || null,
            stageId,
            eventId,
          ],
        );
        // If the organizer raised totalQuantity above the sold+reserved floor,
        // reopen a sold_out stage so buyers can reserve the new spots — but only
        // when no OTHER stage of this event is currently active. Promoting this
        // one while another is active would create a second active stage and
        // violate uqOneActiveStagePerEvent (ER_DUP_ENTRY). The count runs inside
        // this transaction, so it reflects demotions from earlier iterations.
        // See migration 007.
        const [[{ activeCount }]] = await conn.query(
          "SELECT COUNT(*) AS activeCount FROM ticket_stages WHERE eventId = ? AND status = 'active' AND id <> ?",
          [eventId, stageId],
        );
        if (Number(activeCount) === 0) {
          await conn.query(
            "UPDATE ticket_stages SET status = 'active' WHERE id = ? AND status = 'sold_out' AND soldQuantity + reservedQuantity < totalQuantity",
            [stageId],
          );
        }
      } else {
        // INSERT — brand new stage, starts with zero sold/reserved. Only one
        // stage per event may be 'active'; demote any other before this one
        // claims the slot. 'closed', not 'sold_out' — see migration 007.
        if (i === 0) {
          await conn.query(
            "UPDATE ticket_stages SET status = 'closed' WHERE eventId = ? AND status = 'active'",
            [eventId],
          );
        }
        await conn.query(
          `INSERT INTO ticket_stages
             (eventId, name, price, totalQuantity, soldQuantity, reservedQuantity, sortOrder, activatesAt, status)
           VALUES (?, ?, ?, ?, 0, 0, ?, CONVERT_TZ(?, '${BOGOTA}', '${UTC}'), ?)`,
          [
            eventId,
            s.name,
            s.price,
            s.totalQuantity,
            s.sortOrder ?? i,
            s.activatesAt || null,
            i === 0 ? 'active' : 'upcoming',
          ],
        );
      }
    }

    await conn.commit();

    const [[event]] = await conn.query(`${EVENT_SELECT} WHERE id = ? LIMIT 1`, [eventId]);
    res.json(await buildEventPayload(conn, event));
  } catch (error) {
    await conn.rollback();
    sendErrorEmail(req, error, 'updateEvent');
    return res.status(500).json({ message: error.message, sqlMessage: error.sqlMessage });
  } finally {
    conn.release();
  }
};
