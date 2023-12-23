import { Form, Formik } from "formik";
import { useOrders } from "../context/OrderProvider";
import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

function OrderForm() {
  const { createOrder, getOrder, updateOrder } = useOrders();
  const [order, setOrder] = useState({
    clientId: "",
    shopId: "",
    paymentMethod: ""
  });
  const params = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    const loadOrder = async () => {
      if (params.id) {
        const order = await getOrder(params.id);
        console.log(order);
        setOrder({
          clientId: order.clientId,
          shopId: order.shopId,
          paymentMethod: order.paymentMethod
        });
      }
    };
    loadOrder();
  }, []);

  return (
    <div>
      <Formik
        initialValues={order}
        enableReinitialize={true}
        onSubmit={async (values, actions) => {
          console.log(values);
          if (params.id) {
            await updateOrder(params.id, values);
          } else {
            await createOrder(values);
          }
          navigate("/");
          setOrder({
            clientId: "",
            shopId: "",
            paymentMethod: ""
          });
        }}
      >
        {({ handleChange, handleSubmit, values, isSubmitting }) => (
          <Form
            onSubmit={handleSubmit}
            className="bg-slate-300 max-w-sm rounded-md p-4 mx-auto mt-10"
          >
            <h1 className="text-xl font-bold uppercase text-center">
              {params.id ? "Edit Order" : "New Order"}
            </h1>
            <label className="block">clientId</label>
            <input
              type="text"
              name="clientId"
              placeholder="Id cliente"
              className="px-2 py-1 rounded-sm w-full"
              onChange={handleChange}
              value={values.clientId}
            />
            <label className="block">shopId</label>
            <input
              type="text"
              name="shopId"
              placeholder="Id tienda"
              className="px-2 py-1 rounded-sm w-full"
              onChange={handleChange}
              value={values.shopId}
            />

            <label className="block">Metodo de pago</label>
            <input
              type="text"
              name="paymentMethod"
              placeholder="Metodo de pago"
              className="px-2 py-1 rounded-sm w-full"
              onChange={handleChange}
              value={values.paymentMethod}
            />

            <button
              type="submit"
              disabled={isSubmitting}
              className="block bg-indigo-500 px-2 py-1 text-white w-full rounded-md"
            >
              {isSubmitting ? "Saving..." : "Save"}
            </button>
          </Form>
        )}
      </Formik>
    </div>
  );
}

export default OrderForm;
