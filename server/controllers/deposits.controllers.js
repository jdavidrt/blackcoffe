import pool from '../db.js'
import { sendErrorEmail } from '../utils/emailNotifier.js'

/**
 * Computes the order total by parsing items JSON and summing unitValue * quantity.
 * Defensive: returns 0 on parse error or invalid shape.
 */
const computeOrderTotal = (itemsJson) => {
    try {
        const items = JSON.parse(itemsJson || '[]');
        if (!Array.isArray(items)) return 0;
        return items.reduce((sum, it) => sum + (Number(it.unitValue) || 0) * (Number(it.quantity) || 0), 0);
    } catch {
        return 0;
    }
};

export const getDeposits = async (req, res) => {
    try {
        const [result] = await pool.query("SELECT *, CONVERT_TZ(deposits.depositCreatedAt, '+00:00', '-05:00') as depositCreatedAt, deposits.isDeleted, deposits.deletedAt as deletedAt FROM deposits join orders on orders.id = deposits.orderId ORDER BY deposits.depositCreatedAt ASC")
        res.json(result)
    } catch (error) {
        sendErrorEmail(req, error, 'getDeposits');
        return res.status(500).json({ message: 'Error procesando la solicitud' });
    }
}

export const getDepositsByOrder = async (req, res) => {
    try {
        // deletedAt is a COLOMBIA timestamp (stored via DATE_SUB) - no CONVERT_TZ needed
        const [result] = await pool.query("SELECT *, deposits.paymentMethod as paymentMeethd , CONVERT_TZ(deposits.depositCreatedAt, '+00:00', '-05:00') as depositCreatedAt, deposits.isDeleted, deposits.deletedAt as deletedAt FROM deposits join orders on orders.id = deposits.orderId WHERE deposits.orderId = ?", [
            req.params.id,
        ]);
        if (result.length === 0)
            return res.status(404).json({ message: "Depósito no encontrado" });
        res.json(result);
    } catch (error) {
        sendErrorEmail(req, error, 'getDepositsByOrder');
        return res.status(500).json({ message: 'Error procesando la solicitud' });
    }
}

export const getDepositsByDate = async (req, res) => {
    try {
        // deletedAt is a COLOMBIA timestamp (stored via DATE_SUB) - no CONVERT_TZ needed
        const [result] = await pool.query("SELECT orders.id, orders.clientId, orders.items, orders.deposit, deposits.paymentMethod, deposits.depositValue, deposits.lastDeposit, deposits.newDeposit, deposits.isDeleted, deposits.deletedAt as deletedAt, CONVERT_TZ(deposits.depositCreatedAt, '+00:00', '-05:00') as depositCreatedAt , clients.clientName, clients.premises, clients.mall FROM deposits join orders on orders.id = deposits.orderId join clients on orders.clientId = clients.id WHERE DATE(CONVERT_TZ(deposits.depositCreatedAt, '+00:00', '-05:00')) = ? ORDER BY orders.clientId, deposits.depositCreatedAt, orders.createdAt ASC", [
            req.params.date,
        ]);
        res.json(result)
    } catch (error) {
        sendErrorEmail(req, error, 'getDepositsByDate');
        return res.status(500).json({ message: 'Error procesando la solicitud' });
    }
}

/**
 * createDeposit — ATOMIC.
 *
 * Inserts a deposit row AND updates the order's deposit/paid/paidAt
 * inside a single transaction with `SELECT ... FOR UPDATE` on the order.
 * Eliminates the bug where a network failure between two separate calls
 * left a deposit row with a stale `orders.deposit` value.
 *
 * Required body: { orderId, depositValue, paymentMethod, collectedBy }
 *   - orderId         : the order ID
 *   - depositValue    : individual payment amount (number, must be > 0)
 *   - paymentMethod   : "Efectivo" | "Plataforma"
 *   - collectedBy     : username of the staff member collecting payment
 *
 * The backend (NOT the client) computes:
 *   - lastDeposit         = current order.deposit  (previous cumulative)
 *   - newDeposit          = lastDeposit + depositValue (new cumulative)
 *   - dueOnDeposit        = orderTotal - newDeposit
 *   - paid                = 1 if newDeposit >= orderTotal else 0
 *   - paidAt              = today's Colombia date when paid flips to 1
 *
 * Refuses to:
 *   - Operate on a non-existent order.
 *   - Operate on a fully-paid order (already paid = 1).
 *   - Accept depositValue <= 0.
 *   - Accept depositValue > remaining balance (overpayment guard).
 */
export const createDeposit = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const { orderId, depositValue, paymentMethod, collectedBy } = req.body;

        // Basic validation
        if (!orderId) {
            await conn.rollback();
            return res.status(400).json({ message: "orderId requerido" });
        }
        const dv = Number(depositValue);
        if (!Number.isFinite(dv) || dv <= 0) {
            await conn.rollback();
            return res.status(400).json({ message: "depositValue debe ser un número positivo" });
        }
        if (!paymentMethod) {
            await conn.rollback();
            return res.status(400).json({ message: "paymentMethod requerido" });
        }

        // Lock the order row until we commit, so concurrent deposits serialize
        const [orderRows] = await conn.query(
            "SELECT id, clientId, deposit, paid, items FROM orders WHERE id = ? FOR UPDATE",
            [orderId]
        );
        if (orderRows.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: "Orden no encontrada" });
        }
        const order = orderRows[0];
        if (order.paid === 1) {
            await conn.rollback();
            return res.status(400).json({
                message: "No se puede registrar depósito en una orden ya pagada"
            });
        }

        const orderTotal = computeOrderTotal(order.items);
        const lastDeposit = Number(order.deposit) || 0;
        const newCumulative = lastDeposit + dv;

        if (newCumulative > orderTotal) {
            await conn.rollback();
            return res.status(400).json({
                message: `El depósito excede el saldo pendiente ($${orderTotal - lastDeposit}).`
            });
        }

        const dueOnDeposit = orderTotal - newCumulative;
        const isFullyPaid = newCumulative >= orderTotal ? 1 : 0;

        // Insert deposit row
        const [insertResult] = await conn.query(
            `INSERT INTO deposits
             (orderId, clientId, paymentMethod, depositValue, lastDeposit, newDeposit, dueOnDeposit)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [orderId, order.clientId, paymentMethod, dv, lastDeposit, newCumulative, dueOnDeposit]
        );

        // Update the order. paidAt is MANUAL (Colombia local YYYY-MM-DD).
        if (isFullyPaid) {
            await conn.query(
                `UPDATE orders
                 SET deposit = ?, paid = 1,
                     paidAt = DATE_FORMAT(DATE_SUB(NOW(), INTERVAL 5 HOUR), '%Y-%m-%d'),
                     paymentMethod = ?,
                     collectedBy = ?
                 WHERE id = ?`,
                [newCumulative, paymentMethod, collectedBy || null, orderId]
            );
        } else {
            await conn.query(
                `UPDATE orders
                 SET deposit = ?, paid = 0,
                     paymentMethod = ?,
                     collectedBy = ?
                 WHERE id = ?`,
                [newCumulative, paymentMethod, collectedBy || null, orderId]
            );
        }

        await conn.commit();

        res.json({
            depositId: insertResult.insertId,
            orderId,
            depositValue: dv,
            lastDeposit,
            newDeposit: newCumulative,
            dueOnDeposit,
            paid: isFullyPaid
        });
    } catch (error) {
        await conn.rollback();
        console.error(`[${new Date().toISOString()}] createDeposit - ERROR:`, error);
        sendErrorEmail(req, error, 'createDeposit');
        return res.status(500).json({
            message: "Error procesando el depósito"
        });
    } finally {
        conn.release();
    }
}

/**
 * deleteDeposit — ATOMIC soft-delete + recalculation.
 *
 * Wraps the soft-delete and the cumulative recalculation of every remaining
 * active deposit in a single transaction. Replaces the previous N+1 loop
 * with a single `UPDATE ... CASE depositId WHEN ... END` query.
 *
 * paid status semantics:
 *   - Deleting a deposit does NOT unconditionally flip `paid` to 0.
 *   - `paid` is recomputed: 1 iff runningTotal >= orderTotal, else 0.
 *   - When `paid` flips 1 -> 0, also clear `paidAt` to NULL.
 */
export const deleteDeposit = async (req, res) => {
    const depositId = req.params.id;
    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();

        // 1. Read the target deposit (still active).
        const [depositRows] = await conn.query(
            "SELECT * FROM deposits WHERE depositId = ? AND isDeleted = 0 FOR UPDATE",
            [depositId]
        );
        if (depositRows.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: "Depósito no encontrado o ya eliminado" });
        }
        const targetDeposit = depositRows[0];

        // 2. Lock the order row.
        const [orderRows] = await conn.query(
            "SELECT id, paid, items FROM orders WHERE id = ? FOR UPDATE",
            [targetDeposit.orderId]
        );
        if (orderRows.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: "Orden asociada no encontrada" });
        }
        const order = orderRows[0];

        const orderTotal = computeOrderTotal(order.items);

        // 3. Soft-delete the target deposit (Colombia time for deletedAt).
        await conn.query(
            "UPDATE deposits SET isDeleted = 1, deletedAt = DATE_SUB(NOW(), INTERVAL 5 HOUR) WHERE depositId = ?",
            [depositId]
        );

        // 4. Read all remaining active deposits in chronological order.
        const [activeDeposits] = await conn.query(
            "SELECT depositId, depositValue FROM deposits WHERE orderId = ? AND isDeleted = 0 ORDER BY depositCreatedAt ASC",
            [targetDeposit.orderId]
        );

        // 5. Recalculate cumulative values and emit ONE UPDATE ... CASE per column.
        let runningTotal = 0;
        const ids = [];
        const lastDepositCases = [];
        const newDepositCases = [];
        const dueOnDepositCases = [];
        const params = [];

        for (const dep of activeDeposits) {
            const previous = runningTotal;
            const individual = Number(dep.depositValue) || 0;
            runningTotal += individual;
            const newDebt = orderTotal - runningTotal;

            ids.push(dep.depositId);
            lastDepositCases.push("WHEN ? THEN ?");
            newDepositCases.push("WHEN ? THEN ?");
            dueOnDepositCases.push("WHEN ? THEN ?");
            // For each column case we need (depositId, value) pairs — push in correct order below.
        }

        if (activeDeposits.length > 0) {
            // Build the single batched UPDATE.
            // Format:
            //   UPDATE deposits SET
            //     lastDeposit  = CASE depositId WHEN id1 THEN v1 ... END,
            //     newDeposit   = CASE depositId WHEN id1 THEN v1 ... END,
            //     dueOnDeposit = CASE depositId WHEN id1 THEN v1 ... END
            //   WHERE depositId IN (id1, id2, ...);
            let running = 0;
            const lastParams = [];
            const newParams = [];
            const dueParams = [];
            for (const dep of activeDeposits) {
                const previous = running;
                const individual = Number(dep.depositValue) || 0;
                running += individual;
                const newDebt = orderTotal - running;
                lastParams.push(dep.depositId, previous);
                newParams.push(dep.depositId, running);
                dueParams.push(dep.depositId, newDebt);
            }
            const placeholders = activeDeposits.map(() => "WHEN ? THEN ?").join(" ");
            const sql = `
                UPDATE deposits SET
                    lastDeposit  = CASE depositId ${placeholders} END,
                    newDeposit   = CASE depositId ${placeholders} END,
                    dueOnDeposit = CASE depositId ${placeholders} END
                WHERE depositId IN (${activeDeposits.map(() => "?").join(",")})
            `;
            await conn.query(sql, [...lastParams, ...newParams, ...dueParams, ...ids]);
        }

        // 6. Recompute order paid/paidAt based on new running total.
        // - If running total still covers the order, `paid` stays 1 (with existing paidAt).
        // - If it falls below, `paid` becomes 0 and `paidAt` is cleared.
        const stillFullyPaid = runningTotal >= orderTotal && orderTotal > 0;

        if (stillFullyPaid) {
            await conn.query(
                "UPDATE orders SET deposit = ?, paid = 1 WHERE id = ?",
                [runningTotal, targetDeposit.orderId]
            );
        } else {
            await conn.query(
                "UPDATE orders SET deposit = ?, paid = 0, paidAt = NULL WHERE id = ?",
                [runningTotal, targetDeposit.orderId]
            );
        }

        await conn.commit();

        res.json({
            message: "Depósito eliminado correctamente",
            newOrderTotal: runningTotal,
            paid: stillFullyPaid ? 1 : 0
        });
    } catch (error) {
        await conn.rollback();
        console.error(`[${new Date().toISOString()}] deleteDeposit - ERROR:`, error);
        sendErrorEmail(req, error, 'deleteDeposit');
        return res.status(500).json({ message: "Error eliminando el depósito" });
    } finally {
        conn.release();
    }
};
