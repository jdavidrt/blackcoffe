import { useEffect, useState } from "react";
import { useOrders } from "../context/OrderProvider";
import { useNavigate } from "react-router-dom";
import { getOrderItems } from "../utils/jsonUtils";
import { Modal, message } from "antd";
import { SearchOutlined, ReloadOutlined } from "@ant-design/icons";
import dayjs from "dayjs";

function AbandonedOrdersPage() {
  const { abandonedOrders, getAbandonedOrders, unmarkOrderAsAbandoned } = useOrders();
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredOrders, setFilteredOrders] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    getAbandonedOrders();
  }, []);

  useEffect(() => {
    if (abandonedOrders) {
      const filtered = abandonedOrders.filter(order => {
        const clientName = order.clientName?.toLowerCase() || '';
        const premises = order.premises?.toLowerCase() || '';
        const mall = order.mall?.toLowerCase() || '';
        const search = searchTerm.toLowerCase();

        return clientName.includes(search) ||
               premises.includes(search) ||
               mall.includes(search);
      });
      setFilteredOrders(filtered);
    }
  }, [searchTerm, abandonedOrders]);

  const calculateOrderTotal = (items) => {
    return items.reduce((total, item) => total + (item.unitValue * item.quantity), 0);
  };

  const handleReactivateOrder = (orderId, clientName) => {
    Modal.confirm({
      title: '¿Reactivar esta orden?',
      content: `¿Desea reactivar la orden de ${clientName}? La orden volverá a aparecer en "Cuentas por cobrar"`,
      okText: 'Reactivar',
      okType: 'primary',
      cancelText: 'Cancelar',
      okButtonProps: { style: { backgroundColor: '#1677ff', borderColor: '#1677ff', color: '#fff' } },
      onOk: async () => {
        try {
          await unmarkOrderAsAbandoned(orderId);
          message.success('Orden reactivada exitosamente');
          getAbandonedOrders(); // Refresh list
        } catch (error) {
          message.error('Error al reactivar la orden');
          console.error(error);
        }
      },
    });
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold text-center mb-4 text-red-600">
        🗑️ Órdenes Abandonadas
      </h1>

      {/* Search Bar */}
      <div className="mb-4">
        <div className="relative">
          <input
            type="text"
            placeholder="Buscar por cliente, local o mall..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
          />
          <SearchOutlined className="absolute left-3 top-3 text-gray-400" />
        </div>
      </div>

      {/* Statistics */}
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-red-600">
              {filteredOrders.length}
            </p>
            <p className="text-sm text-gray-600">Órdenes Abandonadas</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-red-600">
              ${filteredOrders.reduce((sum, order) => {
                const items = getOrderItems(order);
                return sum + calculateOrderTotal(items);
              }, 0).toLocaleString()}
            </p>
            <p className="text-sm text-gray-600">Valor Total Abandonado</p>
          </div>
        </div>
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p className="text-lg">No hay órdenes abandonadas</p>
          <p className="text-sm mt-2">Las órdenes marcadas como abandonadas aparecerán aquí</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => {
            const items = getOrderItems(order);
            const total = calculateOrderTotal(items);

            return (
              <div
                key={order.id}
                className="bg-white border-l-4 border-red-500 shadow-md rounded-lg p-4 hover:shadow-lg transition-shadow"
              >
                {/* Order Header */}
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-bold text-lg text-gray-800">
                      {order.premises} - {order.clientName}
                    </h3>
                    <p className="text-sm text-gray-600">{order.mall}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-red-600 text-lg">
                      ${total.toLocaleString()}
                    </p>
                    {order.deposit > 0 && (
                      <p className="text-sm text-orange-600">
                        Abonado: ${order.deposit.toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>

                {/* Order Items */}
                <div className="bg-gray-50 rounded-md p-2 mb-2">
                  {items.map((item, index) => (
                    <div key={index} className="text-sm text-gray-700">
                      • {item.productName} ({item.quantity}) - ${(item.unitValue * item.quantity).toLocaleString()}
                    </div>
                  ))}
                </div>

                {/* Abandonment Info */}
                <div className="bg-red-50 rounded-md p-2 mb-3">
                  <p className="text-xs text-red-700">
                    <strong>Abandonada:</strong> {dayjs(order.abandonedAt).format('DD/MM/YY HH:mm')}
                  </p>
                  {order.abandonedBy && (
                    <p className="text-xs text-red-700">
                      <strong>Por:</strong> {order.abandonedBy}
                    </p>
                  )}
                  {order.abandonReason && (
                    <p className="text-xs text-red-700">
                      <strong>Razón:</strong> {order.abandonReason}
                    </p>
                  )}
                  <p className="text-xs text-gray-600 mt-1">
                    <strong>Creada:</strong> {dayjs(order.createdAt).format('DD/MM/YY')}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => navigate(`/cobrarOrden/${order.id}`)}
                    className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    Ver Detalles
                  </button>
                  <button
                    onClick={() => handleReactivateOrder(order.id, order.clientName)}
                    className="flex-1 bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-1"
                  >
                    <ReloadOutlined /> Reactivar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default AbandonedOrdersPage;
