import React, { useEffect, useState } from "react";
import dayjs from "dayjs";
import OrderCollectCard from "../components/OrderCollectCard";
import { useOrders } from "../context/OrderProvider";
import { DatePicker } from "antd";

function CollectOrdersPage() {
  const [loading, setLoading] = useState(false);
  const { orders, loadOrders, loadUnPaidOrders } = useOrders();
  const [mall, setMall] = useState("Unilago");
  const selectMall = (selectedMall) => {
    const newMall = selectedMall;
    setMall(newMall);
    loadUnPaidOrders(newMall);
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
      <div className="bg-green-500 rounded-md grid">{renderMain()}</div>
    </div>
  );
}

export default CollectOrdersPage;
