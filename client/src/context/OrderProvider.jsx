import { createContext, useContext, useState } from "react";
import {
  getOrdersRequest,
  getCollectedOrders,
  deleteOrderRequest,
  createOrderRequest,
  getOrderRequest,
  updateOrderRequest,
  toggleOrderDoneRequest,
  getUnpaidOrders
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

  async function loadOrders(date) {
    const response = await getOrdersRequest(date);
    setOrders(response.data);
  }

  async function loadCollectedOrders(date) {
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

  const toggleOrderDone = async (id) => {
    try {
      const orderFound = orders.find((order) => order.id === id);
      await toggleOrderDoneRequest(id, orderFound.done === 0 ? true : false);
      setOrders(
        orders.map((order) =>
          order.id === id ? { ...order, done: !order.done } : order
        )
      );
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <OrderContext.Provider
      value={{
        orders,
        loadOrders,
        loadCollectedOrders,
        deleteOrder,
        createOrder,
        getOrder,
        updateOrder,
        toggleOrderDone,
        loadUnPaidOrders
      }}
    >
      {children}
    </OrderContext.Provider>
  );
};
