-- ============================================================
-- SÍGALE 2.0 — MIGRATION 006: guest passes (artist/crew/courtesy)
-- Free-entry roster, scoped to an event and to a band from the event's
-- own lineup (events.artists). NOT part of the tickets/ticket_stages/
-- payment pipeline (no price, no QR/scan integration) — door staff
-- check the name+ID manually against this list.
--
-- IDEMPOTENT: CREATE TABLE IF NOT EXISTS.
-- ============================================================

CREATE TABLE IF NOT EXISTS guest_passes (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  eventId        BIGINT UNSIGNED NOT NULL,
  band           VARCHAR(160) NOT NULL,
  holderName     VARCHAR(160) NOT NULL,
  holderIdNumber VARCHAR(40)  NOT NULL,
  type           ENUM('artist','crew','courtesy') NOT NULL,
  createdAt      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idxGuestPassEvent (eventId),
  KEY idxGuestPassBand (eventId, band),
  CONSTRAINT fkGuestPassEvent FOREIGN KEY (eventId) REFERENCES events(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
