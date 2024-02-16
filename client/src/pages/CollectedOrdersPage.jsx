import React, { useEffect, useState } from "react";
import dayjs from "dayjs";
import OrderCollectCard from "../components/OrderCollectCard";
import { useOrders } from "../context/OrderProvider";
import { DatePicker } from "antd";

function CollectedOrdersPage() {
  const [loading, setLoading] = useState(false);
  const { orders, loadCollectedOrders } = useOrders();
  const dateFormat = 'YYYY-MM-DD';
  const fechaActual = dayjs().format('YYYY-MM-DD');
  console.log('collected orders')

  const onDatePickerChange = async (date, dateString) => {
    setLoading(true);
    try {
      await (dateString ? loadCollectedOrders(dateString) : loadCollectedOrders(fechaActual));
      console.log(dateString)
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

    return orders.map((order) => <OrderCollectCard order={order} key={order.id} />);
  }

  function calcularTotalesCollectedBy(orders) {
    let totalUnilago = 0;
    let totalAltaTec = 0;

    orders.forEach(order => {
      const subtotal = JSON.parse(order.items).reduce((total, item) => total + item.unitValue * item.quantity, 0);
      if (order.collectedBy === "Unilago") {
        totalUnilago += subtotal;
      } else if (order.collectedBy === "Alta Tecnología") {
        totalAltaTec += subtotal;
      }
    });

    return { totalUnilago, totalAltaTec };
  }

  return (
    <div className="bg-slate-200 h-dvh rounded-md">
      <div className="flex py-2">
        <h4 className="text-xl text-black font-bold text-center">Ordenes cobradas ({orders.length}) </h4>
        <div className="ml-auto">
          <DatePicker onChange={onDatePickerChange} defaultValue={dayjs(fechaActual, dateFormat)} format={dateFormat} />
        </div>
      </div>
      {orders.length !== 0 ? (
        <div>
          Total cobrado en Unilago: ${calcularTotalesCollectedBy(orders).totalUnilago} AltaTec: ${calcularTotalesCollectedBy(orders).totalAltaTec}
        </div>
      ) : null}
      <div className="bg-white-500 rounded-md grid">{renderMain()}</div>
    </div>
  );
}

export default CollectedOrdersPage;
