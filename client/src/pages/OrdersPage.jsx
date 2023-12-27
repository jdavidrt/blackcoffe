import { useEffect } from "react";
import OrderCard from "../components/OrderCard";
import { useOrders } from "../context/OrderProvider";

function OrdersPage() {
  const { orders, loadOrders } = useOrders();

  useEffect(() => {
    loadOrders();
  }, []);

  function renderMain() {
    if (orders.length === 0) return <h1>No orders yet</h1>;
    return orders.map((order) => <OrderCard order={order} key={order.id} />);
  }

  return (
    <div>
      <h2 className="text-2xl text-black  font-bold text-center">Cuenta de cobro {orders.length}</h2>
      <div className="grid grid-cols-3 gap-2">{renderMain()}</div>
    </div>
  );
}

export default OrdersPage;
