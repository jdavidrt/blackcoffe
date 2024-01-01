import { useEffect } from "react";
import dayjs from "dayjs";
import OrderCard from "../components/OrderCard";
import { useOrders } from "../context/OrderProvider";
import { DatePicker } from "antd";

function OrdersPage() {

  const { orders, loadOrders } = useOrders();
  const dateFormat = 'YYYY-MM-DD';
  const fechaActual = dayjs().format('YYYY-MM-DD');
  const onDatePickerChange = (date, dateString) => {
    dateString ? loadOrders(dateString) : loadOrders(fechaActual)
  };
  useEffect(() => {
    onDatePickerChange()
    renderMain()
  }, []);

  function renderMain() {
    if (orders.length === 0) return <h1>No hay ordenes para el dia seleccionado</h1>;
    return orders.map((order) => <OrderCard order={order} key={order.id} />);
  }

  return (
    <div className="bg-slate-200 h-dvh rounded-md">
      <div className="flex py-2"><h4 className="text-xl text-black  font-bold text-center">Cuenta de cobro ({orders.length}) </h4>
        <div className="ml-auto"> <DatePicker onChange={onDatePickerChange} defaultValue={dayjs(fechaActual, dateFormat)} format={dateFormat} />
        </div></div>
      <div className="bg-yellow-500  rounded-md grid">{renderMain()}</div>
    </div>
  );
}

export default OrdersPage;
