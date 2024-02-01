import axios from `axios`;

var renderServer = 'https://coffeserver.onrender.com'

export const getClientsRequest = async (mall) =>
  await axios.get(`${renderServer}/clients/${mall}`);

export const createClientRequest = async (client) =>
  await axios.post(`${renderServer}/client`, client);

export const deleteClientRequest = async (id) =>
  await axios.delete(`${renderServer}/client/${id}`);

export const getClientRequest = async (id) =>
  await axios.get(`${renderServer}/client/${id}`);

export const updateClientRequest = async (id, newFields) =>
  await axios.put(`${renderServer}/client/${id}`, newFields);

export const toggleClientDoneRequest = async (id, done) =>
  await axios.put(`${renderServer}/client/${id}`, {
    done,
  });
