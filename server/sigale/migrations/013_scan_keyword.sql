-- ============================================================
-- SÍGALE — MIGRATION 013: events.scanKeyword (public door-scan access)
-- DRAFT — validated in docs/architecture/DB_SCHEMA.md 2026-09-15, NOT YET
-- applied anywhere (not local, not production). No backend code reads or
-- writes this column yet.
--
-- Enables a NEW public door-scan model (decision 2026-09-15): /scan stops
-- requiring organizer credentials. Any individual opens /scan, picks the
-- event they are working, and types that event's keyword; a correct keyword
-- unlocks the scan + register (mark-used) flow FOR THAT EVENT ONLY. Multiple
-- people can scan the same event at once (the check is per-request and
-- stateless — no shared session). This is the only scan UI — organizers use
-- it too; POST /api/admin/scan stays API-only for compatibility.
--
-- Column added to `events`:
--   scanKeyword VARCHAR(80) NULL — a shared door code the organizer sets on
--     the event form and hands to door staff. NULL disables public scanning
--     for that event (only credentialed organizers can scan it then). It is a
--     low-stakes access code scoped to ONE event, NOT a user password:
--       * validated server-side on every public scan request,
--       * a correct keyword for event A can only mark event A's tickets used
--         (the scan checks ticket.eventId === the selected event),
--       * rotatable by editing the event,
--       * the mark-used write stays idempotent and organizer-reversible.
--     SECURITY INVARIANT: scanKeyword must NEVER appear in any public event
--     payload (GET /api/events, /by-slug, the scanner's event picker) — it is
--     returned only to an authenticated organizer editing the event. The
--     public scan endpoints must be rate-limited (brute-force guard, like
--     /api/login). Storing plaintext is deliberate (the organizer re-views and
--     re-shares it); revisit hashing if the threat model changes.
--
-- IDEMPOTENT: guarded via information_schema + PREPARE/EXECUTE, matching
-- 002/007/008's pattern. Each line below is a single statement (no inline
-- ';' / '--'). Scope guardrail: touches ONLY the Sígale-owned `events`
-- table. Never references BlackCoffe tables. Run only against DB_NAME=sigale.
-- ============================================================

SET @scan_kw_col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'events' AND COLUMN_NAME = 'scanKeyword');
SET @ddl_scan_kw := IF(@scan_kw_col_exists = 0, 'ALTER TABLE events ADD COLUMN scanKeyword VARCHAR(80) NULL AFTER isArchived', 'DO 0');
PREPARE st_scan_kw FROM @ddl_scan_kw;
EXECUTE st_scan_kw;
DEALLOCATE PREPARE st_scan_kw;
