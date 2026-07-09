/**
 * Broad, order-independent, partial text match.
 * Splits `query` into whitespace-separated tokens; every token must appear
 * (as a substring) somewhere across the joined `fields`. This makes searches
 * like "103 paisa", "paisa 103" and "103 pais" all match the same record.
 *
 * @param {string} query  Raw search input
 * @param {...*}   fields  Values to search across (coerced to string, null-safe)
 * @returns {boolean}
 */
export const matchesSearch = (query, ...fields) => {
  const tokens = String(query || '')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0) return true;
  const hay = fields.map((f) => String(f ?? '')).join(' ').toLowerCase();
  return tokens.every((t) => hay.includes(t));
};
