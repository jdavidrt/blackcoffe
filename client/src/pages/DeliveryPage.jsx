import React, { useEffect, useState } from "react";
import OrderDeliveryCard from "../components/OrderDeliveryCard";
import { useOrders } from "../context/OrderProvider";
import { useParams, useNavigate } from "react-router-dom";
import SearchBar from "../components/SearchBar";
function DeliveryOrdersPage() {
    const [searchTerm, setSearchTerm] = useState('');
    const params = useParams();
    const [loading, setLoading] = useState(false);
    const { orders, loadUnDeliveredOrders } = useOrders();

    const loadOrders = async () => {
        setLoading(true);
        try {
            await loadUnDeliveredOrders();
        } finally {
            setLoading(false);
        }
    };

    const filteredOrders = orders.filter((order) =>
        order.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.premises.toLowerCase().includes(searchTerm.toLowerCase())
    );

    useEffect(() => {
        loadOrders(params.mall);
    }, [params.mall]);

    function renderMain() {
        if (loading) {
            return (
                <div className="flex items-center justify-center h-screen bg-opacity-50 bg-gray-500">
                    <div className="text-white text-2xl">Cargando...</div>
                </div>
            );
        }

        if (orders.length === 0) {
            return <h1>No hay órdenes sin entregar</h1>;
        }

        return filteredOrders.map((order) => <OrderDeliveryCard order={order} key={order.id} />);
    }

    return (
        <div className="bg-slate-200 h-dvh rounded-md">
            <div className="flex py-2">
                <h4 className="text-xl text-black font-bold text-center">Pedidos sin entregar: ({orders.length})</h4>
                <div className="ml-auto">
                </div>
            </div>
            <SearchBar onSearch={setSearchTerm} />
            <div className="bg-orange-400 rounded-md grid">{renderMain()}</div>
        </div>
    );
}

export default DeliveryOrdersPage;
