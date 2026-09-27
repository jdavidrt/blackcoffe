import { Fragment } from "react";
import { useNavigate } from "react-router-dom";
import { LoginOutlined } from '@ant-design/icons';
import { Modal } from 'antd';
import { getOrderItems } from '../utils/jsonUtils';
import { setItemDeliveredRequest } from '../api/orders.api';
import { calculateOrderTotal, getItemDisplayTime, getItemDate } from '../utils/orderUtils';
import { getCurrentDate, formatDate } from '../utils/dateUtils';
import { getMallCardStyle } from '../utils/mallUtils';
import ProgressiveProductList from './ProgressiveProductList';

function OrderDeliveredCard({ order }) {
  const navigate = useNavigate();
  const deliveryDate = getCurrentDate();
  const isPaid = order.paid === 1;
  // /deliveredOrders/:date sends only that day's delivered items, plus the full order `total`.
  const orderTotal = order.total ?? calculateOrderTotal(order);

  const handleCheckboxChange = async (itemId) => {
    const item = getOrderItems(order).find((it) => it.id === itemId);
    if (!item) {
      Modal.error({ title: 'Error', content: 'No se pudieron leer los productos de la orden. Recargue la página.' });
      return;
    }

    try {
      // Only this item's new state goes to the server, which applies it to the order's current
      // items: products added after this page loaded are kept.
      await setItemDeliveredRequest(order.id, itemId, !item.delivered, deliveryDate);
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
      } else {
        Modal.error({
          title: 'No se pudo actualizar la entrega',
          content: error.response?.data?.message || 'Revise la conexión y recargue la página.',
          okText: 'Recargar',
          okButtonProps: { style: { backgroundColor: '#1677ff', borderColor: '#1677ff', color: '#fff' } },
          onOk: () => window.location.reload(),
        });
      }
    }
  };

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
                <span className="block">Abono: ${order.deposit}</span>
                <span className="block text-red-500">Debe: ${orderTotal - order.deposit}</span>
              </>
            ) : (
              <span className="text-zinc-950 px-2">Total: ${orderTotal}</span>
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
        products={getOrderItems(order)
          .filter((item) => item.delivered && item.deliveredAt === localStorage.getItem('dateFilter'))
          .reverse()}
        renderProduct={(item, index, arr) => {
          const showSep = index === 0 || getItemDate(arr[index - 1].id) !== getItemDate(item.id);
          return (
            <Fragment key={item.id}>
              {showSep && (
                <div className="text-center text-xs font-semibold text-gray-500 bg-gray-200 rounded-md mx-2 mt-2 py-1">
                  {getItemDate(item.id)}
                </div>
              )}
              <div className="bg-stone-100 rounded-md m-2 flex font-bold">
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
                <p className="p-2 text-sm text-gray-700 flex items-center justify-center font-bold h-content">
                  Entregado: {formatDate(item.deliveredAt)}
                </p>
                <p className="sticky right-0 text-green-500 px-2 py-1 ml-auto">${item.quantity * item.unitValue}</p>
              </div>
            </Fragment>
          );
        }}
      />
    </div>
  );
}

export default OrderDeliveredCard;
