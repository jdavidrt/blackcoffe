import { createContext, useContext, useState } from "react";
import {
  getOrdersRequest,
  getCollectedOrders,
  deleteOrderRequest,
  createOrderRequest,
  getOrderRequest,
  updateOrderRequest,
  getUnpaidOrders,
  loadUnPaidOrdersbyClient
} from "../api/orders.api";
import { OrderContext } from "./OrderContext";

export const useOrders = () => {
  const context = useContext(OrderContext);
  if (context === undefined) {
    throw new Error("useOrders must be used within a OrderContextProvider");
  }
  return context;
};


export const OrderContextProvider = ({ children }) => {
  const [orders, setOrders] = useState([]);
  var [unPaidOrder, setUnPaidOrder] = useState([]);

  async function loadOrders() {
    const response = await getOrdersRequest();
    setOrders(response.data);
  }

  async function loadCollectedOrders(date) {
    console.log('fecha', date)
    const response = await getCollectedOrders(date);
    setOrders(response.data);
  }

  const deleteOrder = async (id) => {
    try {
      const response = await deleteOrderRequest(id);
      setOrders(orders.filter((order) => order.id !== id));
    } catch (error) {
      console.error(error);
    }
  };

  async function loadUnPaidOrders(mall) {
    const response = await getUnpaidOrders(mall);
    setOrders(response.data);
  }

  const createOrder = async (order) => {
    try {
      await createOrderRequest(order);
      // setOrders([...orders, response.data]);
    } catch (error) {
      console.error(error);
    }
  };


  async function getUnPaidOrdersbyClient(clientId) {
    const response = await loadUnPaidOrdersbyClient(clientId);
    if (response.data.length > 0) {
      setUnPaidOrder(response.data[0]);
    } else {
      setUnPaidOrder(false)
    }
    console.log('unpaidord', unPaidOrder)
  }

  const getOrder = async (id) => {
    try {
      const response = await getOrderRequest(id);
      return response.data;
    } catch (error) {
      console.error(error);
    }
  };

  const updateOrder = async (id, newFields) => {
    console.log('newFields', newFields)
    try {
      const response = await updateOrderRequest(id, newFields);
      console.log(response);
    } catch (error) {
      console.error(error);
    }
  };
  return (
    <OrderContext.Provider
      value={{
        orders,
        unPaidOrder,
        loadOrders,
        loadCollectedOrders,
        deleteOrder,
        createOrder,
        getOrder,
        updateOrder,
        loadUnPaidOrders,
        getUnPaidOrdersbyClient
      }}
    >
      {children}
    </OrderContext.Provider>
  );
};
