import React, { useEffect, useState } from "react";
import dayjs from "dayjs";
import OrderCard from "../components/OrderCard";
import { useOrders } from "../context/OrderProvider";
import { DatePicker } from "antd";

function OrdersPage() {
  const [loading, setLoading] = useState(false);
  const { orders, loadOrders } = useOrders();
  const dateFormat = 'YYYY-MM-DD';
  const fechaActual = dayjs().format('YYYY-MM-DD');

  const onDatePickerChange = async (dateString) => {
    setLoading(true);
    try {
      await loadOrders(dateString || fechaActual);
    } finally {
      setLoading(false);
    }
  };

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

    return orders.map((order) => <OrderCard order={order} key={order.id} />);
  }

  return (
    <div className="bg-slate-200 h-dvh rounded-md">
      <div className="flex py-2">
        <h4 className="text-xl text-black font-bold text-center">Órdenes por cobrar ({orders.length}) </h4>
        <div className="ml-auto">
          <DatePicker onChange={onDatePickerChange} defaultValue={dayjs(fechaActual, dateFormat)} format={dateFormat} />
        </div>
      </div>
      <div className="bg-yellow-500 rounded-md grid">{renderMain()}</div>
    </div>
  );
}

export default OrdersPage;
