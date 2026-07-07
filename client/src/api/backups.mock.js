// ─────────────────────────────────────────────────────────────────────────────
// FRONTEND-ONLY MOCK for the Order Backup / Restore feature.
//
// This module fakes the three backend endpoints entirely in the browser so the
// "Copias de seguridad" UI can be validated before any server/DB code exists.
// It keeps an in-memory store of snapshots + restores and mimics the real
// contract described in the plan. Once the real endpoints land, backups.api.js
// flips USE_MOCK -> false and this file is no longer used at runtime.
// ─────────────────────────────────────────────────────────────────────────────
import dayjs from "dayjs";

const wait = (ms = 250) => new Promise((r) => setTimeout(r, ms));

// Build a Colombia-time "now" string like the backend would store.
const colombiaNow = () =>
  dayjs().subtract(5, "hour").format("YYYY-MM-DD HH:mm:ss");

// Relative dates so there is always fresh, selectable data in the calendar.
const D = (n) => dayjs().subtract(n, "day").format("YYYY-MM-DD");

// Helper to build an items JSON string (matches the real orders.items shape).
const items = (arr) => JSON.stringify(arr);

// Per-order display metadata + current live state (what the order looks like NOW).
const orderMeta = {
  15651: { clientName: "Juan Pérez", premises: "15", mall: "Unilago", orderExists: true, currentPaid: 0, isAbandoned: 0 },
  15702: { clientName: "María González", premises: "22", mall: "Alta Tecnología", orderExists: true, currentPaid: 1, isAbandoned: 0 },
  15488: { clientName: "Carlos Ruiz", premises: "7", mall: "Otros", orderExists: false, currentPaid: 0, isAbandoned: 0 },
  15810: { clientName: "Ana Torres", premises: "3", mall: "Cliente Frecuente", orderExists: true, currentPaid: 1, isAbandoned: 0 },
  15533: { clientName: "Lucía Gómez", premises: "9", mall: "Unilago", orderExists: true, currentPaid: 0, isAbandoned: 1 },
};

// In-memory snapshot rows. Several orders have MULTIPLE days so "latest <= X" is testable.
let snapshots = [
  // 15651 — grows over time (café only -> café + croissant). Unpaid.
  { snapshotId: 1, orderId: 15651, snapshotDate: D(8), deposit: 0, paid: 0, paidAt: null,
    items: items([
      { id: "374 09:10:00 " + dayjs().subtract(8, "day").format("DD/MM/YY"), productName: "Café Americano", quantity: 2, unitValue: 8000, delivered: false, deliveredAt: "" },
    ]) },
  { snapshotId: 2, orderId: 15651, snapshotDate: D(2), deposit: 20000, paid: 0, paidAt: null,
    items: items([
      { id: "374 09:10:00 " + dayjs().subtract(8, "day").format("DD/MM/YY"), productName: "Café Americano", quantity: 2, unitValue: 8000, delivered: true, deliveredAt: dayjs().subtract(2, "day").format("YYYY-MM-DD") },
      { id: "512 14:22:00 " + dayjs().subtract(2, "day").format("DD/MM/YY"), productName: "Croissant", quantity: 3, unitValue: 12000, delivered: false, deliveredAt: "" },
    ]) },

  // 15702 — snapshot shows UNPAID, but order is currently PAID -> triggers warning row.
  { snapshotId: 3, orderId: 15702, snapshotDate: D(5), deposit: 0, paid: 0, paidAt: null,
    items: items([
      { id: "601 11:00:00 " + dayjs().subtract(5, "day").format("DD/MM/YY"), productName: "Combo Desayuno", quantity: 1, unitValue: 25000, delivered: false, deliveredAt: "" },
    ]) },

  // 15488 — order has since been DELETED (orderExists=false) -> restore disabled.
  { snapshotId: 4, orderId: 15488, snapshotDate: D(5), deposit: 10000, paid: 0, paidAt: null,
    items: items([
      { id: "708 16:40:00 " + dayjs().subtract(5, "day").format("DD/MM/YY"), productName: "Torta de Chocolate", quantity: 1, unitValue: 14000, delivered: true, deliveredAt: dayjs().subtract(5, "day").format("YYYY-MM-DD") },
      { id: "709 16:41:00 " + dayjs().subtract(5, "day").format("DD/MM/YY"), productName: "Jugo Natural", quantity: 2, unitValue: 6000, delivered: false, deliveredAt: "" },
    ]) },

  // 15810 — fully PAID snapshot.
  { snapshotId: 5, orderId: 15810, snapshotDate: D(2), deposit: 25000, paid: 1, paidAt: D(2),
    items: items([
      { id: "801 10:05:00 " + dayjs().subtract(2, "day").format("DD/MM/YY"), productName: "Desayuno Ejecutivo", quantity: 1, unitValue: 25000, delivered: true, deliveredAt: dayjs().subtract(2, "day").format("YYYY-MM-DD") },
    ]) },

  // 15533 — unpaid + abandoned (still eligible, can be reactivated).
  { snapshotId: 6, orderId: 15533, snapshotDate: D(1), deposit: 5000, paid: 0, paidAt: null,
    items: items([
      { id: "902 08:30:00 " + dayjs().subtract(1, "day").format("DD/MM/YY"), productName: "Capuchino", quantity: 1, unitValue: 9000, delivered: false, deliveredAt: "" },
      { id: "903 08:31:00 " + dayjs().subtract(1, "day").format("DD/MM/YY"), productName: "Muffin", quantity: 2, unitValue: 7000, delivered: false, deliveredAt: "" },
    ]) },
];

// Restore audit store. Pre-seed one restore on 15651 so the badge shows immediately
// on /pdfOrden/15651 and /cobrarOrden/15651 without performing a restore first.
let restores = [
  { id: 1, orderId: 15651, snapshotId: 1, restoredFromDate: D(8), restoredBy: "David", restoredAt: colombiaNow() },
];
let restoreSeq = 2;

// GET /backupsByDate/:date — latest snapshot per order with snapshotDate <= date.
export const getBackupsByDateRequest = async (date) => {
  await wait();
  const latestPerOrder = {};
  for (const s of snapshots) {
    if (s.snapshotDate <= date) {
      const cur = latestPerOrder[s.orderId];
      if (!cur || s.snapshotDate > cur.snapshotDate) {
        latestPerOrder[s.orderId] = s;
      }
    }
  }

  const rows = Object.values(latestPerOrder).map((s) => {
    const meta = orderMeta[s.orderId] || {};
    return {
      snapshotId: s.snapshotId,
      orderId: s.orderId,
      snapshotDate: s.snapshotDate,
      items: s.items,
      deposit: s.deposit,
      paid: s.paid,
      paidAt: s.paidAt,
      orderExists: meta.orderExists ? 1 : 0,
      currentPaid: meta.currentPaid ?? 0,
      isAbandoned: meta.isAbandoned ?? 0,
      clientName: meta.clientName || "(sin cliente)",
      premises: meta.premises || "",
      mall: meta.mall || "Otros",
    };
  });

  // Sort by premises number then client name (matches the app's usual ordering).
  rows.sort((a, b) => (Number(a.premises) || 0) - (Number(b.premises) || 0) || a.clientName.localeCompare(b.clientName));

  return { data: rows };
};

// PUT /order/:id/restore — body { snapshotId, restoredBy }
export const restoreOrderFromSnapshotRequest = async (orderId, body) => {
  await wait(400);
  const oid = Number(orderId);
  const snap = snapshots.find((s) => s.snapshotId === body.snapshotId);
  const meta = orderMeta[oid];

  if (!meta || !meta.orderExists) {
    const err = new Error("Orden no encontrada");
    err.response = { status: 404, data: { message: "Orden no encontrada" } };
    throw err;
  }
  if (!snap) {
    const err = new Error("Copia de seguridad no encontrada");
    err.response = { status: 404, data: { message: "Copia de seguridad no encontrada" } };
    throw err;
  }
  if (snap.orderId !== oid) {
    const err = new Error("La copia de seguridad no corresponde a esta orden");
    err.response = { status: 400, data: { message: "La copia de seguridad no corresponde a esta orden" } };
    throw err;
  }

  // Mutate live state so the UI reflects the restore (badge + warning updates).
  meta.currentPaid = snap.paid;
  restores.push({
    id: restoreSeq++,
    orderId: oid,
    snapshotId: snap.snapshotId,
    restoredFromDate: snap.snapshotDate,
    restoredBy: body.restoredBy || "Unknown",
    restoredAt: colombiaNow(),
  });

  return { data: { message: "Orden restaurada", orderId: oid, restoredFromDate: snap.snapshotDate, paid: snap.paid } };
};

// GET /orderRestores/:orderId
export const getOrderRestoresRequest = async (orderId) => {
  await wait(150);
  const oid = Number(orderId);
  const rows = restores
    .filter((r) => r.orderId === oid)
    .sort((a, b) => a.restoredAt.localeCompare(b.restoredAt));
  return { data: rows };
};
