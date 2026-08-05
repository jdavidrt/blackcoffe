-- ============================================================
-- SÍGALE 2.0 — MIGRATION 008: multi-event (slugs, publish, demo, sales gate)
-- Converts the platform from single-active-event to multi-event: every
-- event gets a URL slug, several events can sell simultaneously, the root
-- landing lists only "published" events, and one event can be flagged as
-- the permanent read-only demo. `isActive` semantics are retired (column
-- stays, nothing new writes it) in favor of `isPublished`.
--
-- Columns added to `events`:
--   slug         VARCHAR(80) NULL, UNIQUE (uqEventSlug) — NULLs don't
--                collide, so deploy-window events created by the OLD
--                frontend (no slug field yet) are still valid rows.
--                utf8mb4_0900_ai_ci (MySQL 8 default) gives case/accent-
--                insensitive uniqueness, which is desired.
--   isPublished  TINYINT(1) NOT NULL DEFAULT 0 — visible on the root
--                landing grid (GET /api/events). An unpublished event is
--                still reachable by direct slug URL (soft-launch).
--   isDemo       TINYINT(1) NOT NULL DEFAULT 0 — the permanent read-only
--                Astromelias showpiece. Never written by the public API.
--   salesOpen    TINYINT(1) NOT NULL DEFAULT 0 — per-event replacement for
--                the retired global ONLINE_SALES_OPEN flag. Default 0
--                preserves today's "closed" behavior for every existing row.
--
-- New table `order_counter`: a persisted high-water mark for orderId, so a
-- per-event "Delete All Tickets" can never make an orderId reusable.
-- validationHash = HMAC(orderId, seatIndex), so a reissued orderId would
-- make an already-delivered QR image scan in as a different, newer ticket.
-- Written only by deleteAllPurchases (bumped to the max orderId of the
-- rows it deletes); read by nextOrderId as a floor alongside MAX(orderId).
-- Seeded from today's data so the mark starts at least as high as any
-- orderId that already exists.
--
-- IDEMPOTENT: guarded via information_schema + PREPARE/EXECUTE, matching
-- 002/007's pattern; the new table is CREATE TABLE IF NOT EXISTS and its
-- seed row is INSERT IGNORE (won't overwrite a mark that already advanced).
-- Each line below is a single statement (no inline ';' / '--').
-- Scope guardrail: touches ONLY the Sígale-owned `events` table plus one
-- new Sígale-owned table (`order_counter`).
-- ============================================================

SET @slug_col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'events' AND COLUMN_NAME = 'slug');
SET @ddl_slug_col := IF(@slug_col_exists = 0, 'ALTER TABLE events ADD COLUMN slug VARCHAR(80) NULL AFTER id', 'DO 0');
PREPARE st_slug_col FROM @ddl_slug_col;
EXECUTE st_slug_col;
DEALLOCATE PREPARE st_slug_col;

SET @slug_idx_exists := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'events' AND INDEX_NAME = 'uqEventSlug');
SET @ddl_slug_idx := IF(@slug_idx_exists = 0, 'ALTER TABLE events ADD UNIQUE KEY uqEventSlug (slug)', 'DO 0');
PREPARE st_slug_idx FROM @ddl_slug_idx;
EXECUTE st_slug_idx;
DEALLOCATE PREPARE st_slug_idx;

SET @published_col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'events' AND COLUMN_NAME = 'isPublished');
SET @ddl_published_col := IF(@published_col_exists = 0, 'ALTER TABLE events ADD COLUMN isPublished TINYINT(1) NOT NULL DEFAULT 0 AFTER isActive', 'DO 0');
PREPARE st_published_col FROM @ddl_published_col;
EXECUTE st_published_col;
DEALLOCATE PREPARE st_published_col;

SET @demo_col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'events' AND COLUMN_NAME = 'isDemo');
SET @ddl_demo_col := IF(@demo_col_exists = 0, 'ALTER TABLE events ADD COLUMN isDemo TINYINT(1) NOT NULL DEFAULT 0 AFTER isPublished', 'DO 0');
PREPARE st_demo_col FROM @ddl_demo_col;
EXECUTE st_demo_col;
DEALLOCATE PREPARE st_demo_col;

SET @sales_open_col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'events' AND COLUMN_NAME = 'salesOpen');
SET @ddl_sales_open_col := IF(@sales_open_col_exists = 0, 'ALTER TABLE events ADD COLUMN salesOpen TINYINT(1) NOT NULL DEFAULT 0 AFTER isDemo', 'DO 0');
PREPARE st_sales_open_col FROM @ddl_sales_open_col;
EXECUTE st_sales_open_col;
DEALLOCATE PREPARE st_sales_open_col;

CREATE TABLE IF NOT EXISTS order_counter (
  id             TINYINT UNSIGNED NOT NULL,
  highWaterMark  INT UNSIGNED NOT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO order_counter (id, highWaterMark) SELECT 1, COALESCE(MAX(orderId), 0) FROM tickets;
