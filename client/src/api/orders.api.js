import axios from "axios";
import { API_CONFIG } from '../utils/config';
import { idempotent } from '../utils/network';

export const getOrdersRequest = async () =>
  await axios.get(`${API_CONFIG.RENDER_SERVER}/orders/`,);

export const getOrphanedOrdersRequest = async () =>
  await axios.get(`${API_CONFIG.RENDER_SERVER}/orphanedOrders/`,);

export const getNotDeliveredOrdersRequest = async () =>
  await axios.get(`${API_CONFIG.RENDER_SERVER}/notDeliveredOrders/`,);

export const getDeliveredOrdersRequest = async (date) =>
  await axios.get(`${API_CONFIG.RENDER_SERVER}/deliveredOrders/${date}`, date);

export const getCollectedOrders = async (date) =>
  await axios.get(`${API_CONFIG.RENDER_SERVER}/collectedOrders/${date}`, date);

export const getDepositedOrdersByDate = async (date) =>
  await axios.get(`${API_CONFIG.RENDER_SERVER}/depositedOrdersByDate/${date}`, date);

export const getUnpaidOrders = async (mall) =>
  await axios.get(`${API_CONFIG.RENDER_SERVER}/unPaidOrders/${mall}`, mall);

export const loadUnPaidOrdersbyClient = async (clientId) =>
  await axios.get(`${API_CONFIG.RENDER_SERVER}/unPaidOrdersByClient/${clientId}`, clientId);

// requestKey makes a resend (weak signal) safe: the server applies the same key only once.
export const createOrderRequest = async (order, requestKey) =>
  await axios.post(`${API_CONFIG.RENDER_SERVER}/order`, order, requestKey && idempotent(requestKey));

export const deleteOrderRequest = async (id) =>
  await axios.delete(`${API_CONFIG.RENDER_SERVER}/order/${id}`);

export const getOrderRequest = async (id) =>
  await axios.get(`${API_CONFIG.RENDER_SERVER}/order/${id}`);

export const updateOrderRequest = async (id, newFields) =>
  await axios.put(`${API_CONFIG.RENDER_SERVER}/order/${id}`, newFields);

// Sets one item's delivery state on the server's current items (never send the whole list back).
export const setItemDeliveredRequest = async (id, itemId, delivered, deliveredAt) =>
  await axios.put(`${API_CONFIG.RENDER_SERVER}/order/${id}/delivered`, { itemId, delivered, deliveredAt }, { retry: true });

export const toggleOrderDoneRequest = async (id, done) =>
  await axios.put(`${API_CONFIG.RENDER_SERVER}/order/${id}`, {
    done,
  });

export const getAbandonedOrdersRequest = async () =>
  await axios.get(`${API_CONFIG.RENDER_SERVER}/abandonedOrders`);

export const markOrderAsAbandonedRequest = async (id, data) =>
  await axios.put(`${API_CONFIG.RENDER_SERVER}/order/${id}/abandon`, data);

export const unmarkOrderAsAbandonedRequest = async (id) =>
  await axios.put(`${API_CONFIG.RENDER_SERVER}/order/${id}/reactivate`);
