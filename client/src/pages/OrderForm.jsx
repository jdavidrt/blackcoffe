import { Form, Formik } from "formik";
import { useOrders } from "../context/OrderProvider";
import { useClients } from "../context/ClientProvider";
import { useProducts } from "../context/ProductProvider";
import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { PlusCircleOutlined, MinusCircleOutlined } from "@ant-design/icons";
import { Select } from "antd"
import SearchBar from "../components/SearchBar";
import dayjs from "dayjs";

function OrderForm() {
  const { unPaidOrder, createOrder, getOrder, updateOrder, getUnPaidOrdersbyClient } = useOrders();
  const { products, loadProducts, } = useProducts();
  const { clients, loadClients } = useClients()
  const [client, setClient] = useState([]);
  const [cart, setCart] = useState([]);
  const [clientChanged, setClientChanged] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [mall, setMall] = useState("");
  const [order, setOrder] = useState({
    clientId: "",
    shopId: "1",
    items: ""
  });
  const params = useParams();
  const navigate = useNavigate();
  const dateFormat = 'YYYY-MM-DD';
  const fechaActual = dayjs().format('YYYY-MM-DD');
  const fechaProducto = dayjs().format('HH:mm DD/MM/YY');
  console.log(fechaProducto)
  const filteredProducts = products.filter((product) =>
    product.productName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddToCart = (product) => {
    console.log(product)
    const existingProduct = cart.find((item) => item.id === product.id);

    if (existingProduct) {
      const updatedCart = cart.map((item) =>
        item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
      );
      setCart(updatedCart);
    } else {
      setCart([...cart, { ...product, quantity: 1, delivered: false }]);
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
    //setCart([]);
    await getUnPaidOrdersbyClient(value);
    setClientChanged(true)
    setClient(newClient);
    //setCart(JSON.parse(unPaidOrder.items))
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

  console.log(cart)

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
        initialValues={order}
        enableReinitialize={true}
        onSubmit={async (values, actions) => {
          values.shopId = 1;
          values.clientId = client;
          getUnPaidOrdersbyClient(client);
          values.items = JSON.stringify(cart)
          //console.log('values', values);
          if (params.id) {
            delete values.clientName;
            delete values.premises;
            await updateOrder(params.id, values);
          } else if (unPaidOrder) {
            console.log('unpaid order on this client')
            const array1 = JSON.parse(values.items);
            const array2 = JSON.parse(unPaidOrder.items);
            const mergedJson = array1.concat(array2);
            const idMap = {};
            mergedJson.forEach((item) => {
              const { id, quantity } = item;
              if (idMap[id]) {
                // Si ya existe el ID en el mapa, sumar la cantidad
                idMap[id].quantity += quantity;
              } else {
                // Si no existe el ID en el mapa, agregar el elemento al mapa
                idMap[id] = { ...item };
              }
            });
            const resultArray = Object.values(idMap);
            console.log('merged items', resultArray)
            values.items = JSON.stringify(resultArray);
            setCart(JSON.parse(unPaidOrder.items))
            await updateOrder(unPaidOrder.id, values)
          } else {
            await createOrder(values);
          }
          navigate("/nuevaOrden");
          navigate(navigation.reload());
          if (client == [] || cart == []) {
            alert("Por favor selecciona un cliente y agrega propductos para crear la orden");
          } else {
            setOrder({ order });
          }
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
                className="block bg-indigo-500 px-2 py-1 text-white w-20% rounded-md ml-auto">
                {params.id && isSubmitting ? "Modificando Orden..." : params.id ? "Modificar Orden" : isSubmitting ? "Creando Orden..." : "Crear Orden"}
              </button>
            </div>
            {cart.map((item) => (
              <div key={item.id} className="bg-stone-100 rounded-md m-2 flex font-bold">
                <p className="flex items-center px-2">{item.productName} - ({item.quantity})</p>
                <p className="p-2 text-sm text-gray-700 flex items-center justify-center font-bold h-content">
                  {item.id.slice(-14)}
                </p>
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
