import { createContext, useContext, useState } from "react";
import {
  getClientsRequest,
  deleteClientRequest,
  createClientRequest,
  getClientRequest,
  updateClientRequest,
  toggleClientDoneRequest,
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

  async function loadClients() {
    const response = await getClientsRequest();
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
      console.log(response);
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
      }}
    >
      {children}
    </ClientContext.Provider>
  );
};
