import { useState, useEffect } from "react";
import dayjs from "dayjs";
import { Calendar, Modal, message, Tag, Drawer } from "antd";
import { saveAs } from "file-saver";
import {
  getBackupsByDateRequest,
  restoreOrderFromSnapshotRequest,
} from "../api/backups.api";
import { safeJSONParse } from "../utils/jsonUtils";
import { calculateOrderTotal } from "../utils/orderUtils";
import { formatCurrency } from "../utils/currencyUtils";

const backendFormat = "YYYY-MM-DD";
const RETENTION_DAYS = 21;

function BackupsPage() {
  const [selectedDate, setSelectedDate] = useState(null); // dayjs
  const [dayList, setDayList] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [search, setSearch] = useState("");
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 1024 : false
  );

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Calendar: no Sundays, no future, nothing older than the retention window.
  const disabledDate = (d) =>
    d.day() === 0 ||
    d.isAfter(dayjs(), "day") ||
    d.isBefore(dayjs().subtract(RETENTION_DAYS, "day"), "day");

  const loadDay = async (dateStr) => {
    setLoading(true);
    setSelectedOrder(null);
    setSearch("");
    try {
      const res = await getBackupsByDateRequest(dateStr);
      setDayList(res.data || []);
    } catch (err) {
      Modal.error({
        title: "Error",
        content:
          err.response?.data?.message ||
          "No se pudieron cargar las copias de seguridad.",
      });
      setDayList([]);
    } finally {
      setLoading(false);
    }
  };

  const onSelect = (d, info) => {
    // antd fires onSelect for panel/month changes too; only react to date clicks.
    if (info && info.source && info.source !== "date") return;
    if (disabledDate(d)) return;
    setSelectedDate(d);
    loadDay(d.format(backendFormat));
  };

  const openRestoreModal = (order) => {
    const total = calculateOrderTotal({ items: order.items });
    const itemCount = safeJSONParse(order.items, []).length;
    const willUnpay = order.currentPaid === 1 && order.paid === 0;

    Modal.confirm({
      title: "Restaurar orden a este estado",
      okText: "Restaurar",
      cancelText: "Cancelar",
      okButtonProps: {
        style: { backgroundColor: "#16a34a", borderColor: "#16a34a", color: "#fff" },
      },
      content: (
        <div>
          <p>
            Se restaurará la orden <strong>#{order.orderId}</strong> a la copia del{" "}
            <strong>{order.snapshotDate}</strong>:
          </p>
          <p className="mt-1">
            {itemCount} producto{itemCount !== 1 ? "s" : ""} · Total {formatCurrency(total)} ·{" "}
            {order.paid ? "Pagada" : "Pendiente"}
          </p>
          <div className="mt-3 p-2 bg-yellow-50 border border-yellow-300 rounded text-sm text-yellow-800">
            <strong>Importante:</strong> esta restauración no modifica los abonos
            (depósitos) de la orden. Si el nuevo estado requiere abonos distintos,
            elimínelos y regístrelos nuevamente desde esta misma orden.
          </div>
          {willUnpay && (
            <div className="mt-2 p-2 bg-red-50 border border-red-300 rounded text-sm text-red-700">
              La orden está actualmente pagada; restaurarla la dejará pendiente de pago.
            </div>
          )}
        </div>
      ),
      onOk: async () => {
        setRestoring(true);
        try {
          await restoreOrderFromSnapshotRequest(order.orderId, {
            snapshotId: order.snapshotId,
            restoredBy: localStorage.getItem("user") || "Unknown",
          });
          message.success(`Orden #${order.orderId} restaurada a la copia del ${order.snapshotDate}`);
          // Refresh the day list so the warning / state reflects the restore.
          if (selectedDate) await loadDay(selectedDate.format(backendFormat));
        } catch (err) {
          Modal.error({
            title: "No se pudo restaurar",
            content: err.response?.data?.message || "Error restaurando la orden.",
          });
        } finally {
          setRestoring(false);
        }
      },
    });
  };

  const downloadDay = () => {
    if (!selectedDate || dayList.length === 0) return;
    const dateStr = selectedDate.format(backendFormat);
    const lines = [];
    lines.push("=".repeat(48));
    lines.push("BLACK COFFE — COPIA DE SEGURIDAD DE ÓRDENES");
    lines.push(`Día: ${dateStr}`);
    lines.push(`Órdenes: ${dayList.length}`);
    lines.push(`Generado: ${dayjs().format("YYYY-MM-DD HH:mm")}`);
    lines.push("=".repeat(48));
    lines.push("");

    for (const o of dayList) {
      const items = safeJSONParse(o.items, []);
      const total = calculateOrderTotal({ items: o.items });
      const abonado = Number(o.deposit) || 0;
      const saldo = Math.max(0, total - abonado);
      lines.push(`ORDEN #${o.orderId} — copia del ${o.snapshotDate}`);
      lines.push(`Cliente: ${o.clientName} | Local: ${o.premises} | Centro: ${o.mall}`);
      lines.push("-".repeat(48));
      for (const it of items) {
        const sub = (it.unitValue || 0) * (it.quantity || 0);
        const mark = it.delivered ? " [entregado]" : "";
        lines.push(
          `  ${it.quantity} x ${it.productName} @ ${formatCurrency(it.unitValue)} = ${formatCurrency(sub)}${mark}`
        );
      }
      lines.push("-".repeat(48));
      lines.push(
        `  Total: ${formatCurrency(total)} | Abonado: ${formatCurrency(abonado)} | Saldo: ${formatCurrency(saldo)} | Estado: ${o.paid ? "PAGADA" : "PENDIENTE"}`
      );
      lines.push("");
    }

    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    saveAs(blob, `copia-seguridad-${dateStr}.txt`);
  };

  const filteredList = () => {
    const q = search.trim().toLowerCase();
    if (!q) return dayList;
    return dayList.filter(
      (o) =>
        (o.clientName || "").toLowerCase().includes(q) ||
        String(o.premises || "").toLowerCase().includes(q) ||
        (o.mall || "").toLowerCase().includes(q) ||
        String(o.orderId).includes(q)
    );
  };

  const renderDayList = () => {
    if (!selectedDate) {
      return (
        <p className="text-gray-500 text-center py-6">
          Selecciona un día en el calendario para ver las copias.
        </p>
      );
    }
    if (loading) {
      return <p className="text-gray-500 text-center py-6">Cargando...</p>;
    }
    if (dayList.length === 0) {
      return (
        <p className="text-gray-500 text-center py-6">
          Sin copias de seguridad para este día.
        </p>
      );
    }
    const filtered = filteredList();
    if (filtered.length === 0) {
      return (
        <p className="text-gray-500 text-center py-6">
          Sin resultados para la búsqueda.
        </p>
      );
    }
    return filtered.map((o) => {
      const total = calculateOrderTotal({ items: o.items });
      const isSelected = selectedOrder && selectedOrder.orderId === o.orderId;
      return (
        <button
          type="button"
          key={o.orderId}
          onClick={() => setSelectedOrder(o)}
          className={`w-full text-left mb-2 p-3 rounded-md border transition ${
            isSelected ? "border-indigo-600 bg-indigo-50" : "border-gray-200 bg-white hover:bg-gray-50"
          }`}
        >
          <div className="flex justify-between items-start">
            <span className="font-semibold text-stone-800">
              {o.premises} — {o.clientName}
            </span>
            <Tag color={o.paid ? "green" : "gold"} className="ml-2">
              {o.paid ? "Pagada" : "Pendiente"}
            </Tag>
          </div>
          <div className="text-sm text-gray-600">{o.mall}</div>
          <div className="flex justify-between text-sm mt-1">
            <span className="text-gray-500">Abonado: {formatCurrency(o.deposit)}</span>
            <span className="font-bold text-emerald-700">Total: {formatCurrency(total)}</span>
          </div>
          <div className="text-xs text-gray-400 mt-1">
            Copia del {o.snapshotDate}
            {o.snapshotDate !== selectedDate.format(backendFormat) && " (estado reconstruido)"}
          </div>
          {!o.orderExists && (
            <div className="text-xs text-red-600 font-semibold">Orden eliminada</div>
          )}
        </button>
      );
    });
  };

  const renderDetail = () => {
    if (!selectedOrder) {
      return (
        <p className="text-gray-500 text-center py-6">
          Selecciona una orden para ver el detalle.
        </p>
      );
    }
    const o = selectedOrder;
    const items = safeJSONParse(o.items, []);
    const total = calculateOrderTotal({ items: o.items });
    const willUnpay = o.currentPaid === 1 && o.paid === 0;

    return (
      <div>
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-lg font-bold text-stone-800">
            {o.premises} — {o.clientName}
          </h3>
          <Tag color={o.paid ? "green" : "gold"}>{o.paid ? "Pagada" : "Pendiente"}</Tag>
        </div>
        <p className="text-sm text-gray-600 mb-1">{o.mall}</p>
        <p className="text-xs text-gray-400 mb-3">Copia del {o.snapshotDate}</p>

        <div className="overflow-x-auto rounded border border-gray-200">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-stone-700 text-white">
                <th className="px-2 py-1 text-left">Producto</th>
                <th className="px-2 py-1 text-right">Cant.</th>
                <th className="px-2 py-1 text-right">V. Unit.</th>
                <th className="px-2 py-1 text-right">Subtotal</th>
                <th className="px-2 py-1 text-center">Entregado</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={it.id || i} className={i % 2 ? "bg-gray-50" : "bg-white"}>
                  <td className="px-2 py-1">{it.productName}</td>
                  <td className="px-2 py-1 text-right">{it.quantity}</td>
                  <td className="px-2 py-1 text-right">{formatCurrency(it.unitValue)}</td>
                  <td className="px-2 py-1 text-right">
                    {formatCurrency((it.unitValue || 0) * (it.quantity || 0))}
                  </td>
                  <td className="px-2 py-1 text-center">{it.delivered ? "✓" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="font-semibold">Total</span>
            <span className="font-bold text-emerald-700">{formatCurrency(total)}</span>
          </div>
          <div className="flex justify-between">
            <span>Estado de pago</span>
            <span>{o.paid ? "Pagada" : "Pendiente"}</span>
          </div>
          <div className="text-gray-500 text-xs">
            Abono registrado en la copia: {formatCurrency(o.deposit)} (solo informativo — los
            abonos no se restauran)
          </div>
        </div>

        {willUnpay && (
          <div className="mt-3 p-2 bg-red-50 border border-red-300 rounded text-sm text-red-700">
            La orden está actualmente pagada; restaurar la dejará pendiente de pago.
          </div>
        )}

        <button
          type="button"
          disabled={!o.orderExists || restoring}
          onClick={() => openRestoreModal(o)}
          className="mt-4 w-full rounded-md px-4 py-2 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: "#16a34a" }}
        >
          {o.orderExists ? "Restaurar a este estado" : "Orden eliminada"}
        </button>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h1 className="text-2xl font-bold text-stone-700">Copias de seguridad</h1>
        <button
          type="button"
          onClick={downloadDay}
          disabled={!selectedDate || dayList.length === 0}
          className="bg-indigo-800 text-white rounded-md px-4 py-2 hover:bg-indigo-900 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Descargar copia del día
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Calendar + day list */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-md shadow p-2 mb-4">
            <Calendar
              fullscreen={false}
              disabledDate={disabledDate}
              value={selectedDate || undefined}
              onSelect={onSelect}
            />
          </div>
          <div className="bg-white rounded-md shadow p-3">
            <h2 className="font-bold text-stone-700 mb-2">
              {selectedDate
                ? `Órdenes del ${selectedDate.format(backendFormat)}`
                : "Órdenes"}
            </h2>
            {selectedDate && dayList.length > 0 && (
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por cliente, local o centro..."
                className="p-2 border rounded-md w-full mb-3"
              />
            )}
            {renderDayList()}
          </div>
        </div>

        {/* Detail panel — inline on desktop only */}
        {!isMobile && (
          <div className="lg:col-span-2">
            <div className="bg-white rounded-md shadow p-4 min-h-[200px]">
              {renderDetail()}
            </div>
          </div>
        )}
      </div>

      {/* Detail as bottom sheet on mobile */}
      {isMobile && (
        <Drawer
          placement="bottom"
          height="88%"
          open={!!selectedOrder}
          onClose={() => setSelectedOrder(null)}
          title="Detalle de la orden"
          styles={{ body: { padding: 16 } }}
        >
          {renderDetail()}
        </Drawer>
      )}
    </div>
  );
}

export default BackupsPage;
