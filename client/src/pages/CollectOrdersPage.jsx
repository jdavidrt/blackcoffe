import React, { useEffect, useState } from "react";
import dayjs from "dayjs";
import OrderCollectCard from "../components/OrderCollectCard";
import { useOrders } from "../context/OrderProvider";
import { DatePicker } from "antd";
import SearchBar from "../components/SearchBar";
function CollectOrdersPage() {
  const [searchTerm, setSearchTerm] = useState('');

  const [loading, setLoading] = useState(false);
  const { orders, loadOrders } = useOrders();
  const dateFormat = 'YYYY-MM-DD';
  const fechaActual = dayjs().format('YYYY-MM-DD');

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
          <DatePicker onChange={onDatePickerChange} defaultValue={dayjs(fechaActual, dateFormat)} format={dateFormat} />
        </div>
      </div>
      <SearchBar onSearch={setSearchTerm} />
      <div className="bg-green-500 rounded-md grid">{renderMain()}</div>
    </div>
  );
}

export default CollectOrdersPage;
