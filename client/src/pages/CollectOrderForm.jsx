import { Form, Formik } from "formik";
import { useOrders } from "../context/OrderProvider";
import { useDeposits } from "../context/DepositsProvider";
import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import dayjs from "dayjs";
import { calc } from "antd/es/theme/internal";


function CollectOrderForm() {

  const { getOrder, updateOrder } = useOrders();
  const { getDepositsByOrderId, createDeposit } = useDeposits();
  const [client, setClient] = useState([]);
  const [cart, setCart] = useState([]);
  const [deposit, setDeposit] = useState(0);
  const [order, setOrder] = useState({
    clientId: "",
    shopId: "1",
    items: ""
  });
  const [deposits, setDeposits] = useState([]);
  const params = useParams();
  const navigate = useNavigate();
  const [platformPayment, setPlatformPayment] = useState(false);
  const fechaActual = dayjs().format('YYYY-MM-DD');
  const [depositedTotal, setDepositedTotal] = useState(false);

  const calculateTotal = () => {
    return cart.reduce((total, item) => total + item.unitValue * item.quantity, 0);
  };

  function togglePlatform() {
    setPlatformPayment(!platformPayment); // Cambiar el valor de verdadero a falso y viceversa
  }

  function depositTotal() {
    setDepositedTotal(true);
    setDeposit(calculateTotal() - order.deposit)
  }
  useEffect(() => {
    const loadOrder = async () => {
      if (params.id) {
        const order = await getOrder(params.id);
        const depositsRequest = await getDepositsByOrderId(params.id);
        setDeposits(depositsRequest);
        console.log(deposits)
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
            collectedBy: order.mall
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
            deposit: order.deposit,
            collectedBy: order.mall
          });
        }

      }
    };
    loadOrder();
  }, []);

  return (
    <div>
      <h1 className="text-xl font-bold uppercase text-center">
        {order.paid ? 'ORDEN COBRADA' : 'COBRAR/ABONAR ORDEN'}
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
          console.log('creating new deposit')
          var neewDeposit = {};
          neewDeposit.orderId = params.id;
          neewDeposit.clientId = order.clientId;
          { platformPayment ? neewDeposit.paymentMethod = 'Plataforma' : neewDeposit.paymentMethod = 'Efectivo' };
          { depositedTotal ? neewDeposit.depositValue = deposit : neewDeposit.depositValue = values.deposit }
          { order.deposit ? neewDeposit.lastDeposit = order.deposit : neewDeposit.lastDeposit = 0 };
          { depositedTotal ? neewDeposit.newDeposit = order.deposit + deposit : neewDeposit.newDeposit = values.deposit + order.deposit }

          console.log('new deposit')
          if (depositedTotal) {
            values.deposit = order.deposit + deposit
          } else {
            values.deposit = values.deposit + order.deposit
          }

          if (values.deposit >= calculateTotal()) {
            values.paid = 1;
          } else {
            values.paid = 0;
          }

          values.paidAt = fechaActual;
          if (params.id) {
            delete values.clientName;
            delete values.premises;
            delete values.createdAt;
            delete values.clientId;
            delete values.items;
            delete values.shopId;
            await createDeposit(neewDeposit);
            await updateOrder(params.id, values);
          }
          setOrder({ order });
          navigate(-1);
        }}
      >
        {({ handleChange, handleSubmit, values, isSubmitting }) => (
          <Form
            onSubmit={handleSubmit}
            className="bg-blue-400 rounded-md p-4 mx-auto mt-10">
            <div className="grid items-center py-1 ">
              <div>
                <p className="text-white-400"><b>Valor total: ${calculateTotal()}</b></p>
                {order.deposit && calculateTotal() - order.deposit ? <p className="font-bold">Abonado: ${order.deposit}</p> : ''}
                {calculateTotal() - order.deposit ? <p className="text-red-600 font-bold">Debe: ${calculateTotal() - order.deposit}</p> : ''}
              </div>
              {!platformPayment && order.paid ? '' : <button type="button" style={{
                backgroundColor: platformPayment == true ? '#A6C4F0' : '#F3F1F1',
              }}
                className="bg-indigo-500 px-2 py-1 text-black rounded-md ml-auto" onClick={() => togglePlatform()}>Plataforma</button>}
              {order.paid ? <><button
                type="button"
                onClick={() => navigate(`../pdfOrden/` + params.id)}
                className="block bg-indigo-500 px-2 my-2 py-1 text-white w-20% rounded-md ml-auto"              >
                {'Generar Factura'}
              </button><button
                type="button"
                className="block bg-indigo-500 px-2 py-1 text-white w-20% rounded-md ml-auto"              >
                  {'Orden Cobrada'}
                </button></> :
                <> <input
                  type="number"
                  name="deposit"
                  placeholder="Ej: $10.000"
                  className="m-2 px-2 py-1 rounded-sm rounded"
                  onChange={handleChange}
                  value={deposit ? deposit : values.deposit}
                />
                  <button
                    type="button"
                    onClick={depositTotal}
                    disabled={isSubmitting}
                    className="block bg-indigo-500 my-1 px-2 py-1 text-white w-20% rounded-md ml-auto"  >
                    Cobrar Total
                  </button>
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
                <p className="p-2 text-sm text-gray-300 flex items-center justify-center font-bold h-content">
                  {item.id.slice(-14)}
                </p>
                <p className="sticky right-0 text-green-500 px-2 py-1 ml-auto">${item.unitValue}</p>
              </div>
            ))}
            {deposits ? <>
              <h3>Abonos de esta orden:</h3>
              <table className="border-collapse w-100 border-2 border-gray-500 m-2">
                <thead>
                  <tr className="bg-stone-200 text-gray-700 font-bold">
                    <th className="px-2 py-1">Valor de Abono</th>
                    <th className="px-2 py-1">Valor Abonado Anterior</th>
                    <th className="px-2 py-1">Nuevo Abono de la Orden</th>
                    <th className="px-2 py-1">Fecha Abono</th>
                    <th className="px-2 py-1">Método de Pago</th>
                  </tr>
                </thead>
                <tbody>
                  {deposits.map((deposit) => (
                    <tr key={deposit.depositId} className="bg-stone-100 text-gray-700">
                      <td className="text-green-400 px-2 py-1 text-center">+${deposit.depositValue}</td>
                      <td className="px-2 py-1 text-center">${deposit.lastDeposit}</td>
                      <td className="px-2 py-1 text-center">${deposit.newDeposit}</td>
                      <td className="px-2 py-1 text-center">{deposit.depositCreatedAt.slice(11, 16) + ' ' + deposit.depositCreatedAt.slice(2, 10)}</td>
                      <td className="px-2 py-1 text-center">{deposit.paymentMeethd}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
              : ''}
          </Form>
        )
        }
      </Formik >
    </div >
  );
}

export default CollectOrderForm;
