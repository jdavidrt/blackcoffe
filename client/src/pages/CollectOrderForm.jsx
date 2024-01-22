import { Form, Formik } from "formik";
import { useOrders } from "../context/OrderProvider";
import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import dayjs from "dayjs";
import { calc } from "antd/es/theme/internal";

function CollectOrderForm() {

  const { getOrder, updateOrder } = useOrders();
  const [client, setClient] = useState([]);
  const [cart, setCart] = useState([]);
  const [order, setOrder] = useState({
    clientId: "",
    shopId: "1",
    items: ""
  });
  const params = useParams();
  const navigate = useNavigate();
  const [platformPayment, setPlatformPayment] = useState(false);
  const fechaActual = dayjs().format('YYYY-MM-DD');

  const calculateTotal = () => {
    return cart.reduce((total, item) => total + item.unitValue * item.quantity, 0);
  };

  function togglePlatform() {
    setPlatformPayment(!platformPayment); // Cambiar el valor de verdadero a falso y viceversa
  }

  useEffect(() => {
    const loadOrder = async () => {
      if (params.id) {
        const order = await getOrder(params.id);
        setCart(JSON.parse(order.items))
        if (order.paymentMethod == "Plataforma") {
          togglePlatform(true)
        }
        if (order.paid) {
          setOrder({
            clientId: order.clientId,
            shopId: 1,
            items: cart,
            clientName: order.clientName,
            premises: order.premises,
            createdAt: order.createdAt.slice(0, 10),
            paid: order.paid,
            paidAt: order.paidAt.slice(0, 10),
            deposit: order.deposit,
          });
        } else {
          setOrder({
            clientId: order.clientId,
            shopId: 1,
            items: cart,
            clientName: order.clientName,
            premises: order.premises,
            createdAt: order.createdAt.slice(0, 10),
            paid: order.paid,
            deposit: order.deposit
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
          if (values.deposit == calculateTotal()) {
            values.paid = 1;
          } else {
            values.paid = 0;
          }

          values.paidAt = fechaActual;
          if (platformPayment) {
            values.paymentMethod = 'Plataforma'
          }
          //console.log('values', values);
          if (params.id) {
            delete values.clientName;
            delete values.premises;
            delete values.createdAt;
            delete values.clientId;
            delete values.items;
            delete values.shopId;
            await updateOrder(params.id, values);
          }
          setOrder({ order });
          navigate("/cobrarOrdenes");
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
              <button type="button" style={{
                backgroundColor: platformPayment == true ? '#A6C4F0' : '#F3F1F1',
              }}
                className="bg-indigo-500 px-2 py-1 text-black rounded-md ml-auto" onClick={() => togglePlatform()}>Plataforma</button>
              {order.paid ? <button
                type="button"
                className="block bg-indigo-500 px-2 py-1 text-white w-20% rounded-md ml-auto"              >
                {'Orden Cobrada'}
              </button> :
                <> <input
                  type="number"
                  name="deposit"
                  placeholder="Ej: $10.000"
                  className="m-2 px-2 py-1 rounded-sm rounded"
                  onChange={handleChange}
                  value={values.deposit}
                />
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="block bg-indigo-500 px-2 py-1 text-white w-20% rounded-md ml-auto"              >
                    {isSubmitting ? "Cobrando Orden..." : "Cobrar Orden"}
                  </button></>
              }

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
