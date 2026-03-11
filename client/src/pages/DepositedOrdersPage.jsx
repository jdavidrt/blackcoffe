import React, { useEffect, useState } from "react";
import dayjs from "dayjs";
import OrderCollectCard from "../components/OrderCollectCard";
import { useOrders } from "../context/OrderProvider";
import { DatePicker } from "antd";
import SearchBar from "../components/SearchBar";
import CoffeePouringAnimation from "../components/CoffeePouringAnimation";

function DepositedOrdersPage() {
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');
  const { orders, loadDepositedOrderByDate } = useOrders();
  const dateFormat = 'YYYY-MM-DD';
  const fechaActual = dayjs().format('YYYY-MM-DD');

  function sumarDepositos(arregloObjetos) {
    const depositosSumados = {};

    arregloObjetos.forEach(objeto => {
      // Skip deleted deposits
      if (objeto.isDeleted === 1) {
        return;
      }

      const id = objeto.id;
      const depositValue = objeto.depositValue;

      if (depositosSumados.hasOwnProperty(id)) {
        // If order already exists, sum the depositValue
        depositosSumados[id].depositValue += depositValue;
        // Always keep the most recent 'paid' status (orders.paid should be consistent for same order)
        // Use the current objeto's paid status if it exists
        if (objeto.paid !== undefined) {
          depositosSumados[id].paid = objeto.paid;
        }
      } else {
        // First time seeing this order, store all fields
        depositosSumados[id] = { ...objeto };
      }
    });

    const resultados = Object.values(depositosSumados);

    return resultados;
  }

  const onDatePickerChange = async (date, dateString) => {
    setLoading(true);
    try {
      await (dateString ? loadDepositedOrderByDate(dateString) : loadDepositedOrderByDate(fechaActual));
    } finally {
      setLoading(false);
    }
  };

  const loadOrdersS = async (value, dateString) => {
    setLoading(true);
    try {
      await loadDepositedOrderByDate(fechaActual);
    } finally {

      setLoading(false);
    }
  };

  function sumarDepositosPorMall(arregloObjetos) {
    const depositosPorMall = {
      "Unilago": 0,
      "Alta Tecnología": 0,
      "Cliente Frecuente": 0,
      "Otros": 0
    };

    arregloObjetos.forEach(objeto => {
      // Skip deleted deposits
      if (objeto.isDeleted === 1) {
        return;
      }

      const mall = objeto.mall;
      const depositValue = objeto.depositValue;

      if (depositosPorMall.hasOwnProperty(mall)) {
        depositosPorMall[mall] += depositValue;
      } else {
        depositosPorMall["Otros"] += depositValue; // Si el mall no está en la lista, se suma en "Otros"
      }
    });
    return depositosPorMall;
  }



  useEffect(() => {
    sumarDepositosPorMall(orders)
    loadOrdersS(); // Iniciar carga al montar el componente
  }, []);

  const filteredOrders = orders.filter((order) =>
    (order.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.premises.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (filterType === '' || order.mall === filterType)
  );

  // Aggregate deposits by order ID for filtered orders
  const aggregatedFilteredOrders = sumarDepositos(filteredOrders);

  // DEBUG: Check if paid field exists
  //console.log('First aggregated order:', aggregatedFilteredOrders[0]);
  //console.log('Paid values:', aggregatedFilteredOrders.map(o => ({ id: o.id, paid: o.paid, depositValue: o.depositValue })));

  function renderMain() {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-opacity-50 bg-gray-500">
          <CoffeePouringAnimation />
          <div className="text-white text-2xl">Cargando...</div>
        </div>
      );
    }

    if (orders.length === 0) {
      return <h1>No hay órdenes con cobros del día seleccionado</h1>;
    }

    return aggregatedFilteredOrders.map((order) => <OrderCollectCard order={order} key={order.id} />);
  }
  //console.log(aggregatedFilteredOrders)

  // Calculate totals from deposit values
  const depositTotals = sumarDepositosPorMall(orders);
  const totalGeneral = Object.values(depositTotals).reduce((sum, val) => sum + val, 0);

  return (
    <div className="bg-slate-200 h-dvh rounded-md overflow-y-auto">
      <div className="flex py-2 px-2">
        <h4 className="text-xl text-black font-bold text-center">Cobros del día ({filteredOrders.length} órdenes) </h4>
        <div className="ml-auto flex">
          <button
            type="button"
            style={{
              backgroundColor: filterType === 'Unilago' ? '#A6C4F0' : '#F3F1F1',
            }}
            className="bg-indigo-500 px-2 py-1 text-black rounded-md"
            onClick={() => setFilterType('Unilago')}
          >
            Unilago
          </button>
          <div className="px-2" />
          <button
            type="button"
            style={{
              backgroundColor: filterType === 'Alta Tecnología' ? '#A6C4F0' : '#F3F1F1',
            }}
            className="bg-indigo-500 px-2 py-1 text-black rounded-md"
            onClick={() => setFilterType('Alta Tecnología')}
          >
            Alta Tecnología
          </button>
          <div className="px-2" />
          <button
            type="button"
            style={{
              backgroundColor: filterType === 'Otros' ? '#A6C4F0' : '#F3F1F1',
            }}
            className="bg-indigo-500 px-2 py-1 text-black rounded-md"
            onClick={() => setFilterType('Otros')}
          >
            Otros
          </button>
          <div className="px-2" />
          <button
            type="button"
            style={{
              backgroundColor: filterType === 'Cliente Frecuente' ? '#A6C4F0' : '#F3F1F1',
            }}
            className="bg-indigo-500 px-2 py-1 text-black rounded-md"
            onClick={() => setFilterType('Cliente Frecuente')}
          >
            C.F.
          </button>
          <div className="ml-auto">
            <DatePicker onChange={onDatePickerChange} defaultValue={dayjs(fechaActual, dateFormat)} format={dateFormat} />
          </div>
        </div>
      </div>
      <SearchBar onSearch={setSearchTerm} />

      {orders.length !== 0 ? (
        <div className="mx-2">
          {/* Total Cobrado Section */}
          <div className="bg-white p-4 rounded-md shadow-md mb-3">
            <h3 className="text-lg font-bold mb-3 text-gray-700 border-b pb-2">💰 Total Cobrado</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex justify-between">
                <span>Unilago:</span>
                <span className="font-bold text-blue-700">${depositTotals["Unilago"].toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Alta Tecnología:</span>
                <span className="font-bold text-blue-700">${depositTotals["Alta Tecnología"].toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>C.F:</span>
                <span className="font-bold text-blue-700">${depositTotals['Cliente Frecuente'].toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Otros:</span>
                <span className="font-bold text-blue-700">${depositTotals["Otros"].toLocaleString()}</span>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t-2 border-gray-300">
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold text-gray-700">Total General:</span>
                <span className="text-2xl font-bold text-green-600">${totalGeneral.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      <div className="bg-yellow-500 rounded-md grid px-2">{renderMain()}</div>
    </div>
  );
}

export default DepositedOrdersPage;
