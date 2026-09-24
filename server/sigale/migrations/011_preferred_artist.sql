-- ============================================================
-- SÍGALE — MIGRATION 011: tickets.preferredArtist (buyer's pick)
-- Applied in production 2026-09-15.
--
-- Adds one order-level column so a buyer can record which band/artist they
-- are coming to see, letting organizers report which act drives the most
-- ticket sales:
--   preferredArtist VARCHAR(160) NULL — the chosen act, sourced from the
--     event's own line-up (events.artists, a JSON array). Free-form at the
--     DB level (like guest_passes.band); the purchase wizard constrains it
--     to a dropdown of the event's artists.
--     REQUIRED for every NEW order — enforced at the API (createPurchase
--     returns 400 if missing / not in the line-up), NOT at the DB. The
--     column stays NULL-able because the rows that predate this migration
--     have no preferred artist and cannot be backfilled: NULL means "legacy
--     row, before the feature," which is why the report below filters IS NOT
--     NULL. A NOT NULL DEFAULT '' was rejected — a default would let a
--     forgotten insert pass silently with a meaningless value. Walk-in
--     (createWalkInSale) requires it TOO (resolved 2026-09-15): TicketForm
--     gains the required artist dropdown and drops its phone field.
--
-- ORDER-INVARIANT: like deliveryMethod / deliveryContact / status, this is a
-- per-ORDER value carried on every seat row that shares an orderId — the
-- buyer picks one act for the whole order, and createPurchase writes the
-- same value to all rows it inserts. It is NOT per-seat.
--
-- Placed AFTER deliveryContact so it groups with the other order-level,
-- buyer-supplied columns rather than with the per-seat holder fields.
--
-- Reporting (once the column is populated) — tickets = seats, orders =
-- distinct orderId; confirmed only, so it counts real sales:
--   SELECT preferredArtist,
--          COUNT(*) AS tickets,
--          COUNT(DISTINCT orderId) AS orders,
--          SUM(unitPrice) AS revenue
--     FROM tickets
--    WHERE eventId = ? AND status = 'confirmed' AND preferredArtist IS NOT NULL
--    GROUP BY preferredArtist
--    ORDER BY tickets DESC
--
-- IDEMPOTENT: guarded via information_schema + PREPARE/EXECUTE, matching
-- 002/007/008's pattern. Each line below is a single statement (no inline
-- ';' / '--'). Scope guardrail: touches ONLY the Sígale-owned `tickets`
-- table. Never references BlackCoffe tables. Run only against DB_NAME=sigale.
-- ============================================================

SET @pref_col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tickets' AND COLUMN_NAME = 'preferredArtist');
SET @ddl_pref := IF(@pref_col_exists = 0, 'ALTER TABLE tickets ADD COLUMN preferredArtist VARCHAR(160) NULL AFTER deliveryContact', 'DO 0');
PREPARE st_pref FROM @ddl_pref;
EXECUTE st_pref;
DEALLOCATE PREPARE st_pref;
