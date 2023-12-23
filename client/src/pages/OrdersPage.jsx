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
      <h1 className="text-5xl text-white font-bold text-center">Orders</h1>
      <div className="grid grid-cols-3 gap-2">{renderMain()}</div>
    </div>
  );
}

export default OrdersPage;
