-- ============================================================
-- SÍGALE 2.0 — MIGRATION 007: enforce one active stage per event
-- Two "Etapa 1" ticket_stages rows both reached status='active' for the
-- same event in production (root cause: updateEvent's stage-reconciliation
-- left an orphaned-but-ticket-referenced stage 'active' instead of demoting
-- it). resolveActiveStage()/buildEventPayload() only ever surface the first
-- 'active' match, so the second stage's real sold/reserved counts became
-- invisible to buyers while still showing up in organizer stats — landing
-- page "available" and dashboard "sold" silently diverged.
--
-- This migration adds a DB-level guarantee so that failure mode can never
-- happen again, from any code path (including the scheduler's known
-- promote-without-demote gap, fixed alongside this in jobs/scheduler.js):
--   1. A 'closed' terminal status, distinct from 'sold_out'. Several
--      handlers (rejectPurchase, sweepExpiredHolds, deleteAdminTicket,
--      updateEvent) auto-reopen a 'sold_out' stage once its held inventory
--      frees up — correct for "temporarily full", wrong for "deliberately
--      superseded/retired". Nothing in the codebase ever restores FROM
--      'closed', so a stage set 'closed' stays closed.
--   2. A generated column that is 1 only when status='active', else NULL,
--      with a UNIQUE KEY on (eventId, thatColumn). NULLs don't collide in a
--      MySQL unique index, so this allows any number of non-active stages
--      per event but rejects a second 'active' one outright.
--
-- IDEMPOTENT: guarded via information_schema, matching 002/003's pattern.
-- Each line below is a single statement (no inline ';' / '--').
-- Scope guardrail: touches ONLY the Sígale-owned `ticket_stages` table.
-- ============================================================

SET @enum_has_closed := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ticket_stages' AND COLUMN_NAME = 'status' AND COLUMN_TYPE LIKE '%closed%');
SET @ddl_enum := IF(@enum_has_closed = 0, 'ALTER TABLE ticket_stages MODIFY COLUMN status ENUM(''upcoming'',''active'',''sold_out'',''closed'') NOT NULL DEFAULT ''upcoming''', 'DO 0');
PREPARE st_enum FROM @ddl_enum;
EXECUTE st_enum;
DEALLOCATE PREPARE st_enum;

SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ticket_stages' AND COLUMN_NAME = 'activeFlag');
SET @ddl_col := IF(@col_exists = 0, 'ALTER TABLE ticket_stages ADD COLUMN activeFlag TINYINT GENERATED ALWAYS AS (IF(status = ''active'', 1, NULL)) STORED', 'DO 0');
PREPARE st_col FROM @ddl_col;
EXECUTE st_col;
DEALLOCATE PREPARE st_col;

SET @idx_exists := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ticket_stages' AND INDEX_NAME = 'uqOneActiveStagePerEvent');
SET @ddl_idx := IF(@idx_exists = 0, 'ALTER TABLE ticket_stages ADD UNIQUE KEY uqOneActiveStagePerEvent (eventId, activeFlag)', 'DO 0');
PREPARE st_idx FROM @ddl_idx;
EXECUTE st_idx;
DEALLOCATE PREPARE st_idx;
