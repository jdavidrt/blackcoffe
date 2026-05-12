import React, { useEffect, useState } from "react";
import { useOrders } from "../context/OrderProvider";
import { useNavigate } from "react-router-dom";
import { DeleteOutlined, DownOutlined, UpOutlined } from '@ant-design/icons';
import { Modal } from 'antd';
import { calculateOrderTotal, getItemDisplayTime } from '../utils/orderUtils';
import { safeJSONParse } from '../utils/jsonUtils';
import SearchBar from "../components/SearchBar";
import ProgressiveProductList from '../components/ProgressiveProductList';
import CoffeePouringAnimation from "../components/CoffeePouringAnimation";

function OrphanedOrdersPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [expandedOrders, setExpandedOrders] = useState({});
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

  const filteredOrders = orders
    .filter((order) => order.id.toString().includes(searchTerm))
    .sort((a, b) => b.id - a.id);

  useEffect(() => {
    loadOrders();
  }, []);

  const handleDelete = (id) => {
    Modal.confirm({
      title: '¿Eliminar esta orden?',
      content: 'Esta orden sin cliente asociado será eliminada permanentemente.',
      okText: 'Eliminar',
      okType: 'danger',
      cancelText: 'Cancelar',
      onOk: async () => {
        try {
          await deleteOrder(id);
        } catch (error) {
          const orderId = error.response?.data?.orderId;
          if (error.response?.status === 400 && orderId) {
            Modal.error({
              title: 'Orden con abonos registrados',
              content: (
                <div>
                  <p>Esta orden tiene abonos registrados y no puede ser eliminada.</p>
                  <a
                    href={`/cobrarOrden/${orderId}`}
                    style={{ color: '#1677ff', textDecoration: 'underline', fontWeight: '600', display: 'inline-block', marginTop: '4px' }}
                  >
                    Ver abonos de la orden #{orderId}
                  </a>
                </div>
              ),
            });
          }
        }
      },
    });
  };

  const toggleExpand = (orderId) => {
    setExpandedOrders(prev => ({
      ...prev,
      [orderId]: !prev[orderId]
    }));
  };

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
      return (
        <div className="text-center p-8">
          <h1 className="text-xl text-gray-600">
            No hay órdenes sin cliente asociado
          </h1>
        </div>
      );
    }

    return filteredOrders.map((order) => {
      const items = safeJSONParse(order.items, []);
      const isExpanded = expandedOrders[order.id];

      return (
        <div key={order.id} className="bg-red-100 text-black rounded-md m-2 border-2 border-red-300">
          <div className="flex">
            <div className="p-2 flex-1">
              <p className="font-bold text-red-700">⚠️ Orden sin cliente (Cliente ID: {order.clientId})</p>
              <p className="text-sm text-gray-600">Orden #{order.id} - Creada: {order.createdAt}</p>
            </div>
            <div className="flex p-2 items-center gap-2">
              <b><p className="text-green-500 px-2">${calculateOrderTotal(order)}</p></b>
              <button
                type="button"
                className="flex bg-purple-500 hover:bg-purple-600 px-3 py-2 text-white rounded"
                onClick={() => toggleExpand(order.id)}
              >
                {isExpanded ? <UpOutlined /> : <DownOutlined />}
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

          {isExpanded && items.length > 0 && (
            <div className="px-2 pb-2">
              <ProgressiveProductList
                products={[...items].reverse()}
                renderProduct={(item) => (
                  <div key={item.id} className="bg-stone-100 rounded-md m-2 flex font-bold">
                    <p className="flex items-center px-2">{item.productName} - ({item.quantity})</p>
                    <p className="p-2 text-sm text-gray-700 flex items-center justify-center font-bold h-content">
                      {getItemDisplayTime(item.id)}
                    </p>
                    <p className="sticky right-0 text-green-500 px-2 py-1 ml-auto">${(item.quantity * item.unitValue)?.toLocaleString()}</p>
                  </div>
                )}
              />
            </div>
          )}
        </div>
      );
    });
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
