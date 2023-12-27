import { Form, Formik } from "formik";
import { useOrders } from "../context/OrderProvider";
import { useClients } from "../context/ClientProvider";
import { useProducts } from "../context/ProductProvider";
import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

function OrderForm() {
  const { createOrder, getOrder, updateOrder } = useOrders();
  const { products, loadProducts } = useProducts();
  const { clients, loadClients } = useClients()
  const [client, setClient] = useState([]);
  const [cart, setCart] = useState([]);
  const [mall, setMall] = useState("");
  const [order, setOrder] = useState({
    clientId: "",
    shopId: "",
    products: ""
  });
  const params = useParams();
  const navigate = useNavigate();

  const addToOrder = (product) => {
    const updatedCart = [...cart];
    const existingProductIndex = updatedCart.findIndex(
      (item) => item.name === product.name
    );

    if (existingProductIndex !== -1) {
      updatedCart[existingProductIndex].quantity += 1;
    } else {
      updatedCart.push({ ...product, quantity: 1 });
    }
    setCart(updatedCart);
  };

  const removeOrder = (productName) => {
    const updatedCart = cart.filter((item) => item.name !== productName);
    setCart(updatedCart);
  };


  const selectMall = (selectedMall) => {
    const newMall = selectedMall;
    setMall(newMall);
    loadClients(newMall);
  };

  const selectClient = (event) => {
    const newClient = event.target.value;
    setClient(newClient);
    console.log(newClient);
  };

  useEffect(() => {
    const loadOrder = async () => {
      if (params.id) {
        const order = await getOrder(params.id);
        console.log(order);
        setOrder({
          clientId: client,
          shopId: 1,
          products: order.products
        });
      }
    };
    loadOrder();
    loadProducts();
  }, []);

  return (
    <div>
      <h1 className="text-xl font-bold uppercase text-center">
        {params.id ? "Editar Orden" : "Nueva Orden"}
      </h1>

      <div className="flex">
        <button type="button" style={{
          backgroundColor: mall === 'Unilago' ? '#A6C4F0' : '#F3F1F1',
        }}
          className=" bg-indigo-500 px-3 py-1 text-black rounded-md" onClick={() => selectMall('Unilago')}>Unilago</button>
        <div className="px-2" />
        <button type="button" style={{
          backgroundColor: mall === 'Alta Tecnología' ? '#A6C4F0' : '#F3F1F1',
        }}
          className="bg-indigo-500 px-3 py-1 text-black rounded-md" onClick={() => selectMall('Alta Tecnología')}>Alta Tecnología</button>
        <div className="px-2" />
        <button type="button" style={{
          backgroundColor: mall === 'Cliente Frecuente' ? '#A6C4F0' : '#F3F1F1',
        }}
          className="bg-indigo-500 px-3 py-1 text-black rounded-md" onClick={() => selectMall('Cliente Frecuente')}>Cliente Frecuente</button>
        <div className="px-2" />
        <select name="clientId" className="px-2 py-1 rounded-sm w-100%"
          onChange={selectClient}
        //value={values.clientId}
        >
          <option key={1} value={1}> --- </option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.premises} - {client.clientName}
            </option>
          ))}
        </select>
      </div>
      <div className="py-2" />

      <Formik
        initialValues={order}
        enableReinitialize={true}
        onSubmit={async (values, actions) => {
          values.shopId = 1;
          values.clientId = client;
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
            className="bg-slate-300 rounded-md p-4 mx-auto mt-10">

            <label className="block">Productos</label>
            <input
              type="text"
              name="products"
              placeholder="Metodo de pago"
              className="px-2 py-1 rounded-sm w-full"
              onChange={handleChange}
              value={values.products}
            />

            <h2>Productos</h2>
            <ul>
              {products.map((product) => (
                <li key={product.id}>
                  {product.productName} - ${product.unitValue.toFixed(2)}{' '}
                  <button onClick={() => addToCart(product)}>Add to Cart</button>
                </li>
              ))}
            </ul>

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
    </div >
  );
}

export default OrderForm;
