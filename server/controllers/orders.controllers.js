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
    const [result] = await pool.query(`
            SELECT DISTINCT
            deposits.orderId,
            deposits.depositId,
            deposits.depositCreatedAt,
            deposits.clientId,
            deposits.paymentMethod,
            deposits.depositValue,
            deposits.lastDeposit,
            deposits.newDeposit,
            orders.id,
            orders.createdAt,
            orders.shopId,
            orders.clientId,
            orders.paymentMethod,
            orders.paid,
            orders.paidAt,
            orders.items,
            orders.deposit,
            orders.collectedBy
        FROM 
            deposits
        JOIN 
            orders ON deposits.orderId = orders.id
        WHERE 
            DATE(deposits.depositCreatedAt) = ?        
        ORDER BY 
            orders.createdAt ASC
    `, [req.params.date]);
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
        console.log(res);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}
export const updateOrder = async (req, res) => {
    console.log(req.body)
    try {
        const result = await pool.query("UPDATE orders SET ? WHERE id = ?", [
            req.body,
            req.params.id,
        ]);
        res.json(result);
    } catch (error) {
        return res.status(500).json({ message: error.message });
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
        return res.status(500).json({ message: error.message });
    }
};
