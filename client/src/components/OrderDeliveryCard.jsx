import { useOrders } from "../context/OrderProvider";
import { useNavigate } from "react-router-dom";
import { DollarOutlined } from '@ant-design/icons';

function OrderDeliveryCard({ order }) {
  const navigate = useNavigate();

  const calculateTotal = () => {
    return JSON.parse(order.items).reduce((total, item) => total + item.unitValue * item.quantity, 0);
  };
  return (
    <div className="flex bg-stone-100 text-black rounded-md m-2">
      <span>{order.createAt}</span>
      <b>
        <p className="p-2 flex items-center h-content">{order.premises} {order.clientName} - {order.mall}</p></b>
      <div className="flex p-2 ml-auto">
        <b>{order.deposit ? <><p>Abono: ${order.deposit} <p className="text-red-500">Debe: ${calculateTotal() - order.deposit}</p></p> </> : ''}{order.deposit ? '' : <p className="text-green-500 px-2"> Total: ${calculateTotal()}</p>}</b>
        <button
          className="flex bg-slate-300 px-2 py-1 text-black ml-auto"
          onClick={() => navigate(`/cobrarOrden/${order.id}`)}
        >
          <DollarOutlined onClick={() => navigate(`/cobrarOrden/${order.id}`)} />
        </button>
      </div>
      {JSON.parse(order.items).map((item) => (
        <div key={item.id} className="bg-stone-100 rounded-md m-2 flex font-bold">
          <input
            type="checkbox"
            className="ml-2"
            value={item.delivered}
            checked={item.delivered}
            onChange={() => handleCheckboxChange(item.id)}
          />
          <p className="flex items-center px-2">{item.productName} - ({item.quantity})</p>
          <p className="p-2 text-sm text-gray-300 flex items-center justify-center font-bold h-content">
            {item.id.slice(-14)}
          </p>
          <p className="sticky right-0 text-green-500 px-2 py-1 ml-auto">${item.unitValue}</p>
        </div>
      ))}
    </div >
  );
}

export default OrderDeliveryCard;
