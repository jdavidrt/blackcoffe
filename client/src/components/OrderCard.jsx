import { useOrders } from "../context/OrderProvider";
import { useNavigate } from "react-router-dom";

function orderCard({ order }) {
  const { deleteOrder, toggleorderDone } = useOrders();
  const navigate = useNavigate();

  return (
    <div className="bg-zinc-700 text-white rounded-md p-4">
      <header className="flex justify-between">
        <h2 className="text-sm font-bold">{order.paymentMethod}</h2>
        <span>{order.done == 1 ? "️✅️" : "❌"}</span>
      </header>
      <p className="text-xs">{order.createdAt}</p>
      <span>{order.createAt}</span>
      <div className="flex gap-x-1">
        <button
          className="bg-slate-300 px-2 py-1 text-black"
          onClick={() => deleteOrder(order.id)}
        >
          Delete
        </button>
        <button
          className="bg-slate-300 px-2 py-1 text-black"
          onClick={() => navigate(`/editOrder/${order.id}`)}
        >
          Edit
        </button>
      </div>
    </div>
  );
}

export default orderCard;
