import React, { useEffect, useState } from "react";
import ClientCard from "../components/ClientCard";
import { useClients } from "../context/ClientProvider";
import { Link } from "react-router-dom";
import SearchBar from "../components/SearchBar";
import CoffeePouringAnimation from "../components/CoffeePouringAnimation";

function ClientsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [mall, setMall] = useState("Unilago");
  const [showDeleted, setShowDeleted] = useState(false);
  const { clients, loadClients, deletedClients, loadDeletedClients } = useClients();

  const selectMall = (selectedMall) => {
    setShowDeleted(false);
    setMall(selectedMall);
    loadClients(selectedMall);
  };

  const handleShowDeleted = async () => {
    setShowDeleted(true);
    setLoading(true);
    try {
      await loadDeletedClients();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        await loadClients(mall);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const filteredClients = clients.filter((client) =>
    client.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.premises.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredDeleted = deletedClients.filter((client) =>
    client.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.premises.toLowerCase().includes(searchTerm.toLowerCase())
  );

  function renderMain() {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-opacity-50 bg-gray-500">
          <CoffeePouringAnimation />
          <div className="text-white text-2xl">Cargando...</div>
        </div>
      );
    }

    if (showDeleted) {
      if (deletedClients.length === 0) return <h1 className="p-4 text-center">No hay clientes eliminados</h1>;
      return filteredDeleted.map((client) => <ClientCard client={client} key={client.id} deleted={true} />);
    }

    if (clients.length === 0) {
      return <h1>No hay clientes</h1>;
    }

    return filteredClients.map((client) => <ClientCard client={client} key={client.id} />);
  }

  const headerCount = showDeleted
    ? `Eliminados (${deletedClients.length})`
    : `Clientes (${clients.length})`;

  return (
    <div>
      <div className="py-2">
        <h4 className="text-2xl text-black text-center font-bold text-center">{headerCount}</h4>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            style={{ backgroundColor: !showDeleted && mall === 'Unilago' ? '#A6C4F0' : '#F3F1F1' }}
            className="px-3 py-1 text-black rounded-md"
            onClick={() => selectMall('Unilago')}
          >
            Unilago
          </button>
          <button
            type="button"
            style={{ backgroundColor: !showDeleted && mall === 'Alta Tecnología' ? '#A6C4F0' : '#F3F1F1' }}
            className="px-3 py-1 text-black rounded-md"
            onClick={() => selectMall('Alta Tecnología')}
          >
            Alta Tecnología
          </button>
          <button
            type="button"
            style={{ backgroundColor: !showDeleted && mall === 'Otros' ? '#A6C4F0' : '#F3F1F1' }}
            className="px-3 py-1 text-black rounded-md"
            onClick={() => selectMall('Otros')}
          >
            Otros
          </button>
          <button
            type="button"
            style={{ backgroundColor: showDeleted ? '#FECACA' : '#F3F1F1' }}
            className="px-3 py-1 text-red-700 rounded-md font-semibold"
            onClick={handleShowDeleted}
          >
            Eliminados
          </button>
          <div className="ml-auto">
            <Link to="/nuevoCliente">
              <button
                type="button"
                className="bg-emerald-400 px-3 py-1 text-black rounded-md"
              >
                Nuevo Cliente
              </button>
            </Link>
          </div>
        </div>
        <SearchBar onSearch={setSearchTerm} />
      </div>
      <div className="bg-yellow-500 rounded-md grid">{renderMain()}</div>
    </div>
  );
}

export default ClientsPage;
