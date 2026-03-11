import React, { useEffect, useState } from "react";
import dayjs from "dayjs";
import OrderCard from "../components/OrderCard";
import { useOrders } from "../context/OrderProvider";
import { DatePicker } from "antd";
import SearchBar from "../components/SearchBar";
import CoffeePouringAnimation from "../components/CoffeePouringAnimation";

function OrdersPage() {
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');
  const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const [clave, setClave] = useState('');
  const [mostrarContenido, setMostrarContenido] = useState(isLocalDev);
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
    (order.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.premises.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (filterType === '' || order.mall === filterType)
  );

  useEffect(() => {
    if (mostrarContenido) {
      loadOrdersS(); // Iniciar carga al montar el componente solo si se muestra el contenido
    }
  }, [mostrarContenido]);

  // Función para manejar el cambio en el input de la clave
  const handleChangeClave = event => {
    setClave(event.target.value);
  };

  // Función para manejar el envío del formulario de la clave
  const handleSubmit = event => {
    event.preventDefault();
    // Verificar si la clave ingresada es correcta
    if (clave === '0114') { // Reemplaza 'tuclave' con la clave correcta
      setMostrarContenido(true);
    } else {
      alert('Clave incorrecta. Por favor, inténtalo de nuevo.');
      setClave('');
    }
  };

  // Renderizar contenido solo si la clave es correcta y se debe mostrar
  if (!mostrarContenido) {
    return (
      <form onSubmit={handleSubmit}>
        <label>
          Ingresa la clave:
          <input type="password" value={clave} onChange={handleChangeClave} />
        </label>
        <button type="submit">Enviar</button>
      </form>
    );
  }

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
      return <h1>No hay órdenes nuevas</h1>;
    }

    return filteredOrders.map((order) => <OrderCard order={order} key={order.id} />);
  }

  return (
    <div className="bg-slate-200 h-dvh rounded-md">
      <div className="flex py-2">
        <h4 className="text-xl text-black font-bold text-center">Ordenes activas ({filteredOrders.length}) </h4>
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
        </div>
      </div>
      <SearchBar onSearch={setSearchTerm} />
      <div className="bg-yellow-500 rounded-md grid">{renderMain()}</div>
    </div>
  );
}

export default OrdersPage;
