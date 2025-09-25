import axios from "axios";
import { API_CONFIG } from '../utils/config';
export const getProductsRequest = async () =>
  await axios.get(`${API_CONFIG.RENDER_SERVER}/products`);

export const createProductRequest = async (product) =>
  await axios.post(`${API_CONFIG.RENDER_SERVER}/product`, product);

export const deleteProductRequest = async (id) =>
  await axios.delete(`${API_CONFIG.RENDER_SERVER}/product/${id}`);

export const getProductRequest = async (id) =>
  await axios.get(`${API_CONFIG.RENDER_SERVER}/product/${id}`);

export const updateProductRequest = async (id, newFields) =>
  await axios.put(`${API_CONFIG.RENDER_SERVER}/product/${id}`, newFields);

export const toggleProductDoneRequest = async (id, done) =>
  await axios.put(`${API_CONFIG.RENDER_SERVER}/product/${id}`, {
    done,
  });
