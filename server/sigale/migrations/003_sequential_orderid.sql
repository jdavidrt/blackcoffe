-- ============================================================
-- PRE-CUTOVER HISTORY.
-- orderId CHAR(3) -> INT UNSIGNED. The uniqueness guarantee now lives on `orderAnchor`, since many rows share one orderId.
-- Kept in place so the schema_migrations ledger stays coherent:
-- runMigrations.js MARKS this file applied (it does not execute it)
-- once it detects a cut-over database via `tickets_legacy_v1`.
-- DO NOT delete, renumber, or "fix" this file.
-- Current schema: docs/architecture/TICKETS_SCHEMA.md
-- ============================================================

-- ============================================================
-- SÍGALE 2.0 - MIGRATION 003: sequential orderId starting at 100
-- Converts purchases.orderId from CHAR(3) random folio to INT
-- UNSIGNED sequential identifier. New orderIds are computed in
-- the controller as MAX(orderId) + 1, starting at 100.
--
-- IDEMPOTENT (guarded against re-run): re-applies are no-ops.
-- Each line below is a single statement (no inline ';' / '--')
-- to match runMigrations' splitter.
-- ============================================================

SET @col_type := (SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'purchases' AND COLUMN_NAME = 'orderId');
SET @idx_per_event := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'purchases' AND INDEX_NAME = 'uqPurchaseOrderId');
SET @ddl_drop_idx := IF(@idx_per_event > 0, 'ALTER TABLE purchases DROP INDEX uqPurchaseOrderId', 'DO 0');
PREPARE st_drop_idx FROM @ddl_drop_idx;
EXECUTE st_drop_idx;
DEALLOCATE PREPARE st_drop_idx;

SET @ddl_modify := IF(@col_type LIKE 'char%' OR @col_type LIKE 'varchar%', 'ALTER TABLE purchases MODIFY COLUMN orderId INT UNSIGNED NOT NULL', 'DO 0');
PREPARE st_modify FROM @ddl_modify;
EXECUTE st_modify;
DEALLOCATE PREPARE st_modify;

SET @uq_global := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'purchases' AND INDEX_NAME = 'uqOrderIdGlobal');
SET @ddl_add_uq := IF(@uq_global = 0, 'ALTER TABLE purchases ADD UNIQUE KEY uqOrderIdGlobal (orderId)', 'DO 0');
PREPARE st_add_uq FROM @ddl_add_uq;
EXECUTE st_add_uq;
DEALLOCATE PREPARE st_add_uq;
