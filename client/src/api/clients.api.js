import axios from "axios";
import { API_CONFIG } from '../utils/config';

export const getClientsRequest = async (mall) =>
  await axios.get(`${API_CONFIG.RENDER_SERVER}/clients/${mall}`);

export const createClientRequest = async (client) =>
  await axios.post(`${API_CONFIG.RENDER_SERVER}/client`, client);

export const deleteClientRequest = async (id) =>
  await axios.delete(`${API_CONFIG.RENDER_SERVER}/client/${id}`);

export const getClientRequest = async (id) =>
  await axios.get(`${API_CONFIG.RENDER_SERVER}/client/${id}`);

export const updateClientRequest = async (id, newFields) =>
  await axios.put(`${API_CONFIG.RENDER_SERVER}/client/${id}`, newFields);

export const toggleClientDoneRequest = async (id, done) =>
  await axios.put(`${API_CONFIG.RENDER_SERVER}/client/${id}`, {
    done,
  });
