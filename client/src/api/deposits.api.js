import axios from "axios";
import { API_CONFIG } from '../utils/config';
export const getDepositsRequest = async () =>
    await axios.get(`${API_CONFIG.RENDER_SERVER}/deposits`);

export const createDepositRequest = async (product) =>
    await axios.post(`${API_CONFIG.RENDER_SERVER}/deposits`, product);

export const getDepositByOrderIdRequest = async (id) =>
    await axios.get(`${API_CONFIG.RENDER_SERVER}/deposits/${id}`);

export const getDepositsByDateRequest = async (date) =>
    await axios.get(`${API_CONFIG.RENDER_SERVER}/depositsByDate/${date}`);

export const deleteDepositById = async (id) =>
    await axios.delete(`${API_CONFIG.RENDER_SERVER}/deposits/${id}`);



