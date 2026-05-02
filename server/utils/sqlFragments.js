/**
 * Reusable SQL fragments for SELECT clauses and timezone helpers.
 *
 * Why this file exists:
 *   Multiple controllers re-declare the same column lists and CONVERT_TZ
 *   expressions. Centralizing them prevents drift (e.g. the duplicate-alias
 *   bug where `createdAt` was emitted twice and only the DATE() version
 *   reached the frontend).
 *
 * Field-tagging convention:
 *   - AUTO     timestamps stored as UTC (e.g. createdAt, depositCreatedAt).
 *              Always wrap with CONVERT_TZ on read.
 *   - MANUAL   date strings already in Colombia local time (e.g. paidAt,
 *              item.deliveredAt). Read raw — never CONVERT_TZ.
 *   - COLOMBIA timestamps stored via DATE_SUB(NOW(), INTERVAL 5 HOUR)
 *              (e.g. abandonedAt, deletedAt). Read raw — never CONVERT_TZ.
 */

// CONVERT_TZ wrapper for AUTO timestamps -> Colombia.
export const tzColombia = (column) =>
    `CONVERT_TZ(${column}, '+00:00', '-05:00')`;

// Order columns shared across most order-list endpoints.
// Note: createdAtTs (timestamp) and createdAtDate (date) are DISTINCT aliases
// — never reuse `createdAt` twice in the same SELECT.
export const ORDER_LIST_COLUMNS = `
    orders.id,
    orders.deposit,
    orders.clientId,
    orders.paid,
    orders.collectedBy,
    orders.items,
    ${tzColombia('orders.createdAt')} AS createdAtTs,
    DATE(${tzColombia('orders.createdAt')}) AS createdAtDate
`;

// Same as ORDER_LIST_COLUMNS but also includes paidAt (MANUAL — no conversion).
export const ORDER_LIST_COLUMNS_WITH_PAID = `
    orders.id,
    orders.deposit,
    orders.clientId,
    orders.paid,
    orders.paidAt,
    orders.collectedBy,
    orders.items,
    ${tzColombia('orders.createdAt')} AS createdAtTs,
    DATE(${tzColombia('orders.createdAt')}) AS createdAtDate
`;

// Client columns joined onto orders for display.
export const CLIENT_JOIN_COLUMNS = `
    clients.premises,
    clients.clientName,
    clients.mall
`;

// Standard ORDER BY for any list of orders+clients sorted by premises.
export const ORDER_BY_PREMISES = `
    CAST(clients.premises AS SIGNED),
    clients.clientname ASC,
    orders.createdAt ASC
`;
