import { createContext, useContext, useState } from "react";
import {
  getClientsRequest,
  deleteClientRequest,
  createClientRequest,
  getClientRequest,
  updateClientRequest,
  toggleClientDoneRequest,
  getDeletedClientsRequest,
  restoreClientRequest,
} from "../api/clients.api";
import { ClientContext } from "./ClientContext";

export const useClients = () => {
  const context = useContext(ClientContext);
  if (context === undefined) {
    throw new Error("useClients must be used within a ClientContextProvider");
  }
  return context;
};


export const ClientContextProvider = ({ children }) => {
  const [clients, setClients] = useState([]);
  const [deletedClients, setDeletedClients] = useState([]);

  async function loadClients(mall) {
    const response = await getClientsRequest(mall);
    setClients(response.data);
  }

  const deleteClient = async (id) => {
    try {
      const response = await deleteClientRequest(id);
      setClients(clients.filter((client) => client.id !== id));
    } catch (error) {
      console.error(error);
    }
  };

  const createClient = async (client) => {
    try {
      await createClientRequest(client);
      // setClients([...clients, response.data]);
    } catch (error) {
      console.error(error);
    }
  };

  const getClient = async (id) => {
    try {
      const response = await getClientRequest(id);
      return response.data;
    } catch (error) {
      console.error(error);
    }
  };

  const updateClient = async (id, newFields) => {
    try {
      const response = await updateClientRequest(id, newFields);
    } catch (error) {
      console.error(error);
    }
  };

  const loadDeletedClients = async () => {
    try {
      const response = await getDeletedClientsRequest();
      setDeletedClients(response.data);
    } catch (error) {
      console.error(error);
    }
  };

  const restoreClient = async (id) => {
    try {
      await restoreClientRequest(id);
      setDeletedClients(deletedClients.filter((client) => client.id !== id));
    } catch (error) {
      console.error(error);
    }
  };

  const toggleClientDone = async (id) => {
    try {
      const clientFound = clients.find((client) => client.id === id);
      await toggleClientDoneRequest(id, clientFound.done === 0 ? true : false);
      setClients(
        clients.map((client) =>
          client.id === id ? { ...client, done: !client.done } : client
        )
      );
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <ClientContext.Provider
      value={{
        clients,
        loadClients,
        deleteClient,
        createClient,
        getClient,
        updateClient,
        toggleClientDone,
        deletedClients,
        loadDeletedClients,
        restoreClient,
      }}
    >
      {children}
    </ClientContext.Provider>
  );
};
