import { useOrders } from "../context/OrderProvider";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { LoginOutlined } from '@ant-design/icons';
import dayjs from "dayjs";

function OrderDeliveryCard({ order }) {
  const navigate = useNavigate();
  const { updateOrder } = useOrders();
  const [cart, setCart] = useState([]);
  const deliveryDate = dayjs().format('YYYY-MM-DD');

  const handleCheckboxChange = async (itemId) => {
    setCart((prevCart) => {
      const updatedCart = prevCart.map((item) => {
        if (item.id === itemId) {
          return {
            ...item,
            delivered: !item.delivered,
            deliveredAt: deliveryDate
          };
        }
        return item;
      });

      console.log('cart', updatedCart); // Usa updatedCart en lugar de cart
      var values = {};
      values.items = JSON.stringify(updatedCart);
      console.log('vals', values.items);

      // Llama a tu función asíncrona aquí (en este caso, updateOrder)
      updateOrder(order.id, values);
      setTimeout(() => {
        window.location.reload();
      }, 3000);
      return updatedCart;
    });
  };

  const calculateTotal = () => {
    return JSON.parse(order.items).reduce((total, item) => total + item.unitValue * item.quantity, 0);
  };

  useEffect(() => {
    setCart(JSON.parse(order.items))
  }, [])

  return (
    <div className={`flex flex-col rounded-md m-2 ${order.mall === 'Unilago' ? 'bg-amberx -300' : order.mall === 'Alta Tecnología' ? 'bg-teal-500' : order.mall === 'Otros' ? 'bg-amber-500' : 'bg-stone-100'} text-black`}>
      <div className="flex">
        <span>{order.createAt}</span>
        <b>
          <p className="p-2 flex items-center h-content">{order.premises} {order.clientName} - {order.mall}</p>
        </b>
        <div className="flex p-2 ml-auto">
          <b>
            {order.deposit ? (
              <>
                <p>Abono: ${order.deposit} <p className="text-red-500">Debe: ${calculateTotal() - order.deposit}</p></p>
              </>
            ) : (
              <p className="text-zinc-950 px-2"> Total: ${calculateTotal()}</p>
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
      <div id='asd'>
        {JSON.parse(order.items).map((item) => (
          !item.delivered && (
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
                {item.id.slice(-14)}
              </p>
              <p className="sticky right-0 text-green-500 px-2 py-1 ml-auto">${item.unitValue}</p>
            </div>
          )
        ))}
      </div>
    </div>

  );
}

export default OrderDeliveryCard;
