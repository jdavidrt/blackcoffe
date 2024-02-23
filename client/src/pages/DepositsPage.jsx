import React, { useEffect, useState } from "react";
import dayjs from "dayjs";
import DepositsCard from "../components/DepositsCard";
import { DatePicker } from "antd";
import { useDeposits } from "../context/DepositsProvider";

function DepositsPage() {
  const [loading, setLoading] = useState(false);
  const { deposits, getDepositsByDate } = useDeposits();
  const [depositos, setDepositos] = useState([])
  const dateFormat = 'YYYY-MM-DD';
  const fechaActual = dayjs().format('YYYY-MM-DD');
  const [detallesVisibles, setDetallesVisibles] = useState([]);

  const agruparPorId = (datos) => {
    console.log('deposits sin procesar', datos)
    const resultados = [];

    datos.forEach(elemento => {
      const identificador = elemento.id;

      if (!resultados[identificador]) {
        resultados[identificador] = [];
      }
      resultados[identificador].push(elemento);
    });
    console.log('resul', resultados)
    return resultados;
  };

  const onDatePickerChange = async (date, dateString) => {
    setLoading(true);
    try {
      await (dateString ? getDepositsByDate(dateString) : getDepositsByDate(fechaActual));
      setDepositos(agruparPorId(deposits))
    } finally {
      //console.log(JSON.stringify(depositos))
      setLoading(false);
    }
  };

  const toggleDetalles = (id) => {
    setDetallesVisibles(prevState => ({
      ...prevState,
      [id]: !prevState[id]
    }));
  };

  useEffect(() => {
    onDatePickerChange(); // Iniciar carga al montar el componente
    console.log(JSON.stringify(depositos))
  }, []);

  function renderMain() {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-screen bg-opacity-50 bg-gray-500">
          <div className="text-white text-2xl">Cargando...</div>
        </div>
      );
    }

    if (depositos.length === 0) {
      return <h1>No hay abonos para el día seleccionado</h1>;
    }
    return deposits.map((deposit) => <DepositsCard order={deposit} key={deposit.id} />);
  }

  return (
    <div className="bg-slate-200 h-dvh rounded-md">
      <div className="flex py-2">
        <h4 className="text-xl text-black font-bold text-center">Abonos de este día ({deposits.length}) </h4>
        <div className="ml-auto">
          <DatePicker onChange={onDatePickerChange} defaultValue={dayjs(fechaActual, dateFormat)} format={dateFormat} />
        </div>
      </div>
      {deposits.length !== 0 ? (''
      ) : null}
      <div className="bg-white-500 rounded-md grid">{renderMain()}</div>
    </div>
  );
}

export default DepositsPage;
