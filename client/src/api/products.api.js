import axios from `axios`;
var renderServer = 'https://coffeserver.onrender.com'
export const getProductsRequest = async () =>
  await axios.get(`${renderServer}/products`);

export const createProductRequest = async (product) =>
  await axios.post(`${renderServer}/product`, product);

export const deleteProductRequest = async (id) =>
  await axios.delete(`${renderServer}/product/${id}`);

export const getProductRequest = async (id) =>
  await axios.get(`${renderServer}/product/${id}`);

export const updateProductRequest = async (id, newFields) =>
  await axios.put(`${renderServer}/product/${id}`, newFields);

export const toggleProductDoneRequest = async (id, done) =>
  await axios.put(`${renderServer}/product/${id}`, {
    done,
  });
