/**
 * Response helpers — audit fix 2.9.
 *
 * Why this exists:
 *   Returning `error.message` (and worse, `error.sqlMessage`) from controllers
 *   leaks DB schema, table names, and MySQL version to whoever called the API.
 *   This module provides a single place to:
 *     - log the full error server-side (with timestamp + operation tag),
 *     - send the operator a clean, user-facing message,
 *     - keep the stack trace out of the JSON body.
 *
 * Usage in controllers:
 *   } catch (error) {
 *     return sendError(res, error, 'updateOrder', 'Error actualizando la orden');
 *   }
 */

import { sendErrorEmail } from './emailNotifier.js';

/**
 * Log the error, optionally email it, and respond with a clean message.
 *
 * @param {object} res         Express response.
 * @param {Error}  error       The thrown error (full details stay server-side).
 * @param {string} opName      Operation tag, e.g. 'updateOrder'.
 * @param {string} userMessage Human-friendly Spanish message for the client.
 * @param {object} [opts]
 * @param {object} [opts.req]    Request to attach to the email (optional).
 * @param {number} [opts.status] HTTP status (default 500).
 */
export function sendError(res, error, opName, userMessage, opts = {}) {
    const { req, status = 500 } = opts;
    console.error(`[${new Date().toISOString()}] ${opName} - ERROR:`, error?.message || error);
    if (req) {
        try { sendErrorEmail(req, error, opName); } catch { /* fire-and-forget */ }
    }
    return res.status(status).json({ message: userMessage });
}
