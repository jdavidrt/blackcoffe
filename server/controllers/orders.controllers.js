import pool from '../db.js'
import { sendErrorEmail } from '../utils/emailNotifier.js'
import { tzColombia } from '../utils/sqlFragments.js'

/**
 * Stack-merge two item lists by `id`: items with matching IDs have their
 * `quantity` summed (first occurrence's other fields win). Replaces the old
 * reject-the-whole-request-on-duplicate-id behavior (audit fix 1.5) — a
 * same-second duplicate click should stack quantity, never a 400.
 */
const stackMergeItems = (existingItems, newItems) => {
    const byId = new Map();
    const order = [];
    const push = (item) => {
        if (!item || item.id == null) return;
        const prev = byId.get(item.id);
        if (prev) {
            prev.quantity = (Number(prev.quantity) || 0) + (Number(item.quantity) || 0);
        } else {
            byId.set(item.id, { ...item });
            order.push(item.id);
        }
    };
    for (const it of existingItems) push(it);
    for (const it of newItems) push(it);
    return order.map(id => byId.get(id));
};

export const getOrders = async (req, res) => {
    try {
        const [result] = await pool.query(`
            SELECT
                orders.id, orders.deposit,
                orders.clientId, orders.paid, orders.collectedBy, orders.items,
                DATE(${tzColombia('orders.createdAt')}) AS createdAt,
                COALESCE(orders.clientPremisesSnapshot, clients.premises) AS premises,
                COALESCE(orders.clientNameSnapshot, clients.clientName) AS clientName,
                COALESCE(orders.clientMallSnapshot, clients.mall) AS mall
            FROM orders
            JOIN clients ON orders.clientId = clients.id
            WHERE orders.paid = 0 AND (orders.isAbandoned = 0 OR orders.isAbandoned IS NULL)
            ORDER BY CAST(clients.premises AS SIGNED), clients.clientname ASC, orders.createdAt ASC
        `);
        res.json(result)
    } catch (error) {
        sendErrorEmail(req, error, 'getOrders');
        return res.status(500).json({ message: 'Error obteniendo las órdenes' });
    }
}

export const getNotDeliveredOrders = async (req, res) => {
    try {
        const [result] = await pool.query(`
            SELECT
                orders.id,
                orders.deposit,
                orders.clientId,
                orders.paid,
                orders.collectedBy,
                orders.items,
                DATE(${tzColombia('orders.createdAt')}) as createdAt,
                COALESCE(orders.clientPremisesSnapshot, clients.premises) AS premises,
                COALESCE(orders.clientNameSnapshot, clients.clientName) AS clientName,
                COALESCE(orders.clientMallSnapshot, clients.mall) AS mall
            FROM
                orders
            JOIN
                clients ON orders.clientId = clients.id
            WHERE
                orders.paid = 0 AND orders.items LIKE '%"delivered":false%' AND (orders.isAbandoned = 0 OR orders.isAbandoned IS NULL)
            ORDER BY
            CAST(clients.premises AS SIGNED),
                clients.clientname ASC,
                orders.createdAt ASC
        `);
        res.json(result);
    } catch (error) {
        sendErrorEmail(req, error, 'getNotDeliveredOrders');
        return res.status(500).json({ message: 'Error obteniendo las órdenes pendientes de entrega' });
    }
}

export const getDeliveredOrders = async (req, res) => {
    try {
        const [result] = await pool.query(`
            SELECT
                orders.id,
                orders.deposit,
                orders.clientId,
                orders.paid,
                orders.collectedBy,
                orders.items,
                DATE(${tzColombia('orders.createdAt')}) as createdAt,
                COALESCE(orders.clientPremisesSnapshot, clients.premises) AS premises,
                COALESCE(orders.clientNameSnapshot, clients.clientName) AS clientName,
                COALESCE(orders.clientMallSnapshot, clients.mall) AS mall
            FROM
                orders
            JOIN
                clients ON orders.clientId = clients.id
            WHERE
                orders.items LIKE '%"delivered":true%' AND
                orders.items LIKE CONCAT('%"deliveredAt":"', ?, '"%') AND
                (orders.isAbandoned = 0 OR orders.isAbandoned IS NULL)
            ORDER BY
                CAST(clients.premises AS SIGNED),
                clients.clientname ASC,
                orders.createdAt ASC
        `, [req.params.date]);
        res.json(result);
    } catch (error) {
        sendErrorEmail(req, error, 'getDeliveredOrders');
        return res.status(500).json({ message: 'Error obteniendo las órdenes entregadas' });
    }
}

export const getDepositedOrdersByDate = async (req, res) => {
    try {
        // This query returns orders with payment activity on a specific date
        // CRITICAL: Only includes deposits from the selected date (not all deposits for the order)
        // Two scenarios:
        // 1) Orders with deposits made on selected date (multiple rows if multiple deposits same day)
        // 2) Orders marked as paid on selected date without any deposits on that date (single row with NULL deposit fields)
        const [result] = await pool.query(`
                SELECT
                deposits.orderId,
                deposits.depositId,
                CONVERT_TZ(deposits.depositCreatedAt, '+00:00', '-05:00') as depositCreatedAt,
                deposits.clientId as depositClientId,
                deposits.paymentMethod,
                deposits.depositValue,
                deposits.lastDeposit,
                deposits.newDeposit,
                deposits.isDeleted,
                deposits.deletedAt as deletedAt,  -- COLOMBIA timestamp: stored via DATE_SUB, no conversion needed
                orders.id,
                CONVERT_TZ(orders.createdAt, '+00:00', '-05:00') as createdAt,
                orders.clientId,
                orders.paidAt as paidAt,  -- MANUAL timestamp: already in Colombia time, no conversion needed
                orders.items,
                orders.deposit,
                orders.paid,
                COALESCE(orders.clientPremisesSnapshot, clients.premises) AS premises,
                COALESCE(orders.clientNameSnapshot, clients.clientName) AS clientName,
                COALESCE(orders.clientMallSnapshot, clients.mall) AS mall
            FROM
                orders
            JOIN
                clients ON orders.clientId = clients.id
            LEFT JOIN
                deposits ON deposits.orderId = orders.id
                    AND DATE(CONVERT_TZ(deposits.depositCreatedAt, '+00:00', '-05:00')) = ?
            WHERE
                ((deposits.depositId IS NOT NULL AND deposits.isDeleted = 0)
                OR (DATE(orders.paidAt) = ? AND orders.paid = 1 AND deposits.depositId IS NULL))
                AND (orders.isAbandoned = 0 OR orders.isAbandoned IS NULL)
            ORDER BY
                orders.createdAt ASC
        `, [req.params.date, req.params.date]);
        console.log(`[${new Date().toISOString()}] getDepositedOrdersByDate - Date: ${req.params.date}, Results: ${result.length}`);
        if (result.length > 0) {
            console.log(`[${new Date().toISOString()}] Sample result - orderId: ${result[0].id}, paid: ${result[0].paid}, depositValue: ${result[0].depositValue || 'NULL'}, paidAt: ${result[0].paidAt}`);
        }
        res.json(result);
    } catch (error) {
        sendErrorEmail(req, error, 'getDepositedOrdersByDate');
        return res.status(500).json({ message: 'Error obteniendo los cobros del día' });
    }
}

export const getUnPaidOrders = async (req, res) => {
    try {
        const [result] = await pool.query(`
            SELECT
                orders.id, orders.deposit,
                orders.clientId, orders.paid, orders.collectedBy, orders.items,
                DATE(${tzColombia('orders.createdAt')}) AS createdAt,
                COALESCE(orders.clientPremisesSnapshot, clients.premises) AS premises,
                COALESCE(orders.clientNameSnapshot, clients.clientName) AS clientName,
                COALESCE(orders.clientMallSnapshot, clients.mall) AS mall
            FROM orders
            JOIN clients ON orders.clientId = clients.id
            WHERE clients.mall = ? AND orders.paid = 0 AND (orders.isAbandoned = 0 OR orders.isAbandoned IS NULL)
            ORDER BY CAST(clients.premises AS SIGNED), clients.clientname ASC, orders.createdAt ASC
        `, [req.params.mall]);
        res.json(result)
    } catch (error) {
        sendErrorEmail(req, error, 'getUnPaidOrders');
        return res.status(500).json({ message: 'Error obteniendo las órdenes por ubicación' });
    }
}

export const getUnPaidOrdersbyClientId = async (req, res) => {
    try {
        const [result] = await pool.query(`
            SELECT
                orders.id,
                orders.clientId, orders.paid, orders.collectedBy, orders.items,
                DATE(${tzColombia('orders.createdAt')}) AS createdAt,
                COALESCE(orders.clientPremisesSnapshot, clients.premises) AS premises,
                COALESCE(orders.clientNameSnapshot, clients.clientName) AS clientName,
                COALESCE(orders.clientMallSnapshot, clients.mall) AS mall
            FROM orders
            JOIN clients ON orders.clientId = clients.id
            WHERE orders.clientId = ? AND orders.paid = 0 AND (orders.isAbandoned = 0 OR orders.isAbandoned IS NULL)
            ORDER BY CAST(clients.premises AS SIGNED), clients.clientname ASC, orders.createdAt ASC
        `, [req.params.clientId]);
        res.json(result)
    } catch (error) {
        sendErrorEmail(req, error, 'getUnPaidOrdersbyClientId');
        return res.status(500).json({ message: 'Error obteniendo las órdenes del cliente' });
    }
}

export const getCollectedOrders = async (req, res) => {
    try {
        // paidAt is a MANUAL timestamp (frontend sends Colombia time) - no CONVERT_TZ needed
        const [result] = await pool.query(`
            SELECT
                orders.id, DATE(orders.paidAt) AS paidAt,
                orders.clientId, orders.collectedBy, orders.paid, orders.items,
                DATE(CONVERT_TZ(orders.createdAt, '+00:00', '-05:00')) AS createdAt,
                COALESCE(orders.clientPremisesSnapshot, clients.premises) AS premises,
                COALESCE(orders.clientNameSnapshot, clients.clientName) AS clientName,
                COALESCE(orders.clientMallSnapshot, clients.mall) AS mall
            FROM orders
            JOIN clients ON orders.clientId = clients.id
            WHERE DATE(orders.paidAt) = ? AND orders.paid = 1 AND (orders.isAbandoned = 0 OR orders.isAbandoned IS NULL)
            ORDER BY CAST(clients.premises AS SIGNED), clients.clientname ASC, orders.createdAt ASC
        `, [req.params.date]);
        res.json(result)
    } catch (error) {
        sendErrorEmail(req, error, 'getCollectedOrders');
        return res.status(500).json({ message: 'Error obteniendo las órdenes cobradas' });
    }
}

export const getOrder = async (req, res) => {
    try {
        // paidAt and abandonedAt are MANUAL/COLOMBIA timestamps - no CONVERT_TZ needed
        const [result] = await pool.query(`
            SELECT
                orders.id,
                DATE(CONVERT_TZ(orders.createdAt, '+00:00', '-05:00')) AS createdAt,
                orders.clientId, orders.collectedBy, orders.paid, orders.deposit, orders.paymentMethod,
                orders.paidAt AS paidAt, orders.items, orders.isAbandoned, orders.abandonReason,
                orders.abandonedAt AS abandonedAt, orders.abandonedBy,
                COALESCE(orders.clientPremisesSnapshot, clients.premises) AS premises,
                COALESCE(orders.clientNameSnapshot, clients.clientName) AS clientName,
                COALESCE(orders.clientMallSnapshot, clients.mall) AS mall
            FROM orders
            JOIN clients ON orders.clientId = clients.id
            WHERE orders.id = ?
        `, [req.params.id]);

        if (result.length === 0)
            return res.status(404).json({ message: "Order not found" });

        res.json(result[0]);
    } catch (error) {
        sendErrorEmail(req, error, 'getOrder');
        return res.status(500).json({ message: 'Error obteniendo la orden' });
    }
}

/**
 * createOrder — implements "one unpaid order per client" server-side (audit fix 1.3).
 *
 * Locks any existing active (unpaid, non-abandoned) order for this client
 * with SELECT ... FOR UPDATE before deciding merge-vs-create, inside a
 * transaction. This closes the two-tabs-both-create race: the frontend
 * already avoids this in the common case by checking `unPaidOrder` before
 * submitting, but two concurrent submissions can both see "no unpaid order"
 * client-side — the server-side lock is what actually serializes them.
 *
 * Colliding item IDs are stack-merged (summed quantity) instead of rejecting
 * the whole request (audit fix 1.5), both when deduping the incoming cart and
 * when merging it into an existing order.
 */
export const createOrder = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        console.log(`[createOrder] Request body:`, req.body);

        const { shopId, clientId, items } = req.body;

        const [existing] = await conn.query(
            `SELECT id, items FROM orders
             WHERE clientId = ? AND paid = 0 AND (isAbandoned = 0 OR isAbandoned IS NULL)
             FOR UPDATE`,
            [clientId]
        );

        let parsedNewItems;
        try {
            parsedNewItems = JSON.parse(items || '[]');
            if (!Array.isArray(parsedNewItems)) parsedNewItems = [];
        } catch {
            await conn.rollback();
            return res.status(400).json({ message: 'items debe ser un array JSON válido.' });
        }
        parsedNewItems = stackMergeItems([], parsedNewItems);

        if (existing.length > 0) {
            const target = existing[0];
            let existingItems;
            try {
                existingItems = JSON.parse(target.items || '[]');
                if (!Array.isArray(existingItems)) existingItems = [];
            } catch { existingItems = []; }

            const mergedJson = JSON.stringify(stackMergeItems(existingItems, parsedNewItems));
            await conn.query("UPDATE orders SET items = ? WHERE id = ?", [mergedJson, target.id]);
            await conn.commit();

            console.log(`[createOrder] Merged into existing order ${target.id}`);
            return res.json({ shopId, clientId, items: mergedJson, mergedInto: target.id });
        }

        const newItemsJson = JSON.stringify(parsedNewItems);
        await conn.query(
            "INSERT INTO orders(shopId, clientId, items) VALUES (?, ?, ?)",
            [shopId, clientId, newItemsJson]
        );
        await conn.commit();

        console.log(`[createOrder] New order created`);
        res.json({ shopId, clientId, items: newItemsJson });
    } catch (error) {
        await conn.rollback();
        console.error(`[createOrder] Error:`, error);
        sendErrorEmail(req, error, 'createOrder');
        return res.status(500).json({ message: 'Error creando la orden' });
    } finally {
        conn.release();
    }
}

export const updateOrder = async (req, res) => {
    try {
        console.log(`[updateOrder] Request params:`, req.params);
        console.log(`[updateOrder] Request body:`, req.body);

        // Audit fix 1.5: stack-merge (sum quantity) any colliding IDs in the
        // incoming items array instead of rejecting the request. A no-op for
        // an already-deduped array (e.g. delivery-checkbox toggles).
        if (req.body.items) {
            try {
                const parsed = JSON.parse(req.body.items);
                if (Array.isArray(parsed)) {
                    req.body.items = JSON.stringify(stackMergeItems([], parsed));
                }
            } catch {
                // leave as-is; the SQL/existing guards below will surface a malformed value
            }
        }

        const [existing] = await pool.query('SELECT paid, clientId, items FROM orders WHERE id = ?', [req.params.id]);
        if (existing.length === 0) {
            return res.status(404).json({ message: "Order not found" });
        }
        if (Number(existing[0].paid) === 1) {
            return res.status(400).json({ message: "Order is already paid and cannot be modified", orderId: Number(req.params.id) });
        }

        // Data-loss guard: refuse to overwrite a non-empty items array with an empty one.
        // Real edits go through OrderForm (which validates cart.length > 0) and delivery toggles
        // (which preserve every item). An incoming items="[]" indicates a stale-state race —
        // never a legitimate update. Empty incoming + already-empty existing is also a no-op write.
        if (req.body.items !== undefined) {
            let incomingItems;
            try { incomingItems = JSON.parse(req.body.items); } catch { incomingItems = null; }
            if (Array.isArray(incomingItems) && incomingItems.length === 0) {
                const existingItems = (() => {
                    try { return JSON.parse(existing[0].items || '[]'); } catch { return []; }
                })();
                if (existingItems.length > 0) {
                    console.error(`[updateOrder] BLOCKED empty-items overwrite for order ${req.params.id}. Existing had ${existingItems.length} items.`);
                    return res.status(400).json({
                        message: "Empty items array rejected to prevent data loss",
                        orderId: Number(req.params.id)
                    });
                }
            }
        }

        const updateData = { ...req.body };

        // Guard against a race condition: an item can be merged into this order
        // (OrderForm) between the moment a payment form snapshots the order total
        // and the moment the payment is submitted. Re-verify "paid" against the
        // CURRENT items in the DB instead of trusting the client, so the order can
        // never get locked as paid=1 while still carrying a real balance.
        if (Number(updateData.paid) === 1) {
            let currentItems = [];
            try { currentItems = JSON.parse(existing[0].items || '[]'); } catch { currentItems = []; }
            const currentTotal = currentItems.reduce(
                (total, item) => total + (Number(item.unitValue) || 0) * (Number(item.quantity) || 0),
                0
            );
            if (!(Number(updateData.deposit) >= currentTotal)) {
                updateData.paid = 0;
                delete updateData.paidAt;
            }
        }

        if (Number(updateData.paid) === 1) {
            const [clientRows] = await pool.query(
                'SELECT clientName, premises, mall FROM clients WHERE id = ?',
                [existing[0].clientId]
            );
            if (clientRows.length > 0) {
                updateData.clientNameSnapshot = clientRows[0].clientName;
                updateData.clientPremisesSnapshot = clientRows[0].premises;
                updateData.clientMallSnapshot = clientRows[0].mall;
            }
        }

        const result = await pool.query("UPDATE orders SET ? WHERE id = ?", [
            updateData,
            req.params.id,
        ]);

        console.log(`[updateOrder] Update result:`, result);
        res.json(result);
    } catch (error) {
        console.error(`[updateOrder] Error:`, error);
        sendErrorEmail(req, error, 'updateOrder');
        res.status(500).json({ message: 'Error actualizando la orden' });
    }
}

export const getOrphanedOrders = async (req, res) => {
    try {
        const [result] = await pool.query(`
            SELECT
                orders.id,
                orders.deposit,
                orders.clientId,
                orders.paid,
                orders.collectedBy,
                orders.items,
                DATE(${tzColombia('orders.createdAt')}) as createdAt
            FROM
                orders
            LEFT JOIN
                clients ON orders.clientId = clients.id
            WHERE
                clients.id IS NULL AND orders.paid = 0 AND (orders.isAbandoned = 0 OR orders.isAbandoned IS NULL)
            ORDER BY
                orders.createdAt DESC
        `);
        res.json(result);
    } catch (error) {
        sendErrorEmail(req, error, 'getOrphanedOrders');
        return res.status(500).json({ message: 'Error obteniendo las órdenes sin cliente' });
    }
}

export const deleteOrder = async (req, res) => {
    try {
        const [deposits] = await pool.query(
            "SELECT depositId FROM deposits WHERE orderId = ? LIMIT 1",
            [req.params.id]
        );
        if (deposits.length > 0) {
            return res.status(400).json({
                message: "Order has deposits",
                orderId: Number(req.params.id),
            });
        }
        const [result] = await pool.query("DELETE FROM orders WHERE id = ?", [
            req.params.id,
        ]);
        if (result.affectedRows === 0)
            return res.status(404).json({ message: "Order not found" });
        return res.sendStatus(204);
    } catch (error) {
        sendErrorEmail(req, error, 'deleteOrder');
        return res.status(500).json({ message: 'Error eliminando la orden' });
    }
};

// Mark order as abandoned
export const markOrderAsAbandoned = async (req, res) => {
    try {
        const { id } = req.params;
        const { abandonReason, abandonedBy } = req.body;

        // Validate order exists and is not already paid
        const [order] = await pool.query('SELECT * FROM orders WHERE id = ?', [id]);

        if (!order || order.length === 0) {
            return res.status(404).json({ message: 'Order not found' });
        }

        if (order[0].paid === 1) {
            return res.status(400).json({
                message: 'Cannot abandon a paid order'
            });
        }

        // Update order as abandoned
        // IMPORTANT: Store in UTC by subtracting 5 hours from server NOW()
        // Database server is in UTC, so NOW() gives UTC time
        // To store Colombia time as if it were UTC, we subtract 5 hours
        const result = await pool.query(
            `UPDATE orders
             SET isAbandoned = 1,
                 abandonedAt = DATE_SUB(NOW(), INTERVAL 5 HOUR),
                 abandonedBy = ?,
                 abandonReason = ?
             WHERE id = ?`,
            [abandonedBy, abandonReason, id]
        );

        res.json({
            message: 'Order marked as abandoned',
            orderId: id
        });
    } catch (error) {
        console.error('Error marking order as abandoned:', error);
        sendErrorEmail(req, error, 'markOrderAsAbandoned');
        return res.status(500).json({ message: 'Error marcando la orden como abandonada' });
    }
};

// Unmark order as abandoned (reactivate)
export const unmarkOrderAsAbandoned = async (req, res) => {
    try {
        const { id } = req.params;

        // Reset abandoned fields
        const result = await pool.query(
            `UPDATE orders
             SET isAbandoned = 0,
                 abandonedAt = NULL,
                 abandonedBy = NULL,
                 abandonReason = NULL
             WHERE id = ?`,
            [id]
        );

        res.json({
            message: 'Order reactivated',
            orderId: id
        });
    } catch (error) {
        console.error('Error reactivating order:', error);
        sendErrorEmail(req, error, 'unmarkOrderAsAbandoned');
        return res.status(500).json({ message: 'Error reactivando la orden' });
    }
};

// Get all abandoned orders
export const getAbandonedOrders = async (req, res) => {
    try {
        // abandonedAt is a COLOMBIA timestamp (stored via DATE_SUB) - no CONVERT_TZ needed
        const [rows] = await pool.query(
            `SELECT
                orders.*,
                COALESCE(orders.clientNameSnapshot, clients.clientName) AS clientName,
                COALESCE(orders.clientPremisesSnapshot, clients.premises) AS premises,
                COALESCE(orders.clientMallSnapshot, clients.mall) AS mall,
                CONVERT_TZ(orders.createdAt, '+00:00', '-05:00') AS createdAt,
                orders.abandonedAt AS abandonedAt
            FROM orders
            LEFT JOIN clients ON orders.clientId = clients.id
            WHERE orders.isAbandoned = 1
            ORDER BY orders.abandonedAt DESC`
        );

        res.json(rows);
    } catch (error) {
        console.error('Error getting abandoned orders:', error);
        sendErrorEmail(req, error, 'getAbandonedOrders');
        return res.status(500).json({ message: 'Error obteniendo las órdenes abandonadas' });
    }
};
