import { useOrders } from "../context/OrderProvider";
import { useNavigate } from "react-router-dom";
import { DollarOutlined } from '@ant-design/icons';
import { calculateOrderTotal } from '../utils/orderUtils';

function orderCard({ order }) {
  const navigate = useNavigate();
  const isCobrosHoy = window.location.pathname.includes("/cobrosHoy");

  return (
    <div className="flex bg-stone-100 text-black rounded-md m-2">
      <span>{order.createAt}</span>
      <b>
        <p className="p-2 flex items-center h-content">
          {order.premises} {order.clientName} - {order.mall}
          {/* Add PAGADO badge for fully paid orders */}
          {order.paid === 1 && (
            <span className="ml-2 bg-green-500 text-white text-xs px-2 py-1 rounded font-bold">PAGADO</span>
          )}
        </p>
      </b>
      <div className="flex p-2 ml-auto">
        <b>
          {/* Show deposit info for orders with deposits */}
          {order.deposit > 0 ? (
            <>
              {/* If viewing cobros hoy page and depositValue exists, show it */}
              {isCobrosHoy && order.depositValue !== undefined && order.depositValue !== null ? (
                <p>Abonado este día: ${order.depositValue.toLocaleString()} <p className="text-red-500">Debe: ${(calculateOrderTotal(order) - order.deposit).toLocaleString()}</p></p>
              ) : (
                /* Otherwise show total deposit amount */
                <p>Abono total: ${order.deposit.toLocaleString()} <p className="text-red-500">Debe: ${(calculateOrderTotal(order) - order.deposit).toLocaleString()}</p></p>
              )}
            </>
          ) : (
            /* No deposits, show total - if on cobrosHoy and order is paid, show full order total */
            <p className="text-green-500 px-2">
              {isCobrosHoy && order.paid === 1 ? `Abonado este día: $${calculateOrderTotal(order).toLocaleString()}` : `Total: $${calculateOrderTotal(order).toLocaleString()}`}
            </p>
          )}
        </b>
        <button
          className="flex bg-slate-300 px-2 py-1 text-black ml-auto"
          onClick={() => navigate(`/cobrarOrden/${order.id}`)}
        >
          <DollarOutlined onClick={() => navigate(`/cobrarOrden/${order.id}`)} />
        </button>
      </div>
    </div >
  );
}

export default orderCard;
