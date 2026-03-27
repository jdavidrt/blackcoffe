import { useOrders } from "../context/OrderProvider";
import { useNavigate } from "react-router-dom";
import { DollarOutlined } from '@ant-design/icons';
import { calculateOrderTotal } from '../utils/orderUtils';
import { formatDate } from '../utils/dateUtils';

function orderCard({ order }) {
  const navigate = useNavigate();
  const isCobrosHoy = window.location.pathname.includes("/cobrosHoy");

  // Calculate if order is truly fully paid based on deposit amount (NOT paid flag)
  const orderTotal = calculateOrderTotal(order);
  const isFullyPaid = order.deposit >= orderTotal;

  return (
    <div className="flex bg-stone-100 text-black rounded-md m-2">
      <span>{formatDate(order.createAt)}</span>
      <b>
        <p className="p-2 flex items-center h-content">
          {order.premises} {order.clientName} - {order.mall}
          {/* Add PAGADO badge only for truly fully paid orders */}
          {isFullyPaid && (
            <span className="ml-2 bg-green-500 text-white text-xs px-2 py-1 rounded font-bold">PAGADO</span>
          )}
        </p>
      </b>
      <div className="flex p-2 ml-auto">
        <b>
          {/* Show deposit info for orders with deposits */}
          {order.deposit > 0 ? (
            <>
              {/* If viewing cobros hoy page and depositValue exists, show deposits from that day */}
              {isCobrosHoy && order.depositValue !== undefined && order.depositValue !== null ? (
                /* Case 1: Has actual deposit records from selected date */
                /* depositValue already contains sum of deposits from that specific day (aggregated by sumarDepositos) */
                <p>Abonado este día: ${order.depositValue.toLocaleString()}
                  {/* Show remaining debt based on cumulative deposits */}
                  {order.deposit < orderTotal && (
                    <p className="text-red-500">Debe: ${(orderTotal - order.deposit).toLocaleString()}</p>
                  )}
                </p>
              ) : (
                /* Otherwise show total deposit amount from order.deposit field */
                <>
                  {isCobrosHoy ? (
                    /* Case 2: On cobrosHoy but no depositValue - order shown due to paidAt, not actual deposits that day */
                    /* Show order.deposit as "Abonado este día" since we have no way to figure out previous deposit value */
                    <p>Abonado este día: ${order.deposit.toLocaleString()}
                      {order.deposit < orderTotal && (
                        <p className="text-red-500">Debe: ${(orderTotal - order.deposit).toLocaleString()}</p>
                      )}
                    </p>
                  ) : (
                    /* Regular view - show total accumulated deposit */
                    <p>Abono total: ${order.deposit.toLocaleString()}
                      {order.deposit < orderTotal && (
                        <p className="text-red-500">Debe: ${(orderTotal - order.deposit).toLocaleString()}</p>
                      )}
                    </p>
                  )}
                </>
              )}
            </>
          ) : (
            /* No deposits at all, show total */
            <p className="text-green-500 px-2">
              Total: ${orderTotal.toLocaleString()}
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
