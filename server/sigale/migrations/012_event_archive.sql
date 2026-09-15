-- ============================================================
-- SÍGALE — MIGRATION 012: events.isArchived (archive, never delete)
-- DRAFT — validated in docs/architecture/DB_SCHEMA.md 2026-09-15, NOT YET
-- applied anywhere (not local, not production). No backend code reads or
-- writes this column yet.
--
-- Replaces the briefly-considered "super_admin can DELETE an event" idea,
-- which was dropped: deleting an event's ticket rows collides with the
-- orderId-never-reused invariant (tickets->events is a RESTRICT FK, and a
-- cascade without bumping order_counter would reissue orderIds and make an
-- already-delivered QR admit a different ticket). Events are NEVER destroyed;
-- a super_admin ARCHIVES them instead — reversible, ticket history preserved.
--
-- Column added to `events`:
--   isArchived TINYINT(1) NOT NULL DEFAULT 0 — a "put away" switch, distinct
--     from isPublished (landing-grid visibility) and salesOpen (online sales
--     switch). When 1:
--       * excluded from the public landing feed (GET /api/events) regardless
--         of isPublished,
--       * excluded from the organizer's default event list (GET
--         /api/events/all) unless includeArchived is requested by the
--         super_admin events-admin page,
--       * sales are closed — createPurchase AND createWalkInSale reject an
--         archived event, regardless of salesOpen,
--       * still resolvable by direct slug (GET /api/events/by-slug/:slug) so
--         old links/records still open, showing a finished state.
--     Reversible: a super_admin can unarchive (set back to 0). The demo is
--     never archivable (assertNotDemo on the archive route).
--
-- Archive/unarchive is super_admin-only (PATCH /api/events/:id/archive with
-- body { isArchived: 0|1 }, behind requireSuperAdmin) — an app-layer concern,
-- not part of this migration. Archived blocks NEW SALES only; confirming
-- pending orders, ticket edits, guest passes and scanning keep working.
--
-- IDEMPOTENT: guarded via information_schema + PREPARE/EXECUTE, matching
-- 002/007/008's pattern. Each line below is a single statement (no inline
-- ';' / '--'). Scope guardrail: touches ONLY the Sígale-owned `events`
-- table. Never references BlackCoffe tables. Run only against DB_NAME=sigale.
-- ============================================================

SET @archived_col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'events' AND COLUMN_NAME = 'isArchived');
SET @ddl_archived := IF(@archived_col_exists = 0, 'ALTER TABLE events ADD COLUMN isArchived TINYINT(1) NOT NULL DEFAULT 0 AFTER salesOpen', 'DO 0');
PREPARE st_archived FROM @ddl_archived;
EXECUTE st_archived;
DEALLOCATE PREPARE st_archived;
