import React, { useEffect, useState } from "react";
import dayjs from "dayjs";
import OrderCollectCard from "../components/OrderCollectCard";
import { useOrders } from "../context/OrderProvider";
import { DatePicker } from "antd";
import { useParams, useNavigate } from "react-router-dom";
import SearchBar from "../components/SearchBar";
import CoffeePouringAnimation from "../components/CoffeePouringAnimation";
import { canCollectMall, getDefaultCollectMall } from "../utils/permissions";
function CollectOrdersPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const params = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const { orders, loadUnPaidOrders } = useOrders();

  const loadOrders = async (mall) => {
    setLoading(true);
    try {
      await loadUnPaidOrders(mall);
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = orders.filter((order) =>
    order.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.premises.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    // Restricted users can't reach a mall outside their allowlist by typing the URL
    if (!canCollectMall(params.mall)) {
      const fallbackMall = getDefaultCollectMall();
      navigate(fallbackMall ? `/cobrarOrdenes/${fallbackMall}` : "/", { replace: true });
      return;
    }
    loadOrders(params.mall);
  }, [params.mall]);

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
      return <h1>No hay órdenes por cobrar para el centro comercial seleccionado</h1>;
    }

    return filteredOrders.map((order) => <OrderCollectCard order={order} key={order.id} />);
  }

  return (
    <div className="bg-slate-200 h-dvh rounded-md">
      <div className="flex py-2">
        <h4 className="text-xl text-black font-bold text-center">Cuenta de cobro ({orders.length}) - {params.mall} </h4>
        <div className="ml-auto">
        </div>
      </div>
      <SearchBar onSearch={setSearchTerm} />
      <div className="bg-green-500 rounded-md grid">{renderMain()}</div>
    </div>
  );
}

export default CollectOrdersPage;
