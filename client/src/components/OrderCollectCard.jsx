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
        <p className="p-2 flex items-center h-content">{order.premises} {order.clientName} - {order.mall}</p></b>
      <div className="flex p-2 ml-auto">
        <b>
          {/* Show deposit info for orders with deposits */}
          {order.deposit > 0 ? (
            <>
              {/* If viewing cobros hoy page and depositValue exists, show it */}
              {isCobrosHoy && order.depositValue !== undefined ? (
                <p>Abonado este día: ${order.depositValue} <p className="text-red-500">Debe: ${calculateOrderTotal(order) - order.deposit}</p></p>
              ) : (
                /* Otherwise show total deposit amount */
                <p>Abono total: ${order.deposit} <p className="text-red-500">Debe: ${calculateOrderTotal(order) - order.deposit}</p></p>
              )}
            </>
          ) : (
            /* No deposits, show total */
            <p className="text-green-500 px-2">Total: ${calculateOrderTotal(order)}</p>
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
