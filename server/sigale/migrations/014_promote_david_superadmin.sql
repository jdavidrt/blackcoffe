-- ============================================================
-- SÍGALE — MIGRATION 014: promote 'David' to super_admin + attribute every event
-- Applied in production 2026-09-15. Depends on migration 010
-- (organizers.role/isActive + the organizer_events table).
-- Data-only, no new columns/tables.
--
-- Two idempotent statements:
--   1. UPDATE organizers ... WHERE username = 'David' — belt-and-suspenders
--      alongside 010's own guarded promotion (which promotes EVERY
--      pre-existing account the first time the role column is created).
--      This one is explicit by username, so it does the right thing even
--      if 010 already ran under different circumstances, or if 'David' is
--      created/renamed after 010 applied. Also forces isActive = 1 so the
--      account is never left promoted-but-locked-out.
--   2. INSERT IGNORE INTO organizer_events — one row per (David, event) for
--      every event that exists at the time this runs. This is ATTRIBUTION
--      only: a super_admin already reaches every
--      event through role alone (the authorization check never consults
--      organizer_events for a super_admin), so this grants nothing new — it
--      records "David personally organizes this event" for a future "my
--      events" view. INSERT IGNORE makes re-running harmless (PRIMARY KEY
--      is (organizerId, eventId)), and it does NOT retroactively cover an
--      event created after this migration runs — createEvent's own
--      INSERT IGNORE (events.controllers.js) already attributes new events
--      to whichever account creates them.
--
-- If no organizer named 'David' exists, both statements are safe no-ops
-- (the UPDATE matches zero rows; the SELECT in the INSERT returns none).
--
-- Scope guardrail: touches ONLY organizers + organizer_events (both
-- Sígale-owned). Never references BlackCoffe tables. Run only against
-- DB_NAME=sigale.
-- ============================================================

UPDATE organizers
   SET role = 'super_admin', isActive = 1
 WHERE username = 'David';

INSERT IGNORE INTO organizer_events (organizerId, eventId)
SELECT o.id, e.id
  FROM organizers o
  CROSS JOIN events e
 WHERE o.username = 'David';
