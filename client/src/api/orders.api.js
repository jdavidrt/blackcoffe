import axios from "axios";

export const getOrdersRequest = async () =>
  await axios.get("http://localhost:4000/orders");

export const createOrderRequest = async (order) =>
  await axios.post("http://localhost:4000/order", order);

export const deleteOrderRequest = async (id) =>
  await axios.delete(`http://localhost:4000/order/${id}`);

export const getOrderRequest = async (id) =>
  await axios.get(`http://localhost:4000/order/${id}`);

export const updateOrderRequest = async (id, newFields) =>
  await axios.put(`http://localhost:4000/order/${id}`, newFields);

export const toggleOrderDoneRequest = async (id, done) =>
  await axios.put(`http://localhost:4000/order/${id}`, {
    done,
  });
