-- ============================================================
-- SÍGALE — MIGRATION 010: organizer roles + event ownership
-- Applied in production 2026-09-15. Additive; promotes the pre-existing
-- account(s) itself (see the end of the file).
--
-- Adds role-based access: `super_admin` (sees/manages every event and every
-- organizer account, unconditionally) vs `event_admin` (scoped to events
-- explicitly assigned via `organizer_events`). Many-to-many, not a single
-- `events.ownerId` column, because one event can have co-admins and one
-- admin can be assigned to several events.
--
-- Columns added to `organizers`:
--   role      ENUM('super_admin','event_admin') NOT NULL DEFAULT 'event_admin'
--             — least-privilege default for every FUTURE row (fail closed).
--             The accounts that exist when the column is created are
--             promoted to super_admin by the guarded UPDATE at the end of
--             this file (they were full admins before roles existed), so
--             there is no manual one-off and no lockout window.
--   isActive  TINYINT(1) NOT NULL DEFAULT 1 — lets a super_admin revoke an
--             event_admin's access without deleting the row, matching this
--             schema's existing never-hard-delete convention (closed
--             stages, unpublished events — nothing is ever actually
--             removed, only flagged).
--
-- New table `organizer_events`: many-to-many organizer<->event assignment.
--   A row means "this organizer is assigned to / personally organizes this
--   event." For an event_admin the row is also what GRANTS access (no row =
--   no access). A super_admin already reaches every event by role alone, so
--   the authorization check never reads this table for them — but a
--   super_admin MAY still hold rows here, to record the events they
--   personally organize (attribution + a "my events" filter), since a
--   super_admin can also be a hands-on organizer. So a row means
--   assignment/attribution, NOT "grants access" for everyone; the
--   authorization check branches on role FIRST, then consults this table
--   only for event_admins.
--
-- IDEMPOTENT: guarded via information_schema + PREPARE/EXECUTE, matching
-- 007/008's pattern. Each line is a single statement (no inline ';'/'--').
-- Scope guardrail: touches ONLY organizers + events (existing tables) plus
-- one new Sígale-owned table (organizer_events). Never references
-- BlackCoffe tables. Run only against DB_NAME=sigale.
-- ============================================================

SET @role_col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'organizers' AND COLUMN_NAME = 'role');
SET @ddl_role_col := IF(@role_col_exists = 0, 'ALTER TABLE organizers ADD COLUMN role ENUM(''super_admin'',''event_admin'') NOT NULL DEFAULT ''event_admin'' AFTER username', 'DO 0');
PREPARE st_role_col FROM @ddl_role_col;
EXECUTE st_role_col;
DEALLOCATE PREPARE st_role_col;

SET @active_col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'organizers' AND COLUMN_NAME = 'isActive');
SET @ddl_active_col := IF(@active_col_exists = 0, 'ALTER TABLE organizers ADD COLUMN isActive TINYINT(1) NOT NULL DEFAULT 1 AFTER role', 'DO 0');
PREPARE st_active_col FROM @ddl_active_col;
EXECUTE st_active_col;
DEALLOCATE PREPARE st_active_col;

CREATE TABLE IF NOT EXISTS organizer_events (
  organizerId  BIGINT UNSIGNED NOT NULL,
  eventId      BIGINT UNSIGNED NOT NULL,
  createdAt    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (organizerId, eventId),
  KEY idxOrgEventsByEvent (eventId),
  CONSTRAINT fkOrgEventOrganizer FOREIGN KEY (organizerId) REFERENCES organizers(id) ON DELETE CASCADE,
  CONSTRAINT fkOrgEventEvent FOREIGN KEY (eventId) REFERENCES events(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Promote every account that predates roles. Runs only in the pass that
-- creates the column (@role_col_exists = 0), and the schema_migrations
-- ledger makes that pass happen once — so accounts created later keep the
-- event_admin default.
SET @ddl_promote := IF(@role_col_exists = 0, 'UPDATE organizers SET role = ''super_admin''', 'DO 0');
PREPARE st_promote FROM @ddl_promote;
EXECUTE st_promote;
DEALLOCATE PREPARE st_promote;
