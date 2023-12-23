import { useorders } from "../context/OrderProvider";
import { useNavigate } from "react-router-dom";

function orderCard({ order }) {
  const { deleteorder, toggleorderDone } = useorders();
  const navigate = useNavigate();

  const handleDone = async () => {
    await toggleorderDone(order.id);
  };

  return (
    <div className="bg-zinc-700 text-white rounded-md p-4">
      <header className="flex justify-between">
        <h2 className="text-sm font-bold">{order.title}</h2>
        <span>{order.done == 1 ? "️✅️" : "❌"}</span>
      </header>
      <p className="text-xs">{order.description}</p>
      <span>{order.createAt}</span>
      <div className="flex gap-x-1">
        <button
          className="bg-slate-300 px-2 py-1 text-black"
          onClick={() => deleteorder(order.id)}
        >
          Delete
        </button>
        <button
          className="bg-slate-300 px-2 py-1 text-black"
          onClick={() => navigate(`/edit/${order.id}`)}
        >
          Edit
        </button>
        <button
          className="bg-slate-300 px-2 py-1 text-black"
          onClick={() => handleDone(order.done)}
        >
          Toggle order
        </button>
      </div>
    </div>
  );
}

export default orderCard;
