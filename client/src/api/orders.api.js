import axios from "axios";
var renderServer = 'https://coffeserver.onrender.com'
export const getOrdersRequest = async (date) =>
  await axios.get(`${renderServer}/orders/${date}`, date);

export const getCollectedOrders = async (date) =>
  await axios.get(`${renderServer}/collectedOrders/${date}`, date);

export const createOrderRequest = async (order) =>
  await axios.post(`${renderServer}/order`, order);

export const deleteOrderRequest = async (id) =>
  await axios.delete(`${renderServer}/order/${id}`);

export const getOrderRequest = async (id) =>
  await axios.get(`${renderServer}/order/${id}`);

export const updateOrderRequest = async (id, newFields) =>
  await axios.put(`${renderServer}/order/${id}`, newFields);

export const toggleOrderDoneRequest = async (id, done) =>
  await axios.put(`${renderServer}/order/${id}`, {
    done,
  });
