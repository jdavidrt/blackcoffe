import { useOrders } from "../context/OrderProvider";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { LoginOutlined } from '@ant-design/icons';
import { Modal } from 'antd';
import { getOrderItems } from '../utils/jsonUtils';
import { calculateOrderTotal, getItemDisplayTime } from '../utils/orderUtils';
import { getCurrentDate, formatDate } from '../utils/dateUtils';
import { getMallCardStyle } from '../utils/mallUtils';
import ProgressiveProductList from './ProgressiveProductList';

function OrderDeliveryCard({ order }) {
  const navigate = useNavigate();
  const { updateOrder } = useOrders();
  const [cart, setCart] = useState([]);
  const deliveryDate = getCurrentDate();
  const isPaid = order.paid === 1;

  const handleCheckboxChange = async (itemId) => {
    const updatedCart = cart.map((item) => {
      if (item.id === itemId) {
        return {
          ...item,
          delivered: !item.delivered,
          deliveredAt: deliveryDate
        };
      }
      return item;
    });

    try {
      await updateOrder(order.id, { items: JSON.stringify(updatedCart) });
      setCart(updatedCart);
      setTimeout(() => {
        window.location.reload();
      }, 3000);
    } catch (error) {
      const paidOrderId = error.response?.status === 400 && error.response?.data?.orderId;
      if (paidOrderId) {
        Modal.error({
          title: 'Orden ya pagada',
          content: (
            <div>
              <p>Esta orden ya fue pagada y no puede modificarse, incluyendo el estado de entrega de sus productos.</p>
              <a
                href={`/factura/${paidOrderId}`}
                style={{ color: '#1677ff', textDecoration: 'underline', fontWeight: '600', display: 'inline-block', marginTop: '4px' }}
              >
                Ver factura #{paidOrderId}
              </a>
            </div>
          ),
        });
      }
    }
  };

  useEffect(() => {
    setCart(getOrderItems(order))
  }, [])

  return (
    <div className={getMallCardStyle(order.mall)}>
      <div className="flex items-center">
        <span className="text-xs text-gray-500 px-2 whitespace-nowrap">{formatDate(order.createAt)}</span>
        <b>
          <p className="p-2 flex items-center h-content">{order.premises} {order.clientName} - {order.mall}</p>
        </b>
        <div className="flex flex-col p-2 ml-auto text-right shrink-0">
          <b>
            {order.deposit ? (
              <>
                <span>Abono: ${order.deposit}</span>
                <span className="text-red-500 block">Debe: ${calculateOrderTotal(order) - order.deposit}</span>
              </>
            ) : (
              <span className="text-zinc-950 px-2">Total: ${calculateOrderTotal(order)}</span>
            )}
          </b>
        </div>
        <button
          type="button"
          className="w-8 h-8 rounded-md flex items-center justify-center bg-slate-300 text-black shrink-0 ml-2"
          onClick={() => navigate(`/cobrarOrden/${order.id}`)}
        >
          <LoginOutlined />
        </button>
      </div>

      {isPaid && (
        <p className="text-xs text-gray-400 px-4 pb-1">Pagado – sin modificaciones</p>
      )}

      <ProgressiveProductList
        products={getOrderItems(order).filter(item => !item.delivered).reverse()}
        renderProduct={(item) => (
          <div key={item.id} className="bg-stone-100 rounded-md m-2 flex font-bold">
            {!isPaid && (
              <input
                type="checkbox"
                className="ml-2"
                value={item.delivered}
                checked={item.delivered}
                onChange={() => handleCheckboxChange(item.id)}
              />
            )}
            <p className="flex items-center px-2">{item.productName} - ({item.quantity})</p>
            <p className="p-2 text-sm text-gray-700 flex items-center justify-center font-bold h-content">
              {getItemDisplayTime(item.id)}
            </p>
            <p className="sticky right-0 text-green-500 px-2 py-1 ml-auto">${item.quantity * item.unitValue}</p>
          </div>
        )}
      />
    </div>
  );
}

export default OrderDeliveryCard;
