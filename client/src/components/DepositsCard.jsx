import { useOrders } from "../context/OrderProvider";
import { useNavigate } from "react-router-dom";
import { DollarOutlined } from '@ant-design/icons';
import { calculateOrderTotal } from '../utils/orderUtils';
import { formatDepositDateTime, formatDate } from '../utils/dateUtils';

function depositsCard({ order }) {
  const navigate = useNavigate();
  const isDeleted = order.isDeleted === 1;

  return (
    <div
      className={`flex items-center rounded-md m-2 ${
        isDeleted
          ? 'bg-gray-300 text-gray-500 opacity-60 line-through'
          : 'bg-stone-100 text-black'
      }`}
    >
      <span className="text-xs text-gray-500 px-2 whitespace-nowrap">{formatDate(order.createAt)}</span>
      <b>
        <p className="p-2 flex items-center h-content">
          {isDeleted && <span className="text-red-600 font-bold mr-2">[ELIMINADO]</span>}
          {order.premises} {order.clientName} - {order.mall}/ {formatDepositDateTime(order.depositCreatedAt)} ({order.paymentMethod})
        </p>
      </b>
      <div className="flex flex-col p-2 ml-auto text-right shrink-0">
        <b>
          {order.deposit ? (
            <>
              <span className="block">Abono: ${order.depositValue}</span>
              <span className="block">Abonado Anterior: ${order.lastDeposit}</span>
              <span className={`block ${isDeleted ? 'text-gray-600' : 'text-red-500'}`}>
                Debe: ${calculateOrderTotal(order) - order.newDeposit}
              </span>
            </>
          ) : ''}
        </b>
      </div>
      <button
        type="button"
        className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ml-2 ${
          isDeleted
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-slate-300 text-black'
        }`}
        onClick={() => !isDeleted && navigate(`/cobrarOrden/${order.id}`)}
        disabled={isDeleted}
      >
        <DollarOutlined />
      </button>
    </div>
  );
}

export default depositsCard;
