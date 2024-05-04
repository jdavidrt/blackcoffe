import React, { useEffect, useState } from "react";
import OrderDeliveredCard from "../components/OrderDeliveredCard";
import { useOrders } from "../context/OrderProvider";
import { useParams, useNavigate } from "react-router-dom";
import SearchBar from "../components/SearchBar";
import { DatePicker } from "antd";
import dayjs from "dayjs";


function DeliveredOrdersPage() {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState(''); // Nuevo estado para el tipo de filtro
    const params = useParams();
    const [loading, setLoading] = useState(false);
    const { orders, loadDeliveredOrders } = useOrders();

    const dateFormat = 'YYYY-MM-DD';
    const fechaActual = dayjs().format('YYYY-MM-DD');

    const onDatePickerChange = async (date, dateString) => {
        setLoading(true);
        try {
            await (dateString ? loadDeliveredOrders(dateString) : loadDeliveredOrders(fechaActual));
            console.log(dateString)
        } finally {
            setLoading(false);
        }
    };

    const loadOrders = async () => {
        setLoading(true);
        try {
            await loadDeliveredOrders(fechaActual);
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
            return <h1>No hay pedidos entregados de esa fecha</h1>;
        }
        return filteredOrders.map((order) => <OrderDeliveredCard order={order} key={order.id} />);
    }

    return (
        <div className="bg-slate-200 h-dvh rounded-md">
            <div className="flex py-2">
                <h4 className="text-xl text-black font-bold text-center">Pedidos  entregados: ({filteredOrders.length})</h4>
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
            <div className="bg-orange-400 rounded-md grid">{renderMain()}</div>
        </div>
    );
}

export default DeliveredOrdersPage;
