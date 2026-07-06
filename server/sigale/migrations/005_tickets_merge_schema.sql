-- ============================================================
-- SÍGALE 2.0 — MIGRATION 005: tickets/purchases merge (schema only)
-- Creates the new unified lifecycle table (`tickets_v2`) alongside the
-- still-live `purchases`/`tickets` tables. Purely additive — never
-- touches existing data, so it is safe to auto-apply on every boot.
--
-- One row per seat/holder, created at reservation time instead of at
-- confirm time, so `status` transitions in place across the lifecycle:
--   pending_payment -> payment_submitted -> confirmed | rejected | expired
-- All rows sharing one `orderId` are one order. Replaces the old
-- purchases (order-level) + tickets (seat-level, confirm-time-only) split.
--
-- The actual data migration (copy existing purchases+tickets rows into
-- tickets_v2, verify, then RENAME TABLE to cut over) is a separate,
-- manually-run, supervised step — see
-- server/migrations/scripts/merge_purchases_into_tickets.js — never
-- folded into this auto-applied boot migration.
--
-- IDEMPOTENT: CREATE TABLE IF NOT EXISTS.
-- ============================================================

CREATE TABLE IF NOT EXISTS tickets_v2 (
  id                   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  orderId              INT UNSIGNED NOT NULL,        -- sequential, shared by every row of one order
  orderAnchor          INT UNSIGNED NULL,             -- = orderId, set ONLY on the first row inserted per order; NULL elsewhere (collision-detection guard, replaces the old per-purchase uqOrderIdGlobal)
  eventId              BIGINT UNSIGNED NOT NULL,      -- denormalized from the stage at reservation time
  stageId              BIGINT UNSIGNED NOT NULL,
  unitPrice            DECIMAL(12,2) NOT NULL,        -- ticket_stages.price captured at reservation time, immutable per row
  holderName           VARCHAR(160) NULL,             -- unknown at reservation; filled by submitPayment/confirmPurchase
  holderIdNumber       VARCHAR(40)  NULL,
  holderPhone          VARCHAR(20)  NULL,
  deliveryMethod       ENUM('email','whatsapp') NOT NULL DEFAULT 'whatsapp',
  deliveryContact      VARCHAR(160) NOT NULL DEFAULT '',
  status               ENUM('pending_payment','payment_submitted',
                            'confirmed','rejected','expired')
                       NOT NULL DEFAULT 'pending_payment',
  idempotencyKey       CHAR(36) NULL,                 -- populated ONLY on the anchor row
  reservationExpiresAt DATETIME NULL,                 -- NULL for walk-ins (no reservation phase)
  createdAt            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  confirmedAt          DATETIME NULL,
  confirmedBy          VARCHAR(80) NULL,
  validationHash       CHAR(64) NULL,                 -- minted ONLY at confirm (never before) — this is the door-scan security invariant
  isUsed               TINYINT(1) NOT NULL DEFAULT 0,
  usedAt               DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uqOrderAnchor (orderAnchor),
  UNIQUE KEY uqTicketIdem (idempotencyKey),
  UNIQUE KEY uqTicketHash (validationHash),
  KEY idxOrderId (orderId),
  KEY idxTicketEventStatus (eventId, status),
  KEY idxTicketSweeper (status, reservationExpiresAt),
  KEY idxTicketContact (deliveryContact),
  KEY idxTicketStage (stageId),
  CONSTRAINT fkTicketV2Event FOREIGN KEY (eventId) REFERENCES events(id),
  CONSTRAINT fkTicketV2Stage FOREIGN KEY (stageId) REFERENCES ticket_stages(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
