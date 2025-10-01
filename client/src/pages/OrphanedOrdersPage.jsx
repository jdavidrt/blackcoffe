import React, { useEffect, useState } from "react";
import { useOrders } from "../context/OrderProvider";
import { useNavigate } from "react-router-dom";
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { calculateOrderTotal } from '../utils/orderUtils';
import SearchBar from "../components/SearchBar";

function OrphanedOrdersPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const { orders, loadOrphanedOrders, deleteOrder } = useOrders();
  const navigate = useNavigate();

  const loadOrders = async () => {
    setLoading(true);
    try {
      await loadOrphanedOrders();
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = orders.filter((order) =>
    order.id.toString().includes(searchTerm)
  );

  useEffect(() => {
    loadOrders();
  }, []);

  const handleDelete = async (id) => {
    if (window.confirm('¿Está seguro de eliminar esta orden sin cliente asociado?')) {
      await deleteOrder(id);
    }
  };

  function renderMain() {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-screen bg-opacity-50 bg-gray-500">
          <div className="text-white text-2xl">Cargando...</div>
        </div>
      );
    }

    if (orders.length === 0) {
      return (
        <div className="text-center p-8">
          <h1 className="text-xl text-gray-600">
            No hay órdenes sin cliente asociado
          </h1>
        </div>
      );
    }

    return filteredOrders.map((order) => (
      <div key={order.id} className="flex bg-red-100 text-black rounded-md m-2 border-2 border-red-300">
        <div className="p-2 flex-1">
          <p className="font-bold text-red-700">⚠️ Orden sin cliente (Cliente ID: {order.clientId})</p>
          <p className="text-sm text-gray-600">Orden #{order.id} - Creada: {order.createdAt}</p>
        </div>
        <div className="flex p-2 items-center gap-2">
          <b><p className="text-green-500 px-2">${calculateOrderTotal(order)}</p></b>
          <button
            type="button"
            className="flex bg-blue-400 hover:bg-blue-500 px-3 py-2 text-white rounded"
            onClick={() => navigate(`/editarOrden/${order.id}`)}
          >
            <EditOutlined />
          </button>
          <button
            type="button"
            className="flex bg-red-500 hover:bg-red-600 px-3 py-2 text-white rounded"
            onClick={() => handleDelete(order.id)}
          >
            <DeleteOutlined />
          </button>
        </div>
      </div>
    ));
  }

  return (
    <div className="bg-slate-200 h-dvh rounded-md">
      <div className="flex py-2">
        <h4 className="text-xl text-black font-bold text-center">
          Órdenes sin Cliente Asociado ({orders.length})
        </h4>
      </div>
      <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-4" role="alert">
        <p className="font-bold">Advertencia</p>
        <p>Estas órdenes están asociadas a clientes que fueron eliminados del sistema. Puede editarlas para asignar un nuevo cliente o eliminarlas.</p>
      </div>
      <SearchBar onSearch={setSearchTerm} />
      <div className="bg-slate-300 rounded-md grid">{renderMain()}</div>
    </div>
  );
}

export default OrphanedOrdersPage;
