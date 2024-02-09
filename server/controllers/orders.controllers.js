import pool from '../db.js'

export const getOrders = async (req, res) => {
    const [result] = await pool.query("select orders.id, CONVERT_TZ(orders.createdAt, '+00:00', '-05:00'), orders.clientId, orders.paid, orders.collectedBy, orders.items, DATE(CONVERT_TZ(orders.createdAt, '+00:00', '-05:00')) as createdAt, clients.premises, clients.clientName, clients.mall from orders join clients on orders.clientId = clients.id WHERE DATE(CONVERT_TZ(orders.createdAt, '+00:00', '-05:00')) = ? and orders.paid = 0 ORDER BY clients.premises ASC, clients.clientname ASC, orders.createdAt ASC", [
        req.params.date,
    ]);
    res.json(result)
}

export const getUnPaidOrders = async (req, res) => {
    const [result] = await pool.query("select orders.id, CONVERT_TZ(orders.createdAt, '+00:00', '-05:00'), orders.clientId, orders.paid, orders.collectedBy, orders.items, DATE(CONVERT_TZ(orders.createdAt, '+00:00', '-05:00')) as createdAt, clients.premises, clients.clientName, clients.mall from orders join clients on orders.clientId = clients.id WHERE clients.mall = ? and orders.paid = 0 ORDER BY clients.premises ASC, clients.clientname ASC, orders.createdAt ASC", [
        req.params.mall,
    ]);
    res.json(result)
}

export const getCollectedOrders = async (req, res) => {
    const [result] = await pool.query("select orders.id, CONVERT_TZ(orders.createdAt, '+00:00', '-05:00'), CONVERT_TZ(orders.paidAt, '+00:00', '-05:00'), orders.clientId, orders.collectedBy, orders.paid, orders.items, DATE(CONVERT_TZ(orders.createdAt, '+00:00', '-05:00')) as createdAt, clients.premises, clients.clientName, clients.mall from orders join clients on orders.clientId = clients.id WHERE DATE(CONVERT_TZ(orders.createdAt, '+00:00', '-05:00')) = ? and orders.paid = 1  ORDER BY clients.premises ASC, clients.clientname ASC, orders.createdAt ASC", [
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
