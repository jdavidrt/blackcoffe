import React, { useEffect, useState } from "react";
import dayjs from "dayjs";
import OrderCard from "../components/OrderCard";
import { useOrders } from "../context/OrderProvider";
import { DatePicker } from "antd";
import SearchBar from "../components/SearchBar";

function OrdersPage() {
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { orders, loadOrders } = useOrders();

  const loadOrdersS = async (value, dateString) => {
    setLoading(true);
    try {
      await loadOrders();
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = orders.filter((order) =>
    order.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.premises.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    loadOrdersS(); // Iniciar carga al montar el componente
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
      return <h1>No hay órdenes nuevas</h1>;
    }

    return filteredOrders.map((order) => <OrderCard order={order} key={order.id} />);
  }

  return (
    <div className="bg-slate-200 h-dvh rounded-md">
      <div className="flex py-2">
        <h4 className="text-xl text-black font-bold text-center">Ordenes activas ({filteredOrders.length}) </h4>
        <div className="ml-auto">
        </div>
      </div>
      <SearchBar onSearch={setSearchTerm} />
      <div className="bg-yellow-500 rounded-md grid">{renderMain()}</div>
    </div>
  );
}

export default OrdersPage;
