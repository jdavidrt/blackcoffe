import { Form, Formik } from "formik";
import { useOrders } from "../context/OrderProvider";
import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import dayjs from "dayjs";

function CollectOrderForm() {

  const { createOrder, getOrder, updateOrder } = useOrders();
  const [client, setClient] = useState([]);
  const [cart, setCart] = useState([]);
  const [order, setOrder] = useState({
    clientId: "",
    shopId: "1",
    items: ""
  });
  const params = useParams();
  const navigate = useNavigate();

  const dateFormat = 'YYYY-MM-DD';
  const fechaActual = dayjs().format('YYYY-MM-DD');

  const calculateTotal = () => {
    return cart.reduce((total, item) => total + item.unitValue * item.quantity, 0);
  };

  console.log(order)

  useEffect(() => {
    const loadOrder = async () => {
      if (params.id) {
        const order = await getOrder(params.id);
        //console.log(order);
        setCart(JSON.parse(order.items))
        if (order.paid) {
          setOrder({
            clientId: order.clientId,
            shopId: 1,
            items: cart,
            clientName: order.clientName,
            premises: order.premises,
            createdAt: order.createdAt.slice(0, 10),
            paid: order.paid,
            paidAt: order.paidAt.slice(0, 10)
          });
        } else {
          setOrder({
            clientId: order.clientId,
            shopId: 1,
            items: cart,
            clientName: order.clientName,
            premises: order.premises,
            createdAt: order.createdAt.slice(0, 10),
            paid: order.paid
          });
        }

      }
    };
    loadOrder();
  }, []);

  return (
    <div>
      <h1 className="text-xl font-bold uppercase text-center">
        Cobrar Orden
      </h1>
      <h1 className="text-xl font-bold uppercase text-center">
        {order.premises} - {order.clientName} / {order.createdAt}
      </h1>

      {order.paid ? <h1 className="text-xl font-bold uppercase text-center">Dia de pago: {order.paidAt}  </h1> : ''}


      <Formik
        initialValues={order}
        enableReinitialize={true}
        onSubmit={async (values, actions) => {
          values.shopId = 1;
          values.clientId = client;
          values.items = JSON.stringify(cart)
          values.paid = 1;
          values.paidAt = fechaActual;

          //console.log('values', values);
          if (params.id) {
            delete values.clientName;
            delete values.premises;
            delete values.createdAt;
            delete values.clientId;
            delete values.items;
            delete values.shopId;
            console.log(values)
            await updateOrder(params.id, values);
          }
          setOrder({ order });
        }}
      >
        {({ handleChange, handleSubmit, values, isSubmitting }) => (
          <Form
            onSubmit={handleSubmit}
            className="bg-blue-400 rounded-md p-4 mx-auto mt-10">
            <div className="flex items-center py-1 justify-around ">
              <div>
                <p className="font-bold">Valor total: ${calculateTotal()}</p>
              </div>
              {order.paid ? <button
                type="button"
                className="block bg-indigo-500 px-2 py-1 text-white w-20% rounded-md ml-auto"              >
                {'Orden Cobrada'}
              </button> : <button
                type="submit"
                disabled={isSubmitting}
                className="block bg-indigo-500 px-2 py-1 text-white w-20% rounded-md ml-auto"              >
                {isSubmitting ? "Cobrando Orden..." : "Cobrar Orden"}
              </button>}

            </div>
            {cart.map((item) => (
              <div key={item.id} className="bg-stone-100 rounded-md m-2 flex font-bold">
                <p className="flex items-center px-2">{item.productName} - ({item.quantity})</p>
                <p className="sticky right-0 text-green-500 px-2 py-1 ml-auto">${item.unitValue}</p>
              </div>
            ))}
          </Form>
        )
        }
      </Formik >
    </div >
  );
}

export default CollectOrderForm;
