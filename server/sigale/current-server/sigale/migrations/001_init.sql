-- ============================================================
-- SÍGALE 2.0 — INITIAL SCHEMA (migration 001)
-- ADR-0001 §5 DDL, clean table names (no prefix), InnoDB + utf8mb4.
-- Schema delta vs ADR: events.isActive resolves "the one active event".
--
-- GUARDRAIL (SIGALE_2.0_IMPLEMENTATION_PLAN §3.1):
--   This migration touches ONLY Sígale's own tables
--   (organizers, events, ticket_stages, purchases, tickets).
--   It NEVER references BlackCoffe tables (orders, deposits,
--   clients, products, users). Every statement is additive and
--   idempotent (CREATE TABLE IF NOT EXISTS) so a shared-server
--   redeploy can never run destructive DDL against live data.
-- Run only against DB_NAME=sigale. MySQL 8.0+ (CHECK from 8.0.16).
-- ============================================================

CREATE TABLE IF NOT EXISTS organizers (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  username     VARCHAR(80)  NOT NULL,
  passwordHash VARCHAR(255) NOT NULL,             -- bcrypt/argon2, never plaintext
  createdAt    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uqOrganizerUsername (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS events (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name            VARCHAR(160) NOT NULL,
  description     TEXT NULL,
  artists         JSON NOT NULL,                  -- array of strings
  eventDate       DATETIME     NOT NULL,          -- stored UTC (ADR §8)
  openingTime     DATETIME     NOT NULL,          -- stored UTC (ADR §8)
  venue           VARCHAR(200) NOT NULL,
  venueCapacity   INT UNSIGNED NOT NULL,          -- aforo: absolute ceiling
  flyerImageUrl   VARCHAR(500) NULL,
  bankQrImageUrl  VARCHAR(500) NULL,
  whatsappNumber  VARCHAR(20)  NULL,
  isActive        TINYINT(1)   NOT NULL DEFAULT 0, -- schema delta: the single active event
  createdAt       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idxEventActive (isActive)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ticket_stages (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  eventId           BIGINT UNSIGNED NOT NULL,
  name              VARCHAR(80)  NOT NULL,          -- "Preventa", "Venta en Taquilla"
  price             DECIMAL(12,2) NOT NULL,         -- COP; DECIMAL, never FLOAT
  totalQuantity     INT UNSIGNED NOT NULL,
  soldQuantity      INT UNSIGNED NOT NULL DEFAULT 0,
  reservedQuantity  INT UNSIGNED NOT NULL DEFAULT 0,
  sortOrder         SMALLINT UNSIGNED NOT NULL,
  activatesAt       DATETIME NULL,                  -- scheduled activation (UTC)
  status            ENUM('upcoming','active','sold_out') NOT NULL DEFAULT 'upcoming',
  PRIMARY KEY (id),
  UNIQUE KEY uqStageOrder (eventId, sortOrder),
  KEY idxStageEventStatus (eventId, status),
  CONSTRAINT fkStageEvent FOREIGN KEY (eventId) REFERENCES events(id) ON DELETE CASCADE,
  CONSTRAINT chkStageCapacity CHECK (soldQuantity + reservedQuantity <= totalQuantity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS purchases (
  id                   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  eventId              BIGINT UNSIGNED NOT NULL,
  stageId              BIGINT UNSIGNED NOT NULL,
  quantity             INT UNSIGNED NOT NULL,
  totalAmount          DECIMAL(12,2) NOT NULL,
  orderId              INT UNSIGNED NOT NULL,       -- sequential, globally unique, starts at 100
  deliveryMethod       ENUM('email','whatsapp') NOT NULL,
  deliveryContact      VARCHAR(160) NOT NULL,
  status               ENUM('pending_payment','payment_submitted',
                            'confirmed','rejected','expired')
                       NOT NULL DEFAULT 'pending_payment',
  idempotencyKey       CHAR(36) NULL,               -- client UUID; collapses dup purchases
  reservationExpiresAt DATETIME NOT NULL,           -- release backstop (24h)
  createdAt            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  confirmedAt          DATETIME NULL,
  confirmedBy          VARCHAR(80) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uqOrderIdGlobal (orderId),             -- orderId globally unique (sequential)
  UNIQUE KEY uqPurchaseIdem (idempotencyKey),       -- record idempotency
  KEY idxPurchaseEventStatus (eventId, status),
  KEY idxPurchaseSweeper (status, reservationExpiresAt), -- expired sweep
  KEY idxPurchaseContact (deliveryContact),         -- /recover
  CONSTRAINT fkPurchaseEvent FOREIGN KEY (eventId) REFERENCES events(id),
  CONSTRAINT fkPurchaseStage FOREIGN KEY (stageId) REFERENCES ticket_stages(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tickets (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  purchaseId      BIGINT UNSIGNED NOT NULL,
  holderName      VARCHAR(160) NOT NULL,
  holderIdNumber  VARCHAR(40)  NULL,
  holderPhone     VARCHAR(20)  NULL,
  validationHash  CHAR(64) NOT NULL,                -- random secret (ADR §9), minted at confirm
  isUsed          TINYINT(1) NOT NULL DEFAULT 0,
  usedAt          DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uqTicketHash (validationHash),         -- the scanner looks up by this
  KEY idxTicketPurchase (purchaseId),
  CONSTRAINT fkTicketPurchase FOREIGN KEY (purchaseId) REFERENCES purchases(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
