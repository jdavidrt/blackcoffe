import { useEffect, useState } from "react";
import { Modal } from "antd";
import { setItemDeliveredRequest } from "../api/orders.api";
import { reloadData } from "./network";
import { getCurrentDate } from "./dateUtils";

const blueButton = { style: { backgroundColor: "#1677ff", borderColor: "#1677ff", color: "#fff" } };

// Delivery checkboxes (Recorrido, Entregados, Cobrar Orden). The checkbox updates in place from
// the server's answer: reloading the page after each tick re-downloaded the app and every order,
// the most fragile thing to do on a weak signal. A ticked item stays on screen until the next load,
// so a mistake can be unticked. `items` is the list as loaded: a new one clears the local changes.
export function useItemDelivery(orderId, items) {
  const [confirmed, setConfirmed] = useState({}); // itemId → delivered, as the server confirmed
  const [saving, setSaving] = useState({}); // itemId → delivered, on its way to the server
  useEffect(() => setConfirmed({}), [items]);

  const isSaving = (item) => item.id in saving;
  const isDelivered = (item) => (isSaving(item) ? saving[item.id] : confirmed[item.id] ?? item.delivered);

  const toggle = async (item) => {
    if (isSaving(item)) return; // one request per item at a time, so retries can't land out of order
    const delivered = !isDelivered(item);
    setSaving((s) => ({ ...s, [item.id]: delivered }));
    try {
      // Only this item's new state goes to the server, which applies it to the order's current
      // items: products added after this page loaded are kept.
      await setItemDeliveredRequest(orderId, item.id, delivered, getCurrentDate());
      setConfirmed((c) => ({ ...c, [item.id]: delivered }));
    } catch (error) {
      showDeliveryError(error);
    } finally {
      setSaving(({ [item.id]: _, ...rest }) => rest);
    }
  };

  return { isDelivered, isSaving, toggle };
}

function showDeliveryError(error) {
  const status = error.response?.status; // 0 or undefined: no answer (signal)
  const paidOrderId = status === 400 && error.response.data?.orderId;
  if (paidOrderId) {
    Modal.error({
      title: "Orden ya pagada",
      content: (
        <div>
          <p>Esta orden ya fue pagada y no puede modificarse, incluyendo el estado de entrega de sus productos.</p>
          <a
            href={`/factura/${paidOrderId}`}
            style={{ color: "#1677ff", textDecoration: "underline", fontWeight: "600", display: "inline-block", marginTop: "4px" }}
          >
            Ver factura #{paidOrderId}
          </a>
        </div>
      ),
      okButtonProps: blueButton,
    });
  } else if (!status) {
    // Setting a delivery twice is harmless, so tapping again is always safe.
    Modal.warning({
      title: "Entrega sin confirmar",
      content: "La señal está débil o se perdió y no se pudo confirmar la entrega. Toque la casilla otra vez cuando tenga mejor señal.",
      okButtonProps: blueButton,
    });
  } else {
    Modal.error({
      title: "No se pudo actualizar la entrega",
      content: error.response.data?.message || "Recargue para ver la versión actual de la orden.",
      okText: "Recargar",
      okButtonProps: blueButton,
      onOk: reloadData,
    });
  }
}
