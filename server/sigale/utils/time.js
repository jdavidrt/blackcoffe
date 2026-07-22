/*
 * ============================================================
 * SÍGALE — TIMEZONE (single source of truth)  [Phase 5, §5]
 *
 * One module so every controller and job speaks the same time
 * dialect, instead of redeclaring `BOGOTA`/`UTC` and the
 * CONVERT_TZ dance in five places.
 *
 * The rule (ADR-0001 §8): persist UTC (UTC_TIMESTAMP() / the
 * CURRENT_TIMESTAMP column defaults), read back in Bogotá wall
 * time with CONVERT_TZ, format AM/PM on the client. The pool runs
 * with dateStrings:true, so DATETIME values are plain strings the
 * driver never shifts across zones.
 *
 * Helpers return SQL *fragments* (composed into queries) or a JS
 * string (toSqlUtc). They change nothing about behaviour — they
 * just give the existing expressions one home.
 * ============================================================
 */

/** Bogotá is UTC-5, no DST. */
export const BOGOTA = '-05:00';
export const UTC = '+00:00';

/**
 * SQL fragment: read a stored-UTC column back as Bogotá wall time.
 *   fromUtc('p.createdAt', 'createdAt') -> "CONVERT_TZ(p.createdAt, '+00:00', '-05:00') AS createdAt"
 *
 * @param {string} expr   column or expression stored in UTC
 * @param {string} [alias] optional `AS <alias>`
 */
export function fromUtc(expr, alias) {
  const conv = `CONVERT_TZ(${expr}, '${UTC}', '${BOGOTA}')`;
  return alias ? `${conv} AS ${alias}` : conv;
}

/**
 * ISO-8601 -> 'YYYY-MM-DD HH:mm:ss' in UTC. For binding a JS Date/ISO string
 * into a dateStrings pool, which stores the literal wall-clock we give it.
 * Used by the scan reconciliation (offline timestamps) — kept here so the
 * conversion lives with the rest of the time logic.
 */
export function toSqlUtc(iso) {
  return new Date(iso).toISOString().slice(0, 19).replace('T', ' ');
}
