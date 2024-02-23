import React, { useEffect, useState } from "react";
import dayjs from "dayjs";
import DepositsCard from "../components/DepositsCard";
import { useDeposits } from "../context/DepositsProvider";
import { DatePicker } from "antd";
import SearchBar from "../components/SearchBar";
function DepositsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const { deposits, getDepositsByDate } = useDeposits();
  const dateFormat = 'YYYY-MM-DD';
  const fechaActual = dayjs().format('YYYY-MM-DD');

  const onDatePickerChange = async (date, dateString) => {
    setLoading(true);
    try {
      await (dateString ? getDepositsByDate(dateString) : getDepositsByDate(fechaActual));
      console.log(dateString)
    } finally {
      setLoading(false);
    }
  };

  const filteredDeposits = deposits.filter((deposit) =>
    deposit.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    deposit.premises.toLowerCase().includes(searchTerm.toLowerCase()) ||
    deposit.mall.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

    if (deposits.length === 0) {
      return <h1>No hay órdenes para el día seleccionado</h1>;
    }

    return filteredDeposits.map((deposit) => <DepositsCard order={deposit} key={deposit.id + deposit.depositCreatedAt} />);
  }

  return (
    <div className="bg-slate-200 h-dvh rounded-md">
      <div className="flex py-2">
        <h4 className="text-xl text-black font-bold text-center">Depositos de este dia ({deposits.length}) </h4>
        <div className="ml-auto">
          <DatePicker onChange={onDatePickerChange} defaultValue={dayjs(fechaActual, dateFormat)} format={dateFormat} />
        </div>
      </div>
      <SearchBar onSearch={setSearchTerm} />
      <div className="bg-white-500 rounded-md grid">{renderMain()}</div>
    </div>
  );
}

export default DepositsPage;
