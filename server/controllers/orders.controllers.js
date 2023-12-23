import pool from '../db.js'

export const getOrders = async (req, res) => {
    const [result] = await pool.query("SELECT * FROM orders ORDER BY createdAt ASC")
    //console.log(result);
    res.json(result)
}
export const getOrder = async (req, res) => {
    try {
        const [result] = await pool.query("SELECT * FROM orders WHERE id = ?", [
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
        const { shopId, clientId, paymentMethod } = req.body
        const result = await pool.query("INSERT INTO orders(shopId, clientId, paymentMethod) VALUES (?, ?, ?)", [
            shopId,
            clientId,
            paymentMethod]
        );
        res.json({
            shopId,
            clientId,
            paymentMethod,
        })
        console.log(res);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}
export const updateOrder = async (req, res) => {
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
