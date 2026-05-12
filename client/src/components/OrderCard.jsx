import { useOrders } from "../context/OrderProvider";
import { useNavigate } from "react-router-dom";
import { EditOutlined } from '@ant-design/icons';
import { Modal } from 'antd';
import { calculateOrderTotal } from '../utils/orderUtils';

function orderCard({ order }) {
  const { deleteOrder, toggleorderDone } = useOrders();
  const navigate = useNavigate();

  const handleEdit = () => {
    if (order.paid === 1) {
      Modal.error({
        title: 'Orden ya pagada',
        content: (
          <div>
            <p>Esta orden ya fue pagada y no puede ser modificada.</p>
            <a
              href={`/factura/${order.id}`}
              style={{ color: '#1677ff', textDecoration: 'underline', fontWeight: '600', display: 'inline-block', marginTop: '4px' }}
            >
              Ver factura #{order.id}
            </a>
          </div>
        ),
      });
      return;
    }
    navigate(`/editarOrden/${order.id}`);
  };

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
          onClick={handleEdit}
        >
          <EditOutlined />
        </button>
      </div>
    </div>
  );
}

export default orderCard;
