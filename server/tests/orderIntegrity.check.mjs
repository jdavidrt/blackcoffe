// Integrity check for how orders' items are written (2026-09-26). Run against a THROWAWAY local
// MySQL 8 (it writes and then deletes test rows), see docs/REFERENCE.md "Local integrity check":
//   DB_HOST=127.0.0.1 DB_PORT=33306 DB_USER=root DB_PASSWORD=test DB_NAME=defaultdb node server/tests/orderIntegrity.check.mjs
import assert from 'node:assert/strict';

if (!['127.0.0.1', 'localhost'].includes(process.env.DB_HOST)) {
    console.error('Refusing to run: DB_HOST must be a local throwaway database (this script writes test rows).');
    process.exit(1);
}

const express = (await import('express')).default;
const { pool } = await import('../db.js');
const ordersRoutes = (await import('../routes/orders.routes.js')).default;
const depositRoutes = (await import('../routes/deposits.routes.js')).default;
const { computeOrderTotal } = await import('../controllers/deposits.controllers.js');

const app = express();
app.use(express.json({ limit: '5mb' }));
app.use(ordersRoutes);
app.use(depositRoutes);
const server = app.listen(0);
const base = `http://127.0.0.1:${server.address().port}`;

const api = async (method, path, body) => {
    const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) });
    return { status: res.status, body: await res.json().catch(() => null) };
};
const item = (id, unitValue = 1000, quantity = 1) => ({ id, productName: 'Prueba ' + id, unitValue, quantity, delivered: false, deliveredAt: '' });
const itemsOf = async (orderId) => JSON.parse((await pool.query('SELECT items FROM orders WHERE id = ?', [orderId]))[0][0].items);
const clientIds = [];
const newClient = async () => {
    const [r] = await pool.query("INSERT INTO clients (premises, clientName, mall) VALUES ('999', 'Prueba', 'Alta Tecnología')");
    clientIds.push(r.insertId);
    return r.insertId;
};
const addProducts = (clientId, items) => api('POST', '/order', { clientId, shopId: 1, items: JSON.stringify(items) });
const DAY = '2026-09-26';

try {
    // 1. Nueva Orden: the server merges into the client's open order, even under concurrent saves.
    const clientId = await newClient();
    const first = await addProducts(clientId, [item('a')]);
    assert.equal(first.status, 200);
    const orderId = first.body.id;
    assert.equal(first.body.items, undefined, 'createOrder no longer echoes items');
    assert.equal((await addProducts(clientId, [item('b')])).body.mergedInto, orderId);
    const concurrent = await Promise.all([...Array(8).keys()].map((i) => addProducts(clientId, [item('c' + i)])));
    assert.ok(concurrent.every((r) => r.status === 200 && r.body.mergedInto === orderId), 'every concurrent save merged into the same order');
    assert.equal((await itemsOf(orderId)).length, 10, 'no product lost across 8 concurrent saves');
    const [[{ open }]] = await pool.query('SELECT COUNT(*) open FROM orders WHERE clientId = ? AND paid = 0', [clientId]);
    assert.equal(open, 1, 'still exactly one open order');
    console.log('ok 1 - Nueva Orden merges on the server, 8 concurrent saves, nothing lost');

    // 2. Delivery checkbox: one item, applied to the CURRENT items (products added after the page loaded survive).
    await addProducts(clientId, [item('z')]); // added "after the Recorrido page loaded"
    assert.equal((await api('PUT', `/order/${orderId}/delivered`, { itemId: 'a', delivered: true, deliveredAt: DAY })).status, 200);
    let items = await itemsOf(orderId);
    assert.ok(items.some((it) => it.id === 'z'), 'product added after page load is kept');
    assert.deepEqual(items.find((it) => it.id === 'a'), { ...item('a'), delivered: true, deliveredAt: DAY });
    assert.ok(items.filter((it) => it.id !== 'a').every((it) => it.delivered === false), 'other items untouched');
    const toggles = await Promise.all([...Array(8).keys()].map((i) => api('PUT', `/order/${orderId}/delivered`, { itemId: 'c' + i, delivered: true, deliveredAt: DAY })));
    assert.ok(toggles.every((r) => r.status === 200));
    items = await itemsOf(orderId);
    assert.equal(items.length, 11);
    assert.equal(items.filter((it) => it.delivered).length, 9, '8 concurrent checkbox clicks all kept');
    assert.equal((await api('PUT', `/order/${orderId}/delivered`, { itemId: 'a', delivered: true, deliveredAt: DAY })).status, 200, 'idempotent');
    assert.equal((await api('PUT', `/order/${orderId}/delivered`, { itemId: 'nope', delivered: true, deliveredAt: DAY })).status, 409);
    assert.equal((await api('PUT', `/order/${orderId}/delivered`, { delivered: true, deliveredAt: DAY })).status, 400);
    assert.equal((await api('PUT', `/order/${orderId}/delivered`, { itemId: 'a', delivered: 'yes', deliveredAt: DAY })).status, 400);
    assert.equal((await api('PUT', `/order/999999999/delivered`, { itemId: 'a', delivered: true, deliveredAt: DAY })).status, 404);
    const [[{ undelivered }]] = await pool.query(`SELECT COUNT(*) undelivered FROM orders WHERE id = ? AND items LIKE '%"delivered":false%'`, [orderId]);
    assert.equal(undelivered, 1, 'Recorrido LIKE query still matches the serialized items');
    console.log('ok 2 - delivery checkbox keeps products added after page load, 8 concurrent clicks, 400/404/409 cases');

    // 3. Editar Orden: saving over changes made after the form opened is refused.
    const loaded = (await api('GET', `/order/${orderId}`)).body.items;
    const edited = JSON.parse(loaded).filter((it) => it.id !== 'b');
    assert.equal((await api('PUT', `/order/${orderId}`, { items: JSON.stringify(edited), expectedItems: loaded })).status, 200);
    const afterEdit = JSON.stringify(await itemsOf(orderId));
    const stale = await api('PUT', `/order/${orderId}`, { items: loaded, expectedItems: loaded });
    assert.equal(stale.status, 409);
    assert.equal(stale.body.orderId, orderId);
    assert.equal(JSON.stringify(await itemsOf(orderId)), afterEdit, 'refused save changed nothing');
    console.log('ok 3 - Editar Orden refuses to save over changes made after it was opened');

    // 4. Edit racing a full payment: never ends paid with money still owed (row lock in updateOrder).
    let editFirst = 0, payFirst = 0;
    for (let i = 0; i < 25; i++) {
        const cid = await newClient();
        const oid = (await addProducts(cid, [item('x')])).body.id; // total 1000
        const before = (await api('GET', `/order/${oid}`)).body.items;
        const [pay, edit] = await Promise.all([
            api('POST', '/deposits', { orderId: oid, depositValue: 1000, paymentMethod: 'Efectivo', collectedBy: 'test' }),
            api('PUT', `/order/${oid}`, { items: JSON.stringify([item('x'), item('y', 500)]), expectedItems: before }),
        ]);
        const [[row]] = await pool.query('SELECT paid, deposit, items FROM orders WHERE id = ?', [oid]);
        if (Number(row.paid) === 1) assert.ok(row.deposit >= computeOrderTotal(row.items), `order ${oid} paid with a balance`);
        if (edit.status === 200) { editFirst++; assert.equal(Number(row.paid), 0, 'edit first: 1000 no longer covers 1500'); }
        else { payFirst++; assert.equal(edit.status, 400); assert.equal(pay.status, 200); }
    }
    console.log(`ok 4 - 25 edit-vs-payment races, invariant held (edit first ${editFirst}, payment first ${payFirst})`);

    // 5. Paid orders stay frozen for both write paths.
    const paidClient = await newClient();
    const paidId = (await addProducts(paidClient, [item('p')])).body.id;
    assert.equal((await api('POST', '/deposits', { orderId: paidId, depositValue: 1000, paymentMethod: 'Efectivo', collectedBy: 't' })).status, 200);
    const frozenToggle = await api('PUT', `/order/${paidId}/delivered`, { itemId: 'p', delivered: true, deliveredAt: DAY });
    assert.equal(frozenToggle.status, 400);
    assert.equal(frozenToggle.body.orderId, paidId);
    assert.equal((await api('PUT', `/order/${paidId}`, { items: JSON.stringify([item('q')]) })).status, 400);
    console.log('ok 5 - paid orders reject delivery toggles and edits');

    // 6. Early returns roll back and release: no transaction left open, pool still usable.
    await Promise.all([...Array(40).keys()].map((i) => i % 2
        ? api('PUT', `/order/${orderId}`, { items: loaded, expectedItems: loaded })
        : api('PUT', `/order/${orderId}/delivered`, { itemId: 'nope', delivered: true, deliveredAt: DAY })));
    const [[{ openTrx }]] = await pool.query('SELECT COUNT(*) openTrx FROM information_schema.innodb_trx');
    assert.equal(openTrx, 0, 'no transaction left open by early returns');
    assert.equal((await api('PUT', `/order/${orderId}/delivered`, { itemId: 'a', delivered: false, deliveredAt: DAY })).status, 200);
    console.log('ok 6 - 40 rejected requests left no open transaction; pool still works');

    // 7. Cobrar list: totals from the server, no items.
    const list = (await api('GET', `/unPaidOrders/${encodeURIComponent('Alta Tecnología')}`)).body;
    const mine = list.find((o) => o.id === orderId);
    assert.equal(mine.items, undefined);
    assert.equal(mine.total, computeOrderTotal(JSON.stringify(await itemsOf(orderId))));
    console.log('ok 7 - /unPaidOrders/:mall sends total, not items');

    // 8. Cuentas por cobrar and Entregados: total from the server; Entregados gets only that day's delivered items.
    const dash = (await api('GET', '/orders/')).body.find((o) => o.id === orderId);
    assert.equal(dash.items, undefined);
    assert.equal(dash.total, mine.total);
    const day = (await api('GET', `/deliveredOrders/${DAY}`)).body.find((o) => o.id === orderId);
    const expected = (await itemsOf(orderId)).filter((it) => it.delivered && it.deliveredAt === DAY);
    assert.ok(expected.length > 0);
    assert.deepEqual(JSON.parse(day.items), expected);
    assert.equal(day.total, mine.total, 'Debe uses the full order total, not just the listed items');
    console.log('ok 8 - /orders/ sends total; /deliveredOrders/:date sends that day\'s items + full total');
} finally {
    if (clientIds.length) {
        await pool.query('DELETE FROM deposits WHERE clientId IN (?)', [clientIds]);
        await pool.query('DELETE FROM orders WHERE clientId IN (?)', [clientIds]);
        await pool.query('DELETE FROM clients WHERE id IN (?)', [clientIds]);
    }
    server.close();
    await pool.end();
}
