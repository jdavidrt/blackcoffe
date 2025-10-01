import { useOrders } from "../context/OrderProvider";
import { useNavigate } from "react-router-dom";
import { DollarOutlined } from '@ant-design/icons';
import { calculateOrderTotal } from '../utils/orderUtils';
import { formatDepositDateTime } from '../utils/dateUtils';

function depositsCard({ order }) {
  const navigate = useNavigate();
  const isDeleted = order.isDeleted === 1;

  return (
    <div
      className={`flex rounded-md m-2 ${
        isDeleted
          ? 'bg-gray-300 text-gray-500 opacity-60 line-through'
          : 'bg-stone-100 text-black'
      }`}
    >
      <span>{order.createAt}</span>
      <b>
        <p className="p-2 flex items-center h-content">
          {isDeleted && <span className="text-red-600 font-bold mr-2">[ELIMINADO]</span>}
          {order.premises} {order.clientName} - {order.mall}/ {formatDepositDateTime(order.depositCreatedAt)} ({order.paymentMethod})
        </p>
      </b>
      <div className="flex p-2 ml-auto">
        <b>
          {order.deposit ? (
            <>
              <p>Abono: ${order.depositValue}
                <p>Abonado Anterior: ${order.lastDeposit}</p>
                <p className={isDeleted ? "text-gray-600" : "text-red-500"}>
                  Debe: ${calculateOrderTotal(order) - order.newDeposit}
                </p>
              </p>
            </>
          ) : ''}
        </b>
        <button
          className={`flex px-2 py-1 ml-auto ${
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
    </div >
  );
}

export default depositsCard;
