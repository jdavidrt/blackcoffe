import React, { useEffect, useState } from "react";
import dayjs from "dayjs";
import OrderCollectCard from "../components/OrderCollectCard";
import { useOrders } from "../context/OrderProvider";
import { DatePicker } from "antd";
import SearchBar from "../components/SearchBar";
function CollectOrdersPage() {
  const [searchTerm, setSearchTerm] = useState('');

  const [loading, setLoading] = useState(false);
  const { orders, loadOrders, loadUnPaidOrders } = useOrders();
  const dateFormat = 'YYYY-MM-DD';
  const fechaActual = dayjs().format('YYYY-MM-DD');
  const [mall, setMall] = useState("Unilago");
  const selectMall = (selectedMall) => {
    const newMall = selectedMall;
    setMall(newMall);
    loadUnPaidOrders(newMall);
  };

  const onDatePickerChange = async (date, dateString) => {
    setLoading(true);
    try {
      await (dateString ? loadOrders(dateString) : loadOrders(fechaActual));
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = orders.filter((order) =>
    order.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.premises.toLowerCase().includes(searchTerm.toLowerCase())
  );

  function mergeItemsByClientId(orders) {
    const mergedOrders = orders.reduce((acc, order) => {
      const existingOrder = acc.find((o) => o.clientId === order.clientId);

      if (existingOrder) {
        // Si ya existe una orden con el mismo clientId, se concatenan los items
        existingOrder.items = [...existingOrder.items, ...JSON.parse(order.items)];
      } else {
        // Si no existe una orden con el mismo clientId, se agrega la orden al resultado
        acc.push({
          clientId: order.clientId,
          clientName: order.clientName,
          collectedBy: order.collectedBy,
          createdAt: order.createdAt,
          id: order.id,
          items: JSON.parse(order.items),
          mall: order.mall,
          paid: order.paid,
          premises: order.premises,
        });
      }

      return acc;
    }, []);

    return mergedOrders;
  }

  console.log('merged', mergeItemsByClientId(orders));

  useEffect(() => {
    onDatePickerChange(); // Iniciar carga al montar el componente
  }, []);

  function renderMain() {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-screen bg-opacity-50 bg-gray-500">
          <div className="text-white text-2xl">Cargando...</div>
        </div>
      );
    }

    if (orders.length === 0) {
      return <h1>No hay órdenes para el día seleccionado</h1>;
    }

    return filteredOrders.map((order) => <OrderCollectCard order={order} key={order.id} />);
  }

  return (
    <div className="bg-slate-200 h-dvh rounded-md">
      <div className="flex py-2">
        <h4 className="text-xl text-black font-bold text-center">Cuenta de cobro ({orders.length}) </h4>
        <div className="ml-auto">
          <div>
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
                className="bg-indigo-500 px-2 py-1 text-black rounded-md" onClick={() => selectMall('Cliente Frecuente')}>C.F.</button>
              <div className="px-2" />
            </div>
          </div>
        </div>
      </div>
      <SearchBar onSearch={setSearchTerm} />
      <div className="bg-green-500 rounded-md grid">{renderMain()}</div>
    </div>
  );
}

export default CollectOrdersPage;
