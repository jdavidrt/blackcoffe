import { useClients } from "../context/ClientProvider";
import { useNavigate } from "react-router-dom";
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';

function clientCard({ client }) {
  const { deleteClient, toggleclientDone } = useClients();
  const navigate = useNavigate();

  return (
    <div className="flex bg-stone-100 items-center stext-black rounded-md m-2">
      <span>{client.createAt}</span>
      <b><p className="p-2 flex items-center h-content">{client.premises} {client.clientName}</p> </b>
      <div className="p-2 ml-auto">
        <button
          className="bg-slate-300 px-2 mx-8 py-1 text-black"
          onClick={() => deleteClient(client.id)}
        >
          <DeleteOutlined />
        </button>
        <button
          className="bg-slate-300 px-2 py-1 text-black"
          onClick={() => navigate(`/editarCliente/${client.id}`)}
        >
          <EditOutlined />
        </button>
      </div>
    </div>
  );
}

export default clientCard;
