import { useClients } from "../context/ClientProvider";
import { useNavigate } from "react-router-dom";
import { EditOutlined, DeleteOutlined, UndoOutlined } from '@ant-design/icons';
import { Modal } from 'antd';

function clientCard({ client, deleted = false }) {
  const { deleteClient, restoreClient } = useClients();
  const navigate = useNavigate();

  const handleDelete = () => {
    Modal.confirm({
      title: `¿Eliminar a ${client.clientName}?`,
      content: `El cliente del local ${client.premises} quedará marcado como eliminado. Puede ser restaurado después.`,
      okText: 'Eliminar',
      okType: 'danger',
      cancelText: 'Cancelar',
      onOk: () => deleteClient(client.id),
    });
  };

  const handleRestore = () => {
    Modal.confirm({
      title: `¿Restaurar a ${client.clientName}?`,
      content: `El cliente del local ${client.premises} volverá a estar activo.`,
      okText: 'Restaurar',
      cancelText: 'Cancelar',
      okButtonProps: { style: { backgroundColor: '#16a34a', borderColor: '#16a34a', color: '#fff' } },
      onOk: () => restoreClient(client.id),
    });
  };

  if (deleted) {
    return (
      <div className="flex bg-gray-200 items-center text-gray-500 opacity-70 rounded-md m-2">
        <span className="text-red-600 font-bold text-xs px-2">[ELIMINADO]</span>
        <b><p className="p-2 flex items-center line-through">{client.premises} {client.clientName}</p></b>
        <span className="text-xs text-gray-400 px-2">{client.mall}</span>
        {client.deletedAt && (
          <span className="text-xs text-gray-400 px-2">{client.deletedAt.slice(0, 10)}</span>
        )}
        <div className="p-2 ml-auto">
          <button
            type="button"
            className="bg-green-200 hover:bg-green-300 px-2 py-1 text-green-800 rounded"
            onClick={handleRestore}
          >
            <UndoOutlined />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex bg-stone-100 items-center stext-black rounded-md m-2">
      <b><p className="p-2 flex items-center h-content">{client.premises} {client.clientName}</p></b>
      <div className="p-2 ml-auto">
        <button
          type="button"
          className="bg-slate-300 px-2 mx-8 py-1 text-black"
          onClick={handleDelete}
        >
          <DeleteOutlined />
        </button>
        <button
          type="button"
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
