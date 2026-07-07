import { gunzipSync } from 'node:zlib';
import pool from '../db.js';
import { sendErrorEmail } from '../utils/emailNotifier.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const normPaidAt = (v) => (v ? String(v).slice(0, 10) : null);

/**
 * GET /backupDates — distinct snapshotDate values that actually have data,
 * so the frontend calendar can only allow selecting days with real copies
 * instead of the whole retention window (snapshots only exist from the day
 * the nightly job first ran onward — pruning already keeps this list bounded).
 */
export const getBackupDates = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT DISTINCT snapshotDate FROM order_snapshots ORDER BY snapshotDate ASC`
        );
        res.json(rows.map((r) => normPaidAt(r.snapshotDate)));
    } catch (error) {
        sendErrorEmail(req, error, 'getBackupDates');
        return res.status(500).json({ message: "Error obteniendo las fechas de copias de seguridad" });
    }
};

/**
 * GET /backupsByDate/:date — the reconstructed state of every order as of :date.
 *
 * Returns the latest snapshot per order with snapshotDate <= :date (a "restore
 * to day X" = latest snapshot on or before X). itemsGz is gunzipped server-side
 * and returned as a raw JSON string so the frontend reuses jsonUtils/orderUtils
 * unchanged. Display fields use the COALESCE(snapshot, live) convention.
 */
export const getBackupsByDate = async (req, res) => {
    const { date } = req.params;
    if (!DATE_RE.test(date)) {
        return res.status(400).json({ message: "Fecha inválida" });
    }
    try {
        const [rows] = await pool.query(
            `SELECT s.id AS snapshotId, s.orderId, s.snapshotDate, s.itemsGz,
                    s.deposit, s.paid, s.paidAt,
                    o.id AS orderRowId, o.paid AS currentPaid, o.isAbandoned,
                    COALESCE(o.clientNameSnapshot, c.clientName) AS clientName,
                    COALESCE(o.clientPremisesSnapshot, c.premises) AS premises,
                    COALESCE(o.clientMallSnapshot, c.mall) AS mall
               FROM order_snapshots s
               JOIN (SELECT orderId, MAX(snapshotDate) AS md
                       FROM order_snapshots
                      WHERE snapshotDate <= ?
                      GROUP BY orderId) m
                 ON m.orderId = s.orderId AND m.md = s.snapshotDate
               LEFT JOIN orders o ON o.id = s.orderId
               LEFT JOIN clients c ON o.clientId = c.id
              ORDER BY CAST(COALESCE(o.clientPremisesSnapshot, c.premises) AS SIGNED),
                       clientName ASC`,
            [date]
        );

        const result = rows.map((r) => {
            let items = '[]';
            try { items = gunzipSync(r.itemsGz).toString('utf8'); } catch { items = '[]'; }
            return {
                snapshotId: r.snapshotId,
                orderId: r.orderId,
                snapshotDate: normPaidAt(r.snapshotDate),
                items,
                deposit: r.deposit,
                paid: Number(r.paid),
                paidAt: normPaidAt(r.paidAt),
                orderExists: r.orderRowId != null ? 1 : 0,
                currentPaid: r.currentPaid == null ? 0 : Number(r.currentPaid),
                isAbandoned: r.isAbandoned == null ? 0 : Number(r.isAbandoned),
                clientName: r.clientName || '(sin cliente)',
                premises: r.premises || '',
                mall: r.mall || 'Otros',
            };
        });

        res.json(result);
    } catch (error) {
        sendErrorEmail(req, error, 'getBackupsByDate');
        return res.status(500).json({ message: "Error obteniendo las copias de seguridad" });
    }
};

/**
 * PUT /order/:id/restore — body { snapshotId, restoredBy }.
 *
 * Overwrites the order's items/paid/paidAt from a snapshot inside an atomic
 * transaction (skeleton copied from createDeposit). `deposit` is NEVER touched
 * — abonos are not restored. Deliberately NOT routed through updateOrder so its
 * paid-immutability guard stays untouched. Records an order_restores audit row.
 */
export const restoreOrderFromSnapshot = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const orderId = Number(req.params.id);
        const { snapshotId, restoredBy } = req.body;

        if (!snapshotId) {
            await conn.rollback();
            return res.status(400).json({ message: "snapshotId requerido" });
        }

        const [orderRows] = await conn.query(
            "SELECT id, clientId, items, paid FROM orders WHERE id = ? FOR UPDATE",
            [orderId]
        );
        if (orderRows.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: "Orden no encontrada" });
        }
        const order = orderRows[0];

        const [snapRows] = await conn.query(
            "SELECT id, orderId, itemsGz, paid, paidAt, snapshotDate FROM order_snapshots WHERE id = ?",
            [snapshotId]
        );
        if (snapRows.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: "Copia de seguridad no encontrada" });
        }
        const snapshot = snapRows[0];
        if (snapshot.orderId !== orderId) {
            await conn.rollback();
            return res.status(400).json({ message: "La copia de seguridad no corresponde a esta orden" });
        }

        // Written back verbatim — the LIKE '%"delivered":false%' text-matching
        // queries depend on the exact key formatting.
        let snapshotItems = '[]';
        try { snapshotItems = gunzipSync(snapshot.itemsGz).toString('utf8'); } catch { snapshotItems = '[]'; }

        // Empty-items guard (mirrors updateOrder): never overwrite a non-empty
        // order with an empty snapshot.
        let snapParsed = null;
        try { snapParsed = JSON.parse(snapshotItems); } catch { snapParsed = null; }
        const currentItems = (() => {
            try { return JSON.parse(order.items || '[]'); } catch { return []; }
        })();
        if (Array.isArray(snapParsed) && snapParsed.length === 0 && currentItems.length > 0) {
            await conn.rollback();
            return res.status(400).json({
                message: "La copia está vacía y no puede sobrescribir una orden con productos"
            });
        }

        const snapPaid = Number(snapshot.paid);
        const wasPaid = Number(order.paid) === 1;
        const updateData = { items: snapshotItems, paid: snapPaid };

        if (snapPaid === 1) {
            updateData.paidAt = normPaidAt(snapshot.paidAt);
            if (!wasPaid) {
                // 0 -> 1: capture client snapshot so the now-paid order survives client edits.
                const [clientRows] = await conn.query(
                    'SELECT clientName, premises, mall FROM clients WHERE id = ?',
                    [order.clientId]
                );
                if (clientRows.length > 0) {
                    updateData.clientNameSnapshot = clientRows[0].clientName;
                    updateData.clientPremisesSnapshot = clientRows[0].premises;
                    updateData.clientMallSnapshot = clientRows[0].mall;
                }
            }
        } else {
            updateData.paidAt = null;
            if (wasPaid) {
                // 1 -> 0: clear stale client snapshots so live COALESCE fall-through resumes.
                updateData.clientNameSnapshot = null;
                updateData.clientPremisesSnapshot = null;
                updateData.clientMallSnapshot = null;
            }
        }

        await conn.query("UPDATE orders SET ? WHERE id = ?", [updateData, orderId]);

        // restoredAt is a COLOMBIA timestamp (stored via DATE_SUB); restoredFromDate
        // is denormalized so the badge survives snapshot pruning.
        await conn.query(
            `INSERT INTO order_restores (orderId, snapshotId, restoredFromDate, restoredBy, restoredAt)
             VALUES (?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL 5 HOUR))`,
            [orderId, snapshot.id, snapshot.snapshotDate, restoredBy || 'Unknown']
        );

        await conn.commit();

        res.json({
            message: "Orden restaurada",
            orderId,
            restoredFromDate: normPaidAt(snapshot.snapshotDate),
            paid: snapPaid,
        });
    } catch (error) {
        await conn.rollback();
        console.error(`[${new Date().toISOString()}] restoreOrderFromSnapshot - ERROR:`, error);
        sendErrorEmail(req, error, 'restoreOrderFromSnapshot');
        return res.status(500).json({ message: "Error restaurando la orden" });
    } finally {
        conn.release();
    }
};

/**
 * GET /orderRestores/:orderId — the restore audit trail for one order.
 * restoredAt is already a Colombia timestamp (stored via DATE_SUB) — no CONVERT_TZ.
 */
export const getOrderRestores = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT id, orderId, snapshotId, restoredFromDate, restoredBy, restoredAt
               FROM order_restores
              WHERE orderId = ?
              ORDER BY restoredAt ASC`,
            [req.params.orderId]
        );
        res.json(rows);
    } catch (error) {
        sendErrorEmail(req, error, 'getOrderRestores');
        return res.status(500).json({ message: "Error obteniendo el historial de restauraciones" });
    }
};
