import { useOrders } from "../context/OrderProvider";
import { useNavigate } from "react-router-dom";
import { DollarOutlined } from '@ant-design/icons';
import { getOrderItems } from '../utils/jsonUtils';

function orderCard({ order }) {
  const navigate = useNavigate();
  let isCobrosHoy = false;
  if (!window.location.pathname.includes("/cobrosHoy")) {
    isCobrosHoy = true
  }

  const calculateTotal = () => {
    const items = getOrderItems(order);
    return items.reduce((total, item) => total + (item.unitValue || 0) * (item.quantity || 0), 0);
  };

  return (
    <div className="flex bg-stone-100 text-black rounded-md m-2">
      <span>{order.createAt}</span>
      <b>
        <p className="p-2 flex items-center h-content">{order.premises} {order.clientName} - {order.mall}</p></b>
      <div className="flex p-2 ml-auto">
        <b>{order.deposit ? <><p>Abonado este día: ${order.depositValue} <p className="text-red-500">Debe: ${calculateTotal() - order.deposit}</p></p> </> : ''}{order.deposit ? '' : <p className="text-green-500 px-2"> Total: ${calculateTotal()}</p>}</b>
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
