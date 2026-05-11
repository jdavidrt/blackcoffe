import { useOrders } from "../context/OrderProvider";
import { useNavigate } from "react-router-dom";
import { EditOutlined } from '@ant-design/icons';
import { calculateOrderTotal } from '../utils/orderUtils';

function orderCard({ order }) {
  const { deleteOrder, toggleorderDone } = useOrders();
  const navigate = useNavigate();

  return (
    <div className="flex items-center bg-stone-100 text-black rounded-md m-2">
      <span className="text-xs text-gray-500 px-2 whitespace-nowrap">{order.createAt}</span>
      <b>
        <p className="p-2 flex items-center h-content">{order.premises} {order.clientName} - {order.mall}</p>
      </b>
      <div className="flex items-center gap-2 p-2 ml-auto shrink-0">
        <b><p className="text-green-500 px-2">${calculateOrderTotal(order)}</p></b>
        <button
          type="button"
          className="w-8 h-8 rounded-md flex items-center justify-center bg-slate-300 text-black"
          onClick={() => navigate(`/editarOrden/${order.id}`)}
        >
          <EditOutlined />
        </button>
      </div>
    </div>
  );
}

export default orderCard;
