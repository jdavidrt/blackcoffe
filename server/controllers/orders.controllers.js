import pool from '../db.js'
import { sendErrorEmail } from '../utils/emailNotifier.js'
import {
    ORDER_LIST_COLUMNS,
    ORDER_LIST_COLUMNS_WITH_PAID,
    CLIENT_JOIN_COLUMNS,
    ORDER_BY_PREMISES,
    tzColombia
} from '../utils/sqlFragments.js'
import { pickAndValidate, ORDER_UPDATE_SCHEMA } from '../utils/validation.js'

const hasDuplicateItemIds = (itemsJson) => {
    try {
        const items = JSON.parse(itemsJson);
        if (!Array.isArray(items)) return false;
        const ids = items.map(i => i.id);
        return ids.length !== new Set(ids).size;
    } catch { return false; }
};

/**
 * Stack-merge two item lists by `id`. Items with matching IDs have their
 * `quantity` summed; the FIRST occurrence's other fields win. This is the
 * "same-second click should stack quantity" behavior (audit fix 1.5),
 * applied server-side during order merges so the merge race cannot produce
 * duplicate IDs.
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
            SELECT ${ORDER_LIST_COLUMNS}, ${CLIENT_JOIN_COLUMNS}
            FROM orders
            JOIN clients ON orders.clientId = clients.id
            WHERE orders.paid = 0 AND (orders.isAbandoned = 0 OR orders.isAbandoned IS NULL)
            ORDER BY ${ORDER_BY_PREMISES}
        `);
        res.json(result)
    } catch (error) {
        sendErrorEmail(req, error, 'getOrders');
        return res.status(500).json({ message: 'Error procesando la solicitud' });
    }
}

export const getNotDeliveredOrders = async (req, res) => {
    try {
        const [result] = await pool.query(`
            SELECT ${ORDER_LIST_COLUMNS}, ${CLIENT_JOIN_COLUMNS}
            FROM orders
            JOIN clients ON orders.clientId = clients.id
            WHERE orders.paid = 0
              AND orders.items LIKE '%"delivered":false%'
              AND (orders.isAbandoned = 0 OR orders.isAbandoned IS NULL)
            ORDER BY ${ORDER_BY_PREMISES}
        `);
        res.json(result);
    } catch (error) {
        sendErrorEmail(req, error, 'getNotDeliveredOrders');
        return res.status(500).json({ message: 'Error procesando la solicitud' });
    }
}

export const getDeliveredOrders = async (req, res) => {
    try {
        const [result] = await pool.query(`
            SELECT ${ORDER_LIST_COLUMNS}, ${CLIENT_JOIN_COLUMNS}
            FROM orders
            JOIN clients ON orders.clientId = clients.id
            WHERE orders.items LIKE '%"delivered":true%'
              AND orders.items LIKE CONCAT('%"deliveredAt":"', ?, '"%')
              AND (orders.isAbandoned = 0 OR orders.isAbandoned IS NULL)
            ORDER BY ${ORDER_BY_PREMISES}
        `, [req.params.date]);
        res.json(result);
    } catch (error) {
        sendErrorEmail(req, error, 'getDeliveredOrders');
        return res.status(500).json({ message: 'Error procesando la solicitud' });
    }
}

export const getDepositedOrdersByDate = async (req, res) => {
    try {
        // This query returns orders with payment activity on a specific date
        // Two scenarios:
        // 1) Orders with deposits made on selected date (multiple rows if multiple deposits same day)
        // 2) Orders marked as paid on selected date without deposits on that date (single row, NULL deposit fields)
        // Field tags:
        //   - depositCreatedAt: AUTO (UTC) -> CONVERT_TZ on read
        //   - paidAt:           MANUAL (Colombia date string) -> read raw
        //   - deletedAt:        COLOMBIA (stored via DATE_SUB) -> read raw
        const [result] = await pool.query(`
            SELECT
                deposits.orderId,
                deposits.depositId,
                ${tzColombia('deposits.depositCreatedAt')} AS depositCreatedAt,
                deposits.clientId AS depositClientId,
                deposits.paymentMethod,
                deposits.depositValue,
                deposits.lastDeposit,
                deposits.newDeposit,
                deposits.isDeleted,
                deposits.deletedAt AS deletedAt,
                orders.id,
                ${tzColombia('orders.createdAt')} AS createdAtTs,
                DATE(${tzColombia('orders.createdAt')}) AS createdAtDate,
                orders.clientId,
                orders.paidAt AS paidAt,
                orders.items,
                orders.deposit,
                orders.paid,
                ${CLIENT_JOIN_COLUMNS}
            FROM orders
            JOIN clients ON orders.clientId = clients.id
            LEFT JOIN deposits
                ON deposits.orderId = orders.id
                AND DATE(${tzColombia('deposits.depositCreatedAt')}) = ?
            WHERE
                ((deposits.depositId IS NOT NULL AND deposits.isDeleted = 0)
                OR (DATE(orders.paidAt) = ? AND orders.paid = 1 AND deposits.depositId IS NULL))
                AND (orders.isAbandoned = 0 OR orders.isAbandoned IS NULL)
            ORDER BY orders.createdAt ASC
        `, [req.params.date, req.params.date]);
        console.log(`[${new Date().toISOString()}] getDepositedOrdersByDate - Date: ${req.params.date}, Results: ${result.length}`);
        res.json(result);
    } catch (error) {
        sendErrorEmail(req, error, 'getDepositedOrdersByDate');
        return res.status(500).json({ message: 'Error procesando la solicitud' });
    }
}

export const getUnPaidOrders = async (req, res) => {
    try {
        const [result] = await pool.query(`
            SELECT ${ORDER_LIST_COLUMNS}, ${CLIENT_JOIN_COLUMNS}
            FROM orders
            JOIN clients ON orders.clientId = clients.id
            WHERE clients.mall = ?
              AND orders.paid = 0
              AND (orders.isAbandoned = 0 OR orders.isAbandoned IS NULL)
            ORDER BY ${ORDER_BY_PREMISES}
        `, [req.params.mall]);
        res.json(result)
    } catch (error) {
        sendErrorEmail(req, error, 'getUnPaidOrders');
        return res.status(500).json({ message: 'Error procesando la solicitud' });
    }
}

export const getUnPaidOrdersbyClientId = async (req, res) => {
    try {
        const [result] = await pool.query(`
            SELECT ${ORDER_LIST_COLUMNS}, ${CLIENT_JOIN_COLUMNS}
            FROM orders
            JOIN clients ON orders.clientId = clients.id
            WHERE orders.clientId = ?
              AND orders.paid = 0
              AND (orders.isAbandoned = 0 OR orders.isAbandoned IS NULL)
            ORDER BY ${ORDER_BY_PREMISES}
        `, [req.params.clientId]);
        res.json(result)
    } catch (error) {
        sendErrorEmail(req, error, 'getUnPaidOrdersbyClientId');
        return res.status(500).json({ message: 'Error procesando la solicitud' });
    }
}

export const getCollectedOrders = async (req, res) => {
    try {
        // paidAt is MANUAL (Colombia local) — no CONVERT_TZ.
        const [result] = await pool.query(`
            SELECT
                orders.id,
                DATE(orders.paidAt) AS paidAt,
                orders.clientId,
                orders.collectedBy,
                orders.paid,
                orders.items,
                DATE(${tzColombia('orders.createdAt')}) AS createdAtDate,
                ${tzColombia('orders.createdAt')} AS createdAtTs,
                ${CLIENT_JOIN_COLUMNS}
            FROM orders
            JOIN clients ON orders.clientId = clients.id
            WHERE DATE(orders.paidAt) = ?
              AND orders.paid = 1
              AND (orders.isAbandoned = 0 OR orders.isAbandoned IS NULL)
            ORDER BY ${ORDER_BY_PREMISES}
        `, [req.params.date]);
        res.json(result)
    } catch (error) {
        sendErrorEmail(req, error, 'getCollectedOrders');
        return res.status(500).json({ message: 'Error procesando la solicitud' });
    }
}

export const getOrder = async (req, res) => {
    try {
        // paidAt and abandonedAt are MANUAL/COLOMBIA — no CONVERT_TZ.
        const [result] = await pool.query(`
            SELECT
                orders.id,
                DATE(${tzColombia('orders.createdAt')}) AS createdAtDate,
                ${tzColombia('orders.createdAt')} AS createdAtTs,
                orders.clientId,
                orders.collectedBy,
                orders.paid,
                orders.deposit,
                orders.paymentMethod,
                orders.paidAt AS paidAt,
                orders.items,
                orders.isAbandoned,
                orders.abandonReason,
                orders.abandonedAt AS abandonedAt,
                orders.abandonedBy,
                ${CLIENT_JOIN_COLUMNS}
            FROM orders
            JOIN clients ON orders.clientId = clients.id
            WHERE orders.id = ?
        `, [req.params.id]);

        if (result.length === 0)
            return res.status(404).json({ message: "Order not found" });

        res.json(result[0]);
    } catch (error) {
        sendErrorEmail(req, error, 'getOrder');
        return res.status(500).json({ message: 'Error procesando la solicitud' });
    }
}

/**
 * createOrder — implements business rule "one unpaid order per client" server-side.
 *
 * If the client already has an active unpaid order, the new items are MERGED
 * into the existing order inside a transaction with `SELECT ... FOR UPDATE`,
 * which serializes concurrent submissions and eliminates the race that lets
 * two tabs both create orders.
 */
export const createOrder = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        console.log(`[createOrder] Request body:`, req.body);

        const { shopId, clientId, items } = req.body;

        // Lock any existing active unpaid orders for this client until we commit.
        const [existing] = await conn.query(
            `SELECT id, items FROM orders
             WHERE clientId = ?
               AND paid = 0
               AND (isAbandoned = 0 OR isAbandoned IS NULL)
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

        // Audit fix 1.5: dedupe-and-stack any colliding IDs in the inbound cart
        // (e.g. two same-second clicks). Per business rule, same product added
        // at the same second should sum quantity, never produce HTTP 400.
        parsedNewItems = stackMergeItems([], parsedNewItems);

        if (existing.length > 0) {
            // MERGE path — stack-merge new items into the existing order so
            // colliding IDs (rare, but possible if two sessions added the same
            // product in the same second) sum quantity instead of crashing.
            const target = existing[0];
            let existingItems = [];
            try {
                existingItems = JSON.parse(target.items || '[]');
                if (!Array.isArray(existingItems)) existingItems = [];
            } catch { existingItems = []; }

            const mergedItems = stackMergeItems(existingItems, parsedNewItems);
            const mergedJson = JSON.stringify(mergedItems);

            await conn.query("UPDATE orders SET items = ? WHERE id = ?", [mergedJson, target.id]);
            await conn.commit();

            console.log(`[createOrder] Merged into existing order ${target.id}`);
            return res.json({ shopId, clientId, items: mergedJson, mergedInto: target.id });
        }

        // CREATE path — no existing unpaid order. Use stack-merged items.
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
        return res.status(500).json({ message: 'Error procesando la solicitud' });
    } finally {
        conn.release();
    }
}

export const updateOrder = async (req, res) => {
    try {
        console.log(`[updateOrder] Request params:`, req.params);
        console.log(`[updateOrder] Request body:`, req.body);

        // Audit fix 2.7: whitelist body keys against ORDER_UPDATE_SCHEMA.
        // An attacker can no longer inject `isDeleted: 1` or arbitrary columns
        // because the SET ? clause only sees keys we approved.
        const { value, errors } = pickAndValidate(req.body, ORDER_UPDATE_SCHEMA);
        if (errors) {
            return res.status(400).json({ message: errors[0] });
        }
        if (Object.keys(value).length === 0) {
            return res.status(400).json({ message: 'No hay campos válidos para actualizar' });
        }

        // Audit fix 1.5: stack-merge incoming items rather than rejecting on
        // duplicate IDs (same-second adds should sum quantity).
        if (value.items) {
            try {
                const parsed = JSON.parse(value.items);
                if (Array.isArray(parsed)) {
                    value.items = JSON.stringify(stackMergeItems([], parsed));
                }
            } catch {
                // leave as-is; the SQL will fail loudly if it's truly malformed
            }
        }

        const result = await pool.query("UPDATE orders SET ? WHERE id = ?", [
            value,
            req.params.id,
        ]);

        console.log(`[updateOrder] Update result:`, result);
        res.json(result);
    } catch (error) {
        console.error(`[updateOrder] Error:`, error);
        sendErrorEmail(req, error, 'updateOrder');
        // Audit fix 2.9 — do not leak SQL state to the client.
        res.status(500).json({ message: 'Error actualizando la orden' });
    }
}

export const getOrphanedOrders = async (req, res) => {
    try {
        const [result] = await pool.query(`
            SELECT ${ORDER_LIST_COLUMNS}
            FROM orders
            LEFT JOIN clients ON orders.clientId = clients.id
            WHERE clients.id IS NULL
              AND orders.paid = 0
              AND (orders.isAbandoned = 0 OR orders.isAbandoned IS NULL)
            ORDER BY orders.createdAt DESC
        `);
        res.json(result);
    } catch (error) {
        sendErrorEmail(req, error, 'getOrphanedOrders');
        return res.status(500).json({ message: 'Error procesando la solicitud' });
    }
}

export const deleteOrder = async (req, res) => {
    try {
        const [result] = await pool.query("DELETE FROM orders WHERE id = ?", [
            req.params.id,
        ]);
        if (result.affectedRows === 0)
            return res.status(404).json({ message: "Order not found" });
        return res.sendStatus(204);
    } catch (error) {
        sendErrorEmail(req, error, 'deleteOrder');
        return res.status(500).json({ message: 'Error procesando la solicitud' });
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

        // abandonedAt: COLOMBIA (stored via DATE_SUB)
        await pool.query(
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
        return res.status(500).json({ message: 'Error procesando la solicitud' });
    }
};

// Unmark order as abandoned (reactivate)
export const unmarkOrderAsAbandoned = async (req, res) => {
    try {
        const { id } = req.params;

        await pool.query(
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
        return res.status(500).json({ message: 'Error procesando la solicitud' });
    }
};

// Get all abandoned orders
export const getAbandonedOrders = async (req, res) => {
    try {
        // abandonedAt is COLOMBIA — no CONVERT_TZ.
        const [rows] = await pool.query(`
            SELECT
                orders.*,
                clients.clientName AS clientName,
                clients.premises AS premises,
                clients.mall AS mall,
                ${tzColombia('orders.createdAt')} AS createdAtTs,
                DATE(${tzColombia('orders.createdAt')}) AS createdAtDate,
                orders.abandonedAt AS abandonedAt
            FROM orders
            LEFT JOIN clients ON orders.clientId = clients.id
            WHERE orders.isAbandoned = 1
            ORDER BY orders.abandonedAt DESC
        `);

        res.json(rows);
    } catch (error) {
        console.error('Error getting abandoned orders:', error);
        sendErrorEmail(req, error, 'getAbandonedOrders');
        return res.status(500).json({ message: 'Error procesando la solicitud' });
    }
};
