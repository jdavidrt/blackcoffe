import pool from '../db.js'

export const getDeposits = async (req, res) => {
    const [result] = await pool.query("SELECT *, CONVERT_TZ(deposits.depositCreatedAt, '+00:00', '-05:00') as depositCreatedAt, deposits.isDeleted, CONVERT_TZ(deposits.deletedAt, '+00:00', '-05:00') as deletedAt FROM deposits join orders on orders.id = deposits.orderId ORDER BY deposits.depositCreatedAt ASC")
    res.json(result)
}
export const getDepositsByOrder = async (req, res) => {
    try {
        const [result] = await pool.query("SELECT *, deposits.paymentMethod as paymentMeethd , CONVERT_TZ(deposits.depositCreatedAt, '+00:00', '-05:00') as depositCreatedAt, deposits.isDeleted, CONVERT_TZ(deposits.deletedAt, '+00:00', '-05:00') as deletedAt FROM deposits join orders on orders.id = deposits.orderId WHERE deposits.orderId = ?", [
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
    const [result] = await pool.query("SELECT orders.id, orders.clientId, orders.items, orders.deposit, deposits.paymentMethod, deposits.depositValue, deposits.lastDeposit, deposits.newDeposit, deposits.isDeleted, CONVERT_TZ(deposits.deletedAt, '+00:00', '-05:00') as deletedAt, CONVERT_TZ(deposits.depositCreatedAt, '+00:00', '-05:00') as depositCreatedAt , clients.clientName, clients.premises, clients.mall FROM deposits join orders on orders.id = deposits.orderId join clients on orders.clientId = clients.id WHERE DATE(CONVERT_TZ(deposits.depositCreatedAt, '+00:00', '-05:00')) = ? ORDER BY orders.clientId, deposits.depositCreatedAt, orders.createdAt ASC", [
        req.params.date,
    ]);
    res.json(result)
}

export const createDeposit = async (req, res) => {
    try {
        console.log(`[${new Date().toISOString()}] createDeposit - Received data:`, req.body);

        // Validate required fields
        const requiredFields = ['orderId', 'clientId', 'depositValue', 'lastDeposit', 'newDeposit'];
        for (const field of requiredFields) {
            if (req.body[field] === undefined || req.body[field] === null) {
                console.error(`[${new Date().toISOString()}] createDeposit - Missing required field: ${field}`);
                return res.status(400).json({
                    message: `Missing required field: ${field}`,
                    receivedData: req.body
                });
            }
        }

        const result = await pool.query("INSERT INTO deposits SET ?", req.body);
        console.log(`[${new Date().toISOString()}] createDeposit - Deposit created successfully:`, result[0].insertId);
        res.json(result);
    } catch (error) {
        console.error(`[${new Date().toISOString()}] createDeposit - ERROR:`, error);
        console.error(`[${new Date().toISOString()}] createDeposit - Error details:`, {
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

export const deleteDeposit = async (req, res) => {
    const depositId = req.params.id;

    try {
        // Step 1: Get deposit details before deletion
        const [depositResult] = await pool.query(
            "SELECT * FROM deposits WHERE depositId = ? AND isDeleted = 0",
            [depositId]
        );

        if (depositResult.length === 0) {
            return res.status(404).json({ message: "Depósito no encontrado o ya eliminado" });
        }

        const deposit = depositResult[0];

        // Step 2: Check if order is paid - prevent deletion
        const [orderResult] = await pool.query(
            "SELECT paid, items FROM orders WHERE id = ?",
            [deposit.orderId]
        );

        if (orderResult[0].paid === 1) {
            return res.status(400).json({
                message: "No se puede eliminar un depósito de una orden que ya está pagada completamente"
            });
        }

        // Step 3: Get order total to calculate debt
        const orderItems = JSON.parse(orderResult[0].items || '[]');
        const orderTotal = orderItems.reduce((total, item) => total + (item.unitValue * item.quantity), 0);

        // Step 4: Soft delete the deposit
        // IMPORTANT: Store deletedAt in Colombia time (UTC - 5 hours)
        await pool.query(
            "UPDATE deposits SET isDeleted = 1, deletedAt = DATE_SUB(NOW(), INTERVAL 5 HOUR) WHERE depositId = ?",
            [depositId]
        );

        // Step 5: Get all active deposits ordered by creation date
        const [allDeposits] = await pool.query(
            "SELECT depositId, depositValue FROM deposits WHERE orderId = ? AND isDeleted = 0 ORDER BY depositCreatedAt ASC",
            [deposit.orderId]
        );

        // Step 6: Recalculate cumulative values for all active deposits
        // depositValue contains the individual payment amount
        // newDeposit should contain the cumulative total
        let runningTotal = 0;
        for (const dep of allDeposits) {
            const previousTotal = runningTotal;
            const individualAmount = dep.depositValue; // Individual payment for this deposit
            runningTotal += individualAmount;
            const newDebt = orderTotal - runningTotal;

            await pool.query(
                "UPDATE deposits SET lastDeposit = ?, newDeposit = ?, dueOnDeposit = ? WHERE depositId = ?",
                [previousTotal, runningTotal, newDebt, dep.depositId]
            );
        }

        // Step 9: Update order deposit total and paid status
        await pool.query(
            "UPDATE orders SET deposit = ?, paid = 0 WHERE id = ?",
            [runningTotal, deposit.orderId]
        );

        res.json({
            message: "Depósito eliminado correctamente",
            newOrderTotal: runningTotal
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};