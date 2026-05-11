import { useOrders } from "../context/OrderProvider";
import { useNavigate } from "react-router-dom";
import { DollarOutlined } from '@ant-design/icons';
import { calculateOrderTotal } from '../utils/orderUtils';
import { formatDate } from '../utils/dateUtils';

function orderCard({ order }) {
  const navigate = useNavigate();
  const isCobrosHoy = window.location.pathname.includes("/cobrosHoy");

  const orderTotal = calculateOrderTotal(order);
  const isFullyPaid = order.deposit >= orderTotal;

  return (
    <div className="flex items-center bg-stone-100 text-black rounded-md m-2">
      <span className="text-xs text-gray-500 px-2 whitespace-nowrap">{formatDate(order.createAt)}</span>
      <b>
        <p className="p-2 flex items-center h-content">
          {order.premises} {order.clientName} - {order.mall}
          {isFullyPaid && (
            <span className="ml-2 bg-green-500 text-white text-xs px-2 py-1 rounded font-bold">PAGADO</span>
          )}
        </p>
      </b>
      <div className="flex flex-col p-2 ml-auto text-right shrink-0">
        <b>
          {order.deposit > 0 ? (
            <>
              {isCobrosHoy && order.depositValue !== undefined && order.depositValue !== null ? (
                <>
                  <span className="block">Abonado este día: ${order.depositValue.toLocaleString()}</span>
                  {order.deposit < orderTotal && (
                    <span className="block text-red-500">Debe: ${(orderTotal - order.deposit).toLocaleString()}</span>
                  )}
                </>
              ) : (
                <>
                  {isCobrosHoy ? (
                    <>
                      <span className="block">Abonado este día: ${order.deposit.toLocaleString()}</span>
                      {order.deposit < orderTotal && (
                        <span className="block text-red-500">Debe: ${(orderTotal - order.deposit).toLocaleString()}</span>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="block">Abono total: ${order.deposit.toLocaleString()}</span>
                      {order.deposit < orderTotal && (
                        <span className="block text-red-500">Debe: ${(orderTotal - order.deposit).toLocaleString()}</span>
                      )}
                    </>
                  )}
                </>
              )}
            </>
          ) : (
            <span className="text-green-500 px-2">Total: ${orderTotal.toLocaleString()}</span>
          )}
        </b>
      </div>
      <button
        type="button"
        className="w-8 h-8 rounded-md flex items-center justify-center bg-slate-300 text-black shrink-0 ml-2"
        onClick={() => navigate(`/cobrarOrden/${order.id}`)}
      >
        <DollarOutlined />
      </button>
    </div>
  );
}

export default orderCard;
