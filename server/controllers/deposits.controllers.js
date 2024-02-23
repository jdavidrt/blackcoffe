import pool from '../db.js'

export const getDeposits = async (req, res) => {
    const [result] = await pool.query("SELECT *, CONVERT_TZ(deposits.depositCreatedAt, '+00:00', '-05:00') as depositCreatedAt FROM deposits join orders on orders.id = deposits.orderId ORDER BY deposits.depositCreatedAt ASC")
    res.json(result)
}
export const getDepositsByOrder = async (req, res) => {
    try {
        const [result] = await pool.query("SELECT *, CONVERT_TZ(deposits.depositCreatedAt, '+00:00', '-05:00') as depositCreatedAt FROM deposits join orders on orders.id = deposits.orderId WHERE deposits.orderId = ?", [
            req.params.id,
        ]);
        if (result.length === 0)
            return res.status(404).json({ message: "Deposito no encontrado" });
        res.json(result);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}

export const getDepositsByDate = async (req, res) => {
    try {
        const [result] = await pool.query("SELECT orders.id, orders.clientId, orders.items, orders.deposit, deposits.paymentMethod, deposits.depositValue, deposits.lastDeposit, deposits.newDeposit, CONVERT_TZ(deposits.depositCreatedAt, '+00:00', '-05:00') as depositCreatedAt , clients.clientName, clients.premises, clients.mall FROM deposits join orders on orders.id = deposits.orderId join clients on orders.clientId = clients.id WHERE DATE(CONVERT_TZ(deposits.depositCreatedAt, '+00:00', '-05:00')) = ? ORDER BY orders.clientId, deposits.depositCreatedAt, orders.createdAt ASC", [
            req.params.date,
        ]);
        if (result.length === 0)
            return res.status(404).json({ message: "Depositos no encontrados para este dia" });
        res.json(result);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
    res.json(result)
}

export const createDeposit = async (req, res) => {
    try {
        const result = await pool.query("INSERT INTO deposits SET ?", req.body);
        res.json(result);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}
