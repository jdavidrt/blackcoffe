import { useOrders } from "../context/OrderProvider";
import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { LoginOutlined } from '@ant-design/icons';
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

  // Audit fix 1.6: serialize concurrent checkbox writes through a promise chain
  // so two rapid clicks cannot overwrite each other's `items` JSON.
  // - latestCartRef holds the source-of-truth cart shape between renders.
  // - writeChainRef chains updateOrder calls; each waits for the previous.
  const latestCartRef = useRef([]);
  const writeChainRef = useRef(Promise.resolve());

  const handleCheckboxChange = (itemId) => {
    const updatedCart = latestCartRef.current.map((item) =>
      item.id === itemId
        ? { ...item, delivered: !item.delivered, deliveredAt: deliveryDate }
        : item
    );
    latestCartRef.current = updatedCart;
    setCart(updatedCart);

    // Queue the write — last-write-wins always sends latestCartRef.current.
    writeChainRef.current = writeChainRef.current
      .then(() => updateOrder(order.id, { items: JSON.stringify(latestCartRef.current) }))
      .catch((err) => console.error('[OrderDeliveryCard] updateOrder failed:', err));
  };


  useEffect(() => {
    const initial = getOrderItems(order);
    latestCartRef.current = initial;
    setCart(initial);
  }, [])

  return (
    <div className={getMallCardStyle(order.mall)}>
      <div className="flex">
        <span>{formatDate(order.createdAtTs)}</span>
        <b>
          <p className="p-2 flex items-center h-content">{order.premises} {order.clientName} - {order.mall}</p>
        </b>
        <div className="flex p-2 ml-auto">
          <b>
            {order.deposit ? (
              <>
                <p>Abono: ${order.deposit} <p className="text-red-500">Debe: ${calculateOrderTotal(order) - order.deposit}</p></p>
              </>
            ) : (
              <p className="text-zinc-950 px-2"> Total: ${calculateOrderTotal(order)}</p>
            )}
          </b>
          <button
            className="flex bg-slate-300 px-2 py-1 text-black ml-auto"
            onClick={() => navigate(`/cobrarOrden/${order.id}`)}
          >
            <LoginOutlined onClick={() => navigate(`/cobrarOrden/${order.id}`)} />
          </button>
        </div>
      </div>
      <ProgressiveProductList
        products={getOrderItems(order).filter(item => !item.delivered).reverse()}
        renderProduct={(item) => (
          <div key={item.id} className="bg-stone-100 rounded-md m-2 flex font-bold">
            <input
              type="checkbox"
              className="ml-2"
              value={item.delivered}
              checked={item.delivered}
              onChange={() => handleCheckboxChange(item.id)}
            />
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
