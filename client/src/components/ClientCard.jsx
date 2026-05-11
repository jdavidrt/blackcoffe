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
      onOk: async () => {
        try {
          await deleteClient(client.id);
        } catch (error) {
          const orderId = error.response?.data?.orderId;
          if (error.response?.status === 400 && orderId) {
            Modal.error({
              title: 'Cliente con órdenes activas',
              content: (
                <div>
                  <p>Este cliente tiene órdenes activas y no puede ser eliminado.</p>
                  <a
                    href={`/cobrarOrden/${orderId}`}
                    style={{ color: '#1677ff', textDecoration: 'underline', fontWeight: '600', display: 'inline-block', marginTop: '4px' }}
                  >
                    Ver orden #{orderId}
                  </a>
                </div>
              ),
            });
          }
        }
      },
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
      <div className="flex items-center bg-gray-200 text-gray-500 opacity-70 rounded-md m-2">
        <span className="text-red-600 font-bold text-xs px-2">[ELIMINADO]</span>
        <b><p className="p-2 flex items-center line-through">{client.premises} {client.clientName}</p></b>
        <span className="text-xs text-gray-400 px-2">{client.mall}</span>
        {client.deletedAt && (
          <span className="text-xs text-gray-400 px-2">{client.deletedAt.slice(0, 10)}</span>
        )}
        <div className="p-2 ml-auto">
          <button
            type="button"
            className="w-8 h-8 rounded-md flex items-center justify-center bg-green-200 hover:bg-green-300 text-green-800"
            onClick={handleRestore}
          >
            <UndoOutlined />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center bg-stone-100 text-black rounded-md m-2">
      <span>{client.createAt}</span>
      <b><p className="p-2 flex items-center h-content">{client.premises} {client.clientName}</p></b>
      <div className="flex gap-2 p-2 ml-auto">
        <button
          type="button"
          className="w-8 h-8 rounded-md flex items-center justify-center bg-slate-300 text-black"
          onClick={handleDelete}
        >
          <DeleteOutlined />
        </button>
        <button
          type="button"
          className="w-8 h-8 rounded-md flex items-center justify-center bg-slate-300 text-black"
          onClick={() => navigate(`/editarCliente/${client.id}`)}
        >
          <EditOutlined />
        </button>
      </div>
    </div>
  );
}

export default clientCard;
