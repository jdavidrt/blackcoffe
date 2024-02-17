import axios from "axios";
var renderServer = 'https://coffeserver.onrender.com'
export const getDepositsRequest = async () =>
    await axios.get(`${renderServer}/deposits`);

export const createDepositRequest = async (product) =>
    await axios.post(`${renderServer}/deposits`, product);

export const getDepositByOrderIdRequest = async (id) =>
    await axios.get(`${renderServer}/deposits/${id}`);
