import axios from "axios";
import { API_CONFIG } from '../utils/config';
import { idempotent } from '../utils/network';

// requestKey makes a resend (weak signal) safe: the server records the same key only once.
export const createDepositRequest = async (deposit, requestKey) =>
    await axios.post(`${API_CONFIG.RENDER_SERVER}/deposits`, deposit, requestKey && idempotent(requestKey));

export const getDepositByOrderIdRequest = async (id) =>
    await axios.get(`${API_CONFIG.RENDER_SERVER}/deposits/${id}`);

export const getDepositsByDateRequest = async (date) =>
    await axios.get(`${API_CONFIG.RENDER_SERVER}/depositsByDate/${date}`);

export const deleteDepositById = async (id) =>
    await axios.delete(`${API_CONFIG.RENDER_SERVER}/deposits/${id}`);



