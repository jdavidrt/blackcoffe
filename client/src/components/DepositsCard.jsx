import { useOrders } from "../context/OrderProvider";
import { useNavigate } from "react-router-dom";
import { DollarOutlined } from '@ant-design/icons';
import { getOrderItems } from '../utils/jsonUtils';

function depositsCard({ order }) {
  const navigate = useNavigate();

  const calculateTotal = () => {
    const items = getOrderItems(order);
    return items.reduce((total, item) => total + (item.unitValue || 0) * (item.quantity || 0), 0);
  };
  return (
    <div className="flex bg-stone-100 text-black rounded-md m-2">
      <span>{order.createAt}</span>
      <b>
        <p className="p-2 flex items-center h-content">{order.premises} {order.clientName} - {order.mall}/ {order.depositCreatedAt.slice(11, 16) + ' ' + order.depositCreatedAt.slice(2, 10)} ({order.paymentMethod})</p></b>
      <div className="flex p-2 ml-auto">
        <b>{order.deposit ? <><p>Abono: ${order.depositValue}<p>Abonado Anterior: ${order.lastDeposit} </p><p className="text-red-500">Debe: ${calculateTotal() - order.newDeposit}</p></p> </> : ''}</b>
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

export default depositsCard;
