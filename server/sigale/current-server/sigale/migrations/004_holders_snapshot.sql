-- ============================================================
-- SÍGALE 2.0 - MIGRATION 004: purchases.holdersSnapshot
-- Captures the holder names/IDs/phones the buyer enters during
-- the public purchase flow, so they are persisted before the
-- organizer confirms. At confirm-time we mint tickets from this
-- snapshot when the admin doesn't override them.
--
-- IDEMPOTENT: guarded against re-run.
-- ============================================================

SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'purchases' AND COLUMN_NAME = 'holdersSnapshot');
SET @ddl := IF(@col_exists = 0, 'ALTER TABLE purchases ADD COLUMN holdersSnapshot JSON NULL AFTER deliveryContact', 'DO 0');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
