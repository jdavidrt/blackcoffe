import React, { useEffect, useState } from "react";
import dayjs from "dayjs";
import OrderCollectCard from "../components/OrderCollectCard";
import { useOrders } from "../context/OrderProvider";
import { DatePicker } from "antd";
import SearchBar from "../components/SearchBar";

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
      const id = objeto.id;
      const depositValue = objeto.depositValue;

      if (depositosSumados.hasOwnProperty(id)) {
        depositosSumados[id].depositValue += depositValue;
      } else {
        depositosSumados[id] = { ...objeto };
      }
    });

    const resultados = Object.values(depositosSumados);

    return resultados;
  }

  const resultados = sumarDepositos(orders);
  console.log('resultados', resultados);


  const onDatePickerChange = async (date, dateString) => {
    setLoading(true);
    try {
      await (dateString ? loadDepositedOrderByDate(dateString) : loadDepositedOrderByDate(fechaActual));
      console.log('ordeeers', orders)
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
      const mall = objeto.mall;
      const depositValue = objeto.depositValue;

      if (depositosPorMall.hasOwnProperty(mall)) {
        depositosPorMall[mall] += depositValue;
      } else {
        depositosPorMall["Otros"] += depositValue; // Si el mall no está en la lista, se suma en "Otros"
      }
    });
    console.log('8depos', depositosPorMall)
    return depositosPorMall;
  }



  useEffect(() => {
    sumarDepositosPorMall(orders)
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
      return <h1>No hay órdenes con cobros del día seleccionado</h1>;
    }

    return sumarDepositos(orders).map((order) => <OrderCollectCard order={order} key={order.id} />);
  }

  return (
    <div className="bg-slate-200 h-dvh rounded-md">
      <div className="flex py-2">
        <h4 className="text-xl text-black font-bold text-center">Ordenes con cobros ({orders.length}) </h4>
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
        <div>
          Total cobrado en Unilago: ${sumarDepositosPorMall(orders)["Unilago"]} <br />AltaTec: ${sumarDepositosPorMall(orders)["Alta Tecnología"]} <br /> C.F: ${sumarDepositosPorMall(orders)['Cliente Frecuente']} <br /> Otros: ${sumarDepositosPorMall(orders)["Otros"]}
        </div>
      ) : null}
      <div className="bg-yellow-500 rounded-md grid">{renderMain()}</div>
    </div>
  );
}

export default DepositedOrdersPage;
