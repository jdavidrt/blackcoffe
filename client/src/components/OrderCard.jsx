import { useOrders } from "../context/OrderProvider";
import { useNavigate } from "react-router-dom";
import { EditOutlined } from '@ant-design/icons';
import { getOrderItems } from '../utils/jsonUtils';

function orderCard({ order }) {
  const { deleteOrder, toggleorderDone } = useOrders();
  const navigate = useNavigate();

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
        <b><p className="text-green-500 px-2">${calculateTotal()}</p></b>
        <button
          className="flex bg-slate-300 px-2 py-1 text-black ml-auto"
          onClick={() => navigate(`/editarOrden/${order.id}`)}
        >
          <EditOutlined onClick={() => navigate(`/editarOrden/${order.id}`)} />
        </button>
      </div>
    </div >
  );
}

export default orderCard;
