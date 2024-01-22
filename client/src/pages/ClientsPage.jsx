import { useEffect } from "react";
import ClientCard from "../components/ClientCard";
import { useClients } from "../context/ClientProvider";
import { useState } from "react";
import { Link } from "react-router-dom";
import SearchBar from "../components/SearchBar";
function ClientsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const selectMall = (selectedMall) => {
    const newMall = selectedMall;
    setMall(newMall);
    loadClients(newMall);
  };
  const [mall, setMall] = useState("Unilago");


  const { clients, loadClients } = useClients();
  useEffect(() => {
    loadClients(mall)
  }, []);
  console.log(clients)

  const filteredClients = clients.filter((client) =>
    client.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.premises.toLowerCase().includes(searchTerm.toLowerCase())
  );


  function renderMain() {
    if (clients.length === 0) return <h1>No hay clientes</h1>;
    return filteredClients.map((client) => <ClientCard client={client} key={client.id} />);
  }

  return (
    <div>
      <div className="py-2"><h4 className="text-2xl text-black text-center font-bold text-center">Clientes ({clients.length}) </h4>
        <div className="flex">
          <button type="button" style={{
            backgroundColor: mall === 'Unilago' ? '#A6C4F0' : '#F3F1F1',
          }}
            className=" bg-indigo-500 px-3 py-1 text-black rounded-md" onClick={() => selectMall('Unilago')}>Unilago</button>
          <div className="px-2" />
          <button type="button" style={{
            backgroundColor: mall === 'Alta Tecnología' ? '#A6C4F0' : '#F3F1F1',
          }}
            className="bg-indigo-500 px-3 py-1 text-black rounded-md" onClick={() => selectMall('Alta Tecnología')}>Alta Tecnología</button>
          <div className="px-2" />
          <button type="button" style={{
            backgroundColor: mall === 'Otros' ? '#A6C4F0' : '#F3F1F1',
          }}
            className=" bg-indigo-500 px-3 py-1 text-black rounded-md" onClick={() => selectMall('Otros')}>Otros</button>
          <div className="px-2" />
          <div className="ml-auto">
            <Link to="/nuevoCliente">
              <div><button type="button"
                className=" bg-emerald-400 px-3 py-1 text-black rounded-md ml-auto" backgroundColor='#F3F1F1'>Nuevo Cliente</button></div>
            </Link>
          </div>
        </div>
        <SearchBar onSearch={setSearchTerm} />
      </div>
      <div className="bg-yellow-500  rounded-md grid">{renderMain()}</div>
    </div>
  );
}

export default ClientsPage;
