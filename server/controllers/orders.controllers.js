import pool from '../db.js'

export const getOrders = async (req, res) => {
    const [result] = await pool.query("select orders.id,orders.deposit, CONVERT_TZ(orders.createdAt, '+00:00', '-05:00'), orders.clientId, orders.paid, orders.collectedBy, orders.items, DATE(CONVERT_TZ(orders.createdAt, '+00:00', '-05:00')) as createdAt, clients.premises, clients.clientName, clients.mall from orders join clients on orders.clientId = clients.id WHERE orders.paid = 0 ORDER BY CAST(clients.premises AS SIGNED), clients.clientname ASC, orders.createdAt ASC");
    res.json(result)
}

export const getNotDeliveredOrders = async (req, res) => {
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
            clients.premises, 
            clients.clientName, 
            clients.mall 
        FROM 
            orders 
        JOIN 
            clients ON orders.clientId = clients.id 
        WHERE 
            orders.paid = 0 AND orders.items LIKE '%"delivered":false%' 
        ORDER BY 
        CAST(clients.premises AS SIGNED), 
            clients.clientname ASC, 
            orders.createdAt ASC
    `);
    res.json(result);
}

export const getDeliveredOrders = async (req, res) => {
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
            clients.premises, 
            clients.clientName, 
            clients.mall 
        FROM 
            orders 
        JOIN 
            clients ON orders.clientId = clients.id 
        WHERE 
            orders.items LIKE '%"delivered":true%' AND 
            orders.items LIKE CONCAT('%"deliveredAt":"', ?, '"%')
        ORDER BY 
            CAST(clients.premises AS SIGNED), 
            clients.clientname ASC, 
            orders.createdAt ASC
    `, [req.params.date]);
    res.json(result);
}

export const getDepositedOrdersByDate = async (req, res) => {
    // This query returns orders with payment activity on a specific date
    // CRITICAL: Only includes deposits from the selected date (not all deposits for the order)
    // Two scenarios:
    // 1) Orders with deposits made on selected date (multiple rows if multiple deposits same day)
    // 2) Orders marked as paid on selected date without any deposits on that date (single row with NULL deposit fields)
    const [result] = await pool.query(`
            SELECT
            deposits.orderId,
            deposits.depositId,
            deposits.depositCreatedAt,
            deposits.clientId as depositClientId,
            deposits.paymentMethod,
            deposits.depositValue,
            deposits.lastDeposit,
            deposits.newDeposit,
            deposits.isDeleted,
            deposits.deletedAt,
            orders.id,
            orders.createdAt,
            orders.clientId,
            orders.paidAt,
            orders.items,
            orders.deposit,
            orders.paid,
            clients.premises,
            clients.clientName,
            clients.mall
        FROM
            orders
        JOIN
            clients ON orders.clientId = clients.id
        LEFT JOIN
            deposits ON deposits.orderId = orders.id
                AND DATE(deposits.depositCreatedAt) = ?
        WHERE
            (deposits.depositId IS NOT NULL AND deposits.isDeleted = 0)
            OR (DATE(orders.paidAt) = ? AND deposits.depositId IS NULL)
        ORDER BY
            orders.createdAt ASC
    `, [req.params.date, req.params.date]);
    console.log(`[${new Date().toISOString()}] getDepositedOrdersByDate - Date: ${req.params.date}, Results: ${result.length}`);
    if (result.length > 0) {
        console.log('Sample: orderId=${result[0].id}, paid=${result[0].paid}, depositValue=${result[0].depositValue || 'NULL'}, paidAt=${result[0].paidAt}`);
    }
    res.json(result);
}



export const getUnPaidOrders = async (req, res) => {
    const [result] = await pool.query("select orders.id,orders.deposit, CONVERT_TZ(orders.createdAt, '+00:00', '-05:00'), orders.clientId, orders.paid, orders.collectedBy, orders.items, DATE(CONVERT_TZ(orders.createdAt, '+00:00', '-05:00')) as createdAt, clients.premises, clients.clientName, clients.mall from orders join clients on orders.clientId = clients.id WHERE clients.mall = ? and orders.paid = 0 ORDER BY CAST(clients.premises AS SIGNED), clients.clientname ASC, orders.createdAt ASC", [
        req.params.mall,
    ]);
    res.json(result)
}

export const getUnPaidOrdersbyClientId = async (req, res) => {
    const [result] = await pool.query("select orders.id, CONVERT_TZ(orders.createdAt, '+00:00', '-05:00'), orders.clientId, orders.paid, orders.collectedBy, orders.items, DATE(CONVERT_TZ(orders.createdAt, '+00:00', '-05:00')) as createdAt, clients.premises, clients.clientName, clients.mall from orders join clients on orders.clientId = clients.id WHERE orders.clientId = ? and orders.paid = 0 ORDER BY CAST(clients.premises AS SIGNED), clients.clientname ASC, orders.createdAt ASC", [
        req.params.clientId,
    ]);
    res.json(result)
}


export const getCollectedOrders = async (req, res) => {
    const [result] = await pool.query("select orders.id , DATE(orders.paidAt), orders.clientId, orders.collectedBy, orders.paid, orders.items, DATE(orders.createdAt) as createdAt, clients.premises, clients.clientName, clients.mall from orders join clients on orders.clientId = clients.id WHERE DATE(orders.paidAt) = ? and orders.paid = 1  ORDER BY CAST(clients.premises AS SIGNED), clients.clientname ASC, orders.createdAt ASC", [
        req.params.date,
    ]);
    res.json(result)
}

export const getOrder = async (req, res) => {
    try {
        const [result] = await pool.query("SELECT orders.id, DATE(CONVERT_TZ(orders.createdAt, '+00:00', '-05:00')) as createdAt, orders.clientId, orders.collectedBy, orders.paid, orders.deposit, orders.paymentMethod, orders.paidAt, orders.items, clients.premises, clients.clientName, clients.mall FROM orders join clients on orders.clientId = clients.id WHERE orders.id = ?", [
            req.params.id,
        ]);

        if (result.length === 0)
            return res.status(404).json({ message: "Order not found" });

        res.json(result[0]);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}
export const createOrder = async (req, res) => {
    try {
        const { shopId, clientId, items } = req.body
        const result = await pool.query("INSERT INTO orders(shopId, clientId, items) VALUES (?, ?, ?)", [
            shopId,
            clientId,
            items]
        );
        res.json({
            shopId,
            clientId,
            items,
        })
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}
export const updateOrder = async (req, res) => {
    try {
        console.log(`[${new Date().toISOString()}] updateOrder - Order ID: ${req.params.id}`);
        console.log(`[${new Date().toISOString()}] updateOrder - Update data:`, req.body);

        const result = await pool.query("UPDATE orders SET ? WHERE id = ?", [
            req.body,
            req.params.id,
        ]);

        console.log(`[${new Date().toISOString()}] updateOrder - Update result:`, {
            affectedRows: result[0].affectedRows,
            changedRows: result[0].changedRows
        });

        res.json(result);
    } catch (error) {
        console.error(`[${new Date().toISOString()}] updateOrder - ERROR:`, error);
        console.error(`[${new Date().toISOString()}] updateOrder - Error details:`, {
            message: error.message,
            code: error.code,
            errno: error.errno,
            sqlMessage: error.sqlMessage
        });
        return res.status(500).json({
            message: error.message,
            sqlMessage: error.sqlMessage
        });
    }
}
export const getOrphanedOrders = async (req, res) => {
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
            clients.id IS NULL AND orders.paid = 0
        ORDER BY
            orders.createdAt DESC
    `);
    res.json(result);
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
        return res.status(500).json({ message: error.message });
    }
};

// Mark order as abandoned - DISABLED (database missing isAbandoned columns)
/*
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
        const result = await pool.query(
            `UPDATE orders
             SET isAbandoned = 1,
                 abandonedAt = NOW(),
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
        return res.status(500).json({ message: error.message });
    }
};
*/

// Unmark order as abandoned (reactivate) - DISABLED (database missing isAbandoned columns)
/*
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
        return res.status(500).json({ message: error.message });
    }
};
*/

// Get all abandoned orders - DISABLED (database missing isAbandoned columns)
/*
export const getAbandonedOrders = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT
                orders.*,
                clients.clientName AS clientName,
                clients.premises AS premises,
                clients.mall AS mall,
                CONVERT_TZ(orders.createdAt, '+00:00', '-05:00') AS createdAt,
                CONVERT_TZ(orders.abandonedAt, '+00:00', '-05:00') AS abandonedAt
            FROM orders
            LEFT JOIN clients ON orders.clientId = clients.id
            WHERE orders.isAbandoned = 1
            ORDER BY orders.abandonedAt DESC`
        );

        res.json(rows);
    } catch (error) {
        console.error('Error getting abandoned orders:', error);
        return res.status(500).json({ message: error.message });
    }
};
*/

