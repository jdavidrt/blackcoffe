-- ============================================================
-- PRE-CUTOVER HISTORY.
-- Guarded ALTER adding events.address. Still true, but predates the purchases/tickets merge.
-- Kept in place so the schema_migrations ledger stays coherent:
-- runMigrations.js MARKS this file applied (it does not execute it)
-- once it detects a cut-over database via `tickets_legacy_v1`.
-- DO NOT delete, renumber, or "fix" this file.
-- Current schema: docs/architecture/TICKETS_SCHEMA.md
-- ============================================================

-- ============================================================
-- SÍGALE 2.0 — MIGRATION 002: events.address
-- Adds the venue street address captured by the organizer form.
-- The 001 schema only stored `venue` (name); the public landing and
-- organizer Home both surface a full address, so it gets its own column.
--
-- IDEMPOTENT: the runner re-applies every *.sql on boot, and MySQL 8
-- has no `ADD COLUMN IF NOT EXISTS`. We guard with information_schema
-- and a PREPARE/EXECUTE pair, so a second boot is a no-op (DO 0).
-- Each line below is a single statement with no inline ';' or '--',
-- which is what runMigrations' splitter expects.
-- Scope guardrail: touches ONLY the Sígale-owned `events` table.
-- ============================================================

SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'events' AND COLUMN_NAME = 'address');
SET @ddl := IF(@col_exists = 0, 'ALTER TABLE events ADD COLUMN address VARCHAR(200) NULL AFTER venue', 'DO 0');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
