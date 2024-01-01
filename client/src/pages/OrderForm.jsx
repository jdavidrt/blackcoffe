import { Form, Formik } from "formik";
import { useOrders } from "../context/OrderProvider";
import { useClients } from "../context/ClientProvider";
import { useProducts } from "../context/ProductProvider";
import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { PlusCircleOutlined, MinusCircleOutlined } from "@ant-design/icons";

function OrderForm() {
  const { createOrder, getOrder, updateOrder } = useOrders();
  const { products, loadProducts } = useProducts();
  const { clients, loadClients } = useClients()
  const [client, setClient] = useState([]);
  const [cart, setCart] = useState([]);
  const [mall, setMall] = useState("");
  const [order, setOrder] = useState({
    clientId: "",
    shopId: "1",
    items: ""
  });
  const params = useParams();
  const navigate = useNavigate();

  const handleAddToCart = (product) => {
    const existingProduct = cart.find((item) => item.id === product.id);

    if (existingProduct) {
      const updatedCart = cart.map((item) =>
        item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
      );
      setCart(updatedCart);
    } else {
      setCart([...cart, { ...product, quantity: 1 }]);
    }
  };

  const handleRemoveFromCart = (productId) => {
    const updatedCart = cart.map((item) =>
      item.id === productId ? { ...item, quantity: item.quantity - 1 } : item
    );

    // Elimina el producto del carrito si la cantidad es 0
    setCart(updatedCart.filter((item) => item.quantity > 0));
  };

  const handleAddOneToCart = (productId) => {
    const updatedCart = cart.map((item) =>
      item.id === productId ? { ...item, quantity: item.quantity + 1 } : item
    );
    setCart(updatedCart);
  };



  const selectMall = (selectedMall) => {
    const newMall = selectedMall;
    setMall(newMall);
    loadClients(newMall);
  };

  const selectClient = (event) => {
    const newClient = event.target.value;
    console.log('clientSelected', newClient)
    setClient(newClient);
  };

  const calculateTotal = () => {
    return cart.reduce((total, item) => total + item.unitValue * item.quantity, 0);
  };

  useEffect(() => {
    const loadOrder = async () => {
      if (params.id) {
        const order = await getOrder(params.id);
        loadClients([])
        setMall(order.mall)
        setClient(order.clientId)
        //console.log(order);
        setCart(JSON.parse(order.items))
        setOrder({
          clientId: order.clientId,
          shopId: 1,
          items: cart,
          clientName: order.clientName,
          premises: order.premises
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

      <div className="flex content-center items-center justify-around">
        <button type="button" style={{
          backgroundColor: mall === 'Unilago' ? '#A6C4F0' : '#F3F1F1',
        }}
          className=" bg-indigo-500 px-2 py-1 text-black rounded-md" onClick={() => selectMall('Unilago')}>Unilago</button>
        <div className="px-2" />
        <button type="button" style={{
          backgroundColor: mall === 'Alta Tecnología' ? '#A6C4F0' : '#F3F1F1',
        }}
          className="bg-indigo-500 px-2 py-1 text-black rounded-md" onClick={() => selectMall('Alta Tecnología')}>Alta Tecnología</button>
        <div className="px-2" />
        <button type="button" style={{
          backgroundColor: mall === 'Cliente Frecuente' ? '#A6C4F0' : '#F3F1F1',
        }}
          className="bg-indigo-500 px-2 py-1 text-black rounded-md" onClick={() => selectMall('Cliente Frecuente')}>Cliente Frecuente</button>
        <div className="px-2" />
        <select name="clientId" className="px-2 py-1 rounded-sm w-100%"
          onChange={selectClient}
        //value={values.clientId}
        >
          {params.id ? <option selected="selected" key={order.clientId} value={order.clientId}>{order.premises} - {order.clientName}</option> : <option key={1} value={1}> --- </option>}
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
          values.items = JSON.stringify(cart)
          //console.log('values', values);
          if (params.id) {
            delete values.clientName;
            delete values.premises;
            await updateOrder(params.id, values);
          } else {
            await createOrder(values);
          }
          navigate("/");
          setOrder({ order });
        }}
      >
        {({ handleChange, handleSubmit, values, isSubmitting }) => (
          <Form
            onSubmit={handleSubmit}
            className="bg-slate-300 rounded-md p-4 mx-auto mt-10">
            <div className="flex items-center py-1 justify-around ">
              <div>
                <p className="font-bold">Valor total: ${calculateTotal()}</p>
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="block bg-indigo-500 px-2 py-1 text-white w-20% rounded-md ml-auto"              >
                {isSubmitting ? "Creando Orden..." : "Crear Orden"}
              </button>
            </div>
            {cart.map((item) => (
              <div key={item.id} className="bg-stone-100 rounded-md m-2 flex font-bold">
                <p className="flex items-center px-2">{item.productName} - ({item.quantity})</p>
                <p className="sticky right-0 text-green-500 px-2 py-1 ml-auto">${item.unitValue}</p>

                <p className="">
                  <button className="px-2" type="button" onClick={() => handleRemoveFromCart(item.id)}><MinusCircleOutlined style={{
                    verticalAlign: 'middle'
                  }} /></button>
                  <button className="px-2" type="button" onClick={() => handleAddOneToCart(item.id)}><PlusCircleOutlined style={{
                    verticalAlign: 'middle'
                  }} /></button>
                </p>
              </div>
            ))}
          </Form>
        )
        }
      </Formik >
      <div>
        {products.map((product) => (
          <div className="bg-stone-100 rounded-md m-2 flex font-bold" key={product.id}>
            <p className="flex items-center px-2">{product.productName}</p>
            <p className="flex items-center sticky right-0 text-green-500 px-2 py-1 ml-auto">${product.unitValue}</p>
            <p className="">
              <button className="px-2" type="button" onClick={() => handleAddToCart(product)}><PlusCircleOutlined style={{
                verticalAlign: 'middle'
              }} /></button>
            </p>
          </div>
        ))}
      </div>
    </div >
  );
}

export default OrderForm;
