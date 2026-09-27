import { Fragment } from "react";
import { useNavigate } from "react-router-dom";
import { LoginOutlined } from '@ant-design/icons';
import { getOrderItems } from '../utils/jsonUtils';
import { useItemDelivery } from '../utils/useItemDelivery';
import { calculateOrderTotal, getItemDisplayTime, getItemDate } from '../utils/orderUtils';
import { formatDate } from '../utils/dateUtils';
import { getMallCardStyle } from '../utils/mallUtils';
import ProgressiveProductList from './ProgressiveProductList';

function OrderDeliveryCard({ order }) {
  const navigate = useNavigate();
  const isPaid = order.paid === 1;

  const { isDelivered, isSaving, toggle } = useItemDelivery(order.id, order.items);

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
                    checked={isDelivered(item)}
                    disabled={isSaving(item)}
                    onChange={() => toggle(item)}
                  />
                )}
                <p className="flex items-center px-2">{item.productName} - ({item.quantity})</p>
                {isSaving(item) && <p className="flex items-center text-xs text-gray-500">Guardando…</p>}
                <p className="p-2 text-sm text-gray-700 flex items-center justify-center font-bold h-content">
                  {getItemDisplayTime(item.id)}
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

export default OrderDeliveryCard;
