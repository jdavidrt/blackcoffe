import { Form, Formik } from "formik";
import { useOrders } from "../context/OrderProvider";
import { useClients } from "../context/ClientProvider";
import { useProducts } from "../context/ProductProvider";
import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { PlusCircleOutlined, MinusCircleOutlined } from "@ant-design/icons";
import { Select } from "antd"
import SearchBar from "../components/SearchBar";
import dayjs from "dayjs";
import { safeJSONParse } from '../utils/jsonUtils';
import { sortProductsByDateDesc } from '../utils/orderUtils';
import { createCartSnapshot, validateSafeMerge } from '../utils/orderValidation';
import CoffeePouringAnimation from '../components/CoffeePouringAnimation';
import ProgressiveProductList from '../components/ProgressiveProductList';

function OrderForm() {
  const { unPaidOrder, createOrder, getOrder, updateOrder, getUnPaidOrdersbyClient } = useOrders();
  const { products, loadProducts, } = useProducts();
  const { clients, loadClients } = useClients()
  const [refresh, setRefresh] = useState(true);
  const [client, setClient] = useState([]);
  const [cart, setCart] = useState([]);
  const [clientChanged, setClientChanged] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [mall, setMall] = useState("Alta Tecnología");
  const [order, setOrder] = useState({
    clientId: "",
    shopId: "1",
    items: ""
  });
  const submittingRef = useRef(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const params = useParams();
  const navigate = useNavigate();
  const dateFormat = 'YYYY-MM-DD';
  const fechaActual = dayjs().format('YYYY-MM-DD');
  const fechaProducto = dayjs().format('HH:mm DD/MM/YY');
  const filteredProducts = products.filter((product) =>
    product.productName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (location.pathname.includes('nuevaOrden') && refresh) {
    setRefresh(false);
  }

  const handleAddToCart = (product) => {
    const existingProduct = cart.find((item) => item.id === product.id);

    if (existingProduct) {
      const updatedCart = cart.map((item) =>
        item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
      );
      setCart(updatedCart);
    } else {
      setCart([...cart, { ...product, quantity: 1, delivered: false, deliveredAt: "" }]);
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

  const selectClient = async (value) => {
    const newClient = value;
    await getUnPaidOrdersbyClient(value);
    setClientChanged(true)
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
        setCart(safeJSONParse(order.items, []))
        setOrder({
          clientId: order.clientId,
          shopId: 1,
          items: cart,
          clientName: order.clientName,
          premises: order.premises
        });
      } else {
        setMall("Alta Tecnología");
        loadClients("Alta Tecnología");
        setClient([]);
        setCart([]);
        setOrder({
          clientId: "",
          shopId: "1",
          items: ""
        });
        setClientChanged(false);
      }
    };
    loadOrder();
    loadProducts();
  }, [params.id]);

  const handleSubmitWithLogging = async (values, actions) => {
    console.log('[OrderForm] Submitting order with values:', values);
    console.log('[OrderForm] Current cart state:', cart);

    try {
      if (params.id) {
        console.log('[OrderForm] Updating existing order with ID:', params.id);
      } else {
        console.log('[OrderForm] Creating new order for user ID:', client);
      }

      await onSubmit(values, actions);
      console.log('[OrderForm] Order submission successful.');
    } catch (error) {
      console.error('[OrderForm] Error during order submission:', error);
    }
  };

  return (
    <div>
      {loadingMessage && (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-2xl p-8 max-w-sm mx-4">
            <div className="flex flex-col items-center">
              <CoffeePouringAnimation />
              <h2 className="text-xl font-bold text-gray-800 text-center">
                {loadingMessage}
              </h2>
              <p className="text-sm text-gray-600 mt-2 text-center">
                Por favor espere...
              </p>
            </div>
          </div>
        </div>
      )}
      <h1 className="text-xl font-bold uppercase text-center">
        {params.id ? "Editar Orden" : "Nueva Orden"}
      </h1>

      <div className="flex content-center items-center justify-around">
        <button type="button" style={{
          backgroundColor: mall === 'Unilago' ? '#A6C4F0' : '#F3F1F1',
        }}
          className=" bg-indigo-500 px-2 py-1 text-black rounded-md" onClick={() => selectMall('Unilago')}>Unilago</button>
        <button type="button" style={{
          backgroundColor: mall === 'Alta Tecnología' ? '#A6C4F0' : '#F3F1F1',
        }}
          className="bg-indigo-500 px-2 py-1 text-black rounded-md" onClick={() => selectMall('Alta Tecnología')}>Alta Tecnología</button>
        <button type="button" style={{
          backgroundColor: mall === 'Otros' ? '#A6C4F0' : '#F3F1F1',
        }}
          className="bg-indigo-500 px-2 py-1 text-black rounded-md" onClick={() => selectMall('Otros')}>Otros</button>
        <button type="button" style={{
          backgroundColor: mall === 'Cliente Frecuente' ? '#A6C4F0' : '#F3F1F1',
        }}
          className="bg-indigo-500 px-2 py-1 text-black rounded-md" onClick={() => selectMall('Cliente Frecuente')}>C.F.</button>
        <div className="px-2" />
        <div><br /></div>
        {params.id && !clientChanged ? <Select disabled value={order.premises + ' - ' + order.clientName} onChange={selectClient} showSearch optionFilterProp="children" placeholder="Seleccionar cliente" name="clientId" className="px-2 py-1 rounded-sm w-100%">
          {params.id ? <Select.Option defaultValue={order.premises + ' - ' + order.clientName} selected="selected" title={order.clientId} label={order.clientId} value={order.clientId}>{order.premises} - {order.clientName}</Select.Option> : <Select.Option value={1}> </Select.Option>}
          {clients.map((client) => (
            <Select.Option title={client.id} value={client.id}>
              {client.premises} - {client.clientName}
            </Select.Option>
          ))}
        </Select> :
          <Select onChange={selectClient} showSearch optionFilterProp="children" placeholder="Seleccionar cliente" name="clientId" className="px-2 py-1 rounded-sm w-100%">
            {params.id ? <Select.Option selected="selected" title={order.clientId} label={order.clientId} value={order.clientId}>{order.premises} - {order.clientName}</Select.Option> : <Select.Option value={1}> </Select.Option>}
            {clients.map((client) => (
              <Select.Option title={client.id} value={client.id}>
                {client.premises} - {client.clientName}
              </Select.Option>
            ))}
          </Select>
        }
      </div>
      <div className="py-2" />

      <Formik
        key={params.id || 'new'}
        initialValues={order}
        enableReinitialize={true}
        onSubmit={handleSubmitWithLogging}
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
                className="block bg-indigo-500 px-2 py-1 text-white w-20% rounded-md ml-auto">
                {params.id && isSubmitting ? "Modificando Orden..." : params.id ? "Modificar Orden" : isSubmitting ? "Creando Orden..." : "Crear Orden"}
              </button>
            </div>
            <ProgressiveProductList
              products={sortProductsByDateDesc(cart)}
              renderProduct={(item) => (
                <div key={item.id} className="bg-stone-100 rounded-md m-2 flex font-bold">
                  <p className="flex items-center px-2">{item.productName} - ({item.quantity})</p>
                  <p className="p-2 text-sm text-gray-700 flex items-center justify-center font-bold h-content">
                    {item.id.slice(-14)}
                  </p>
                  <p className="sticky right-0 text-green-500 px-2 py-1 ml-auto">${item.unitValue * item.quantity}</p>

                  <p className="">
                    <button className="px-2" type="button" onClick={() => handleRemoveFromCart(item.id)}><MinusCircleOutlined style={{
                      verticalAlign: 'middle'
                    }} /></button>
                    <button className="px-2" type="button" onClick={() => handleAddOneToCart(item.id)}><PlusCircleOutlined style={{
                      verticalAlign: 'middle'
                    }} /></button>
                  </p>
                </div>
              )}
            />
          </Form>
        )
        }
      </Formik >
      <div>
        <SearchBar onSearch={setSearchTerm} />
        {filteredProducts.map((product) => (
          <div className="bg-stone-100 rounded-md m-2 flex font-bold" key={(product.id)}>
            <p className="flex items-center px-2">{product.productName}</p>
            <p className="flex items-center sticky right-0 text-green-500 px-2 py-1 ml-auto">${product.unitValue}</p>
            <p className="">
              <button className="px-2" type="button" onClick={() => handleAddToCart({ ...product, id: product.id + ' ' + fechaProducto })}
              ><PlusCircleOutlined style={{
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
