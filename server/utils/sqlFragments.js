
// CONVERT_TZ wrapper for AUTO timestamps (stored UTC) -> Colombia local time.
export const tzColombia = (column) =>
    `CONVERT_TZ(${column}, '+00:00', '-05:00')`;

// A Colombia day `?` as a range on a UTC-stored TIMESTAMP (createdAt, depositCreatedAt). Same rows
// as DATE(CONVERT_TZ(col, ...)) = ?, but an index on the column can serve it (docs/PERFORMANCE_AUDIT.md, N2).
// Takes the date twice: [date, date].
export const colombiaDayUtc = (column) =>
    `${column} >= TIMESTAMP(?) + INTERVAL 5 HOUR AND ${column} < TIMESTAMP(?) + INTERVAL 29 HOUR`;

// Same for columns already stored in Colombia time (paidAt). Takes [date, date].
export const colombiaDay = (column) =>
    `${column} >= TIMESTAMP(?) AND ${column} < TIMESTAMP(?) + INTERVAL 1 DAY`;

// An order's total computed in MySQL, so list screens don't pull every order's `items` from the
// database (up to 88 KB each, ~2 MB per list; docs/PERFORMANCE_AUDIT.md, N8). Mirrors
// computeOrderTotal (deposits.controllers.js): malformed JSON, a non-array or a bad value counts
// as 0. Keep the two in sync: createDeposit validates payments with the JS one.
export const orderTotalSql = (itemsColumn) => `(
    SELECT COALESCE(SUM(jt.u * jt.q), 0)
    FROM JSON_TABLE(
        CASE WHEN JSON_VALID(${itemsColumn}) THEN CASE WHEN JSON_TYPE(${itemsColumn}) = 'ARRAY' THEN ${itemsColumn} END END,
        '$[*]' COLUMNS (
            u DOUBLE PATH '$.unitValue' DEFAULT '0' ON EMPTY DEFAULT '0' ON ERROR,
            q DOUBLE PATH '$.quantity'  DEFAULT '0' ON EMPTY DEFAULT '0' ON ERROR
        )
    ) jt
)`;
