import pool from '../db.js'
import { sendErrorEmail } from '../utils/emailNotifier.js'

const hasDuplicateItemIds = (itemsJson) => {
    try {
        const items = JSON.parse(itemsJson);
        if (!Array.isArray(items)) return false;
        const ids = items.map(i => i.id);
        return ids.length !== new Set(ids).size;
    } catch { return false; }
};

export const getOrders = async (req, res) => {
    try {
        const [result] = await pool.query(`
            SELECT
                orders.id, orders.deposit,
                CONVERT_TZ(orders.createdAt, '+00:00', '-05:00'),
                orders.clientId, orders.paid, orders.collectedBy, orders.items,
                DATE(CONVERT_TZ(orders.createdAt, '+00:00', '-05:00')) AS createdAt,
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
        return res.status(500).json({ message: error.message });
    }
}

export const getNotDeliveredOrders = async (req, res) => {
    try {
        const [result] = await pool.query(`
            SELECT
                orders.id,
                orders.deposit,
                CONVERT_TZ(orders.createdAt, '+00:00', '-05:00') as createdAt,
                orders.clientId,
                orders.paid,
                orders.collectedBy,
                orders.items,
                DATE(CONVERT_TZ(orders.createdAt, '+00:00', '-05:00')) as createdAt,
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
        return res.status(500).json({ message: error.message });
    }
}

export const getDeliveredOrders = async (req, res) => {
    try {
        const [result] = await pool.query(`
            SELECT
                orders.id,
                orders.deposit,
                CONVERT_TZ(orders.createdAt, '+00:00', '-05:00') as createdAt,
                orders.clientId,
                orders.paid,
                orders.collectedBy,
                orders.items,
                DATE(CONVERT_TZ(orders.createdAt, '+00:00', '-05:00')) as createdAt,
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
        return res.status(500).json({ message: error.message });
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
        return res.status(500).json({ message: error.message });
    }
}

export const getUnPaidOrders = async (req, res) => {
    try {
        const [result] = await pool.query(`
            SELECT
                orders.id, orders.deposit,
                CONVERT_TZ(orders.createdAt, '+00:00', '-05:00'),
                orders.clientId, orders.paid, orders.collectedBy, orders.items,
                DATE(CONVERT_TZ(orders.createdAt, '+00:00', '-05:00')) AS createdAt,
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
        return res.status(500).json({ message: error.message });
    }
}

export const getUnPaidOrdersbyClientId = async (req, res) => {
    try {
        const [result] = await pool.query(`
            SELECT
                orders.id,
                CONVERT_TZ(orders.createdAt, '+00:00', '-05:00'),
                orders.clientId, orders.paid, orders.collectedBy, orders.items,
                DATE(CONVERT_TZ(orders.createdAt, '+00:00', '-05:00')) AS createdAt,
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
        return res.status(500).json({ message: error.message });
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
        return res.status(500).json({ message: error.message });
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
        return res.status(500).json({ message: error.message });
    }
}

export const createOrder = async (req, res) => {
    try {
        console.log(`[createOrder] Request body:`, req.body);

        const { shopId, clientId, items } = req.body
        if (hasDuplicateItemIds(items)) {
            return res.status(400).json({ message: 'Error: items duplicados detectados. Operación cancelada.' });
        }
        const result = await pool.query("INSERT INTO orders(shopId, clientId, items) VALUES (?, ?, ?)", [
            shopId,
            clientId,
            items]
        );
        console.log(`[createOrder] Create result:`, result);
        res.json({
            shopId,
            clientId,
            items,
        })
    } catch (error) {
        console.error(`[createOrder] Error:`, error);
        sendErrorEmail(req, error, 'createOrder');
        return res.status(500).json({ message: error.message });
    }
}

export const updateOrder = async (req, res) => {
    try {
        console.log(`[updateOrder] Request params:`, req.params);
        console.log(`[updateOrder] Request body:`, req.body);

        if (req.body.items && hasDuplicateItemIds(req.body.items)) {
            return res.status(400).json({ message: 'Error: items duplicados detectados. Operación cancelada.' });
        }

        const [existing] = await pool.query('SELECT paid, clientId FROM orders WHERE id = ?', [req.params.id]);
        if (existing.length === 0) {
            return res.status(404).json({ message: "Order not found" });
        }
        if (Number(existing[0].paid) === 1) {
            return res.status(400).json({ message: "Order is already paid and cannot be modified", orderId: Number(req.params.id) });
        }

        const updateData = { ...req.body };

        if (Number(req.body.paid) === 1) {
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
        res.status(500).json({ message: error.message });
    }
}

export const getOrphanedOrders = async (req, res) => {
    try {
        const [result] = await pool.query(`
            SELECT
                orders.id,
                orders.deposit,
                CONVERT_TZ(orders.createdAt, '+00:00', '-05:00') as createdAt,
                orders.clientId,
                orders.paid,
                orders.collectedBy,
                orders.items,
                DATE(CONVERT_TZ(orders.createdAt, '+00:00', '-05:00')) as createdAt
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
        return res.status(500).json({ message: error.message });
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
        return res.status(500).json({ message: error.message });
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
        return res.status(500).json({ message: error.message });
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
        return res.status(500).json({ message: error.message });
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
        return res.status(500).json({ message: error.message });
    }
};
