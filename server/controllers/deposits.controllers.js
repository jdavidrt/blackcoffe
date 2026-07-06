import pool from '../db.js'
import { sendErrorEmail } from '../utils/emailNotifier.js'

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
        return res.status(500).json({ message: 'Error obteniendo los abonos' });
    }
}

export const getDepositsByOrder = async (req, res) => {
    try {
        // deletedAt is a COLOMBIA timestamp (stored via DATE_SUB) - no CONVERT_TZ needed
        // An order with zero deposits is a valid state — return [] (not 404).
        const [result] = await pool.query("SELECT *, deposits.paymentMethod as paymentMeethd , CONVERT_TZ(deposits.depositCreatedAt, '+00:00', '-05:00') as depositCreatedAt, deposits.isDeleted, deposits.deletedAt as deletedAt FROM deposits join orders on orders.id = deposits.orderId WHERE deposits.orderId = ?", [
            req.params.id,
        ]);
        res.json(result);
    } catch (error) {
        sendErrorEmail(req, error, 'getDepositsByOrder');
        return res.status(500).json({ message: 'Error obteniendo los abonos de la orden' });
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
        return res.status(500).json({ message: 'Error obteniendo los abonos por fecha' });
    }
}

/**
 * createDeposit — ATOMIC (audit fix H1).
 *
 * Inserts the deposit row AND updates the order's deposit/paid/paidAt inside a
 * single transaction with SELECT ... FOR UPDATE on the order, so a network
 * failure between "create deposit" and "update order" (previously two separate
 * calls) can no longer leave a deposit row with a stale order total.
 *
 * Request body: { orderId, depositValue, paymentMethod, collectedBy }.
 * The server (not the client) computes lastDeposit/newDeposit/dueOnDeposit/
 * paid/paidAt from the locked order row's current items + deposit total.
 */
export const createDeposit = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const { orderId, depositValue, paymentMethod, collectedBy } = req.body;

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

        // Lock the order row until commit so concurrent deposits on the same order serialize.
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
                message: "No se puede registrar un abono en una orden ya pagada"
            });
        }

        const orderTotal = computeOrderTotal(order.items);
        const lastDeposit = Number(order.deposit) || 0;
        const newCumulative = lastDeposit + dv;

        if (newCumulative > orderTotal) {
            await conn.rollback();
            return res.status(400).json({
                message: `El abono excede el saldo pendiente ($${orderTotal - lastDeposit}).`
            });
        }

        const dueOnDeposit = orderTotal - newCumulative;
        const isFullyPaid = newCumulative >= orderTotal ? 1 : 0;

        const [insertResult] = await conn.query(
            `INSERT INTO deposits
             (orderId, clientId, paymentMethod, depositValue, lastDeposit, newDeposit, dueOnDeposit)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [orderId, order.clientId, paymentMethod, dv, lastDeposit, newCumulative, dueOnDeposit]
        );

        // paidAt is a MANUAL timestamp (Colombia local YYYY-MM-DD) — only set on the 0 -> 1 transition.
        const orderUpdate = {
            deposit: newCumulative,
            paid: isFullyPaid,
            paymentMethod,
            collectedBy: collectedBy || null,
        };

        if (isFullyPaid) {
            const colombiaToday = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
            orderUpdate.paidAt = colombiaToday;

            const [clientRows] = await conn.query(
                'SELECT clientName, premises, mall FROM clients WHERE id = ?',
                [order.clientId]
            );
            if (clientRows.length > 0) {
                orderUpdate.clientNameSnapshot = clientRows[0].clientName;
                orderUpdate.clientPremisesSnapshot = clientRows[0].premises;
                orderUpdate.clientMallSnapshot = clientRows[0].mall;
            }
        }

        await conn.query("UPDATE orders SET ? WHERE id = ?", [orderUpdate, orderId]);

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
        return res.status(500).json({ message: "Error procesando el abono" });
    } finally {
        conn.release();
    }
}

/**
 * deleteDeposit — ATOMIC soft-delete + recalculation (audit fixes H2, 6.1, 1.9).
 *
 * Locks the deposit + order rows, soft-deletes the target deposit, then
 * recalculates every remaining active deposit's cumulative totals with a
 * single batched UPDATE ... CASE (replacing the previous per-row N+1 loop).
 * `paid` is recomputed from the new running total instead of being forced to
 * 0 unconditionally, and `paidAt` is cleared only on an actual 1 -> 0 flip.
 */
export const deleteDeposit = async (req, res) => {
    const depositId = req.params.id;
    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();

        const [depositRows] = await conn.query(
            "SELECT * FROM deposits WHERE depositId = ? AND isDeleted = 0 FOR UPDATE",
            [depositId]
        );
        if (depositRows.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: "Depósito no encontrado o ya eliminado" });
        }
        const targetDeposit = depositRows[0];

        const [orderRows] = await conn.query(
            "SELECT id, paid, items FROM orders WHERE id = ? FOR UPDATE",
            [targetDeposit.orderId]
        );
        if (orderRows.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: "Orden asociada no encontrada" });
        }
        const order = orderRows[0];

        if (order.paid === 1) {
            await conn.rollback();
            return res.status(400).json({
                message: "No se puede eliminar un depósito de una orden que ya está pagada completamente"
            });
        }

        const orderTotal = computeOrderTotal(order.items);

        // Soft-delete the target deposit. deletedAt is COLOMBIA time (stored via DATE_SUB).
        await conn.query(
            "UPDATE deposits SET isDeleted = 1, deletedAt = DATE_SUB(NOW(), INTERVAL 5 HOUR) WHERE depositId = ?",
            [depositId]
        );

        // Recompute cumulative values for all remaining active deposits, chronologically.
        const [activeDeposits] = await conn.query(
            "SELECT depositId, depositValue FROM deposits WHERE orderId = ? AND isDeleted = 0 ORDER BY depositCreatedAt ASC",
            [targetDeposit.orderId]
        );

        let runningTotal = 0;
        if (activeDeposits.length > 0) {
            const lastParams = [];
            const newParams = [];
            const dueParams = [];
            const ids = [];
            for (const dep of activeDeposits) {
                const previous = runningTotal;
                const individual = Number(dep.depositValue) || 0;
                runningTotal += individual;
                const newDebt = orderTotal - runningTotal;
                lastParams.push(dep.depositId, previous);
                newParams.push(dep.depositId, runningTotal);
                dueParams.push(dep.depositId, newDebt);
                ids.push(dep.depositId);
            }
            const placeholders = activeDeposits.map(() => "WHEN ? THEN ?").join(" ");
            await conn.query(
                `UPDATE deposits SET
                    lastDeposit  = CASE depositId ${placeholders} END,
                    newDeposit   = CASE depositId ${placeholders} END,
                    dueOnDeposit = CASE depositId ${placeholders} END
                 WHERE depositId IN (${ids.map(() => "?").join(",")})`,
                [...lastParams, ...newParams, ...dueParams, ...ids]
            );
        }

        // paid is recomputed from the new running total (not unconditionally forced to 0);
        // paidAt is cleared only on an actual 1 -> 0 transition.
        const stillFullyPaid = orderTotal > 0 && runningTotal >= orderTotal;
        if (stillFullyPaid) {
            await conn.query(
                "UPDATE orders SET deposit = ? WHERE id = ?",
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
