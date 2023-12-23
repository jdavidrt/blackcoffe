import { createContext, useContext, useState } from "react";
import {
  getOrdersRequest,
  deleteOrderRequest,
  createOrderRequest,
  getOrderRequest,
  updateOrderRequest,
  toggleOrderDoneRequest,
} from "../api/orders.api";
import { OrderContext } from "./OrderContext";

export const useorders = () => {
  const context = useContext(OrderContext);
  if (context === undefined) {
    throw new Error("useOrders must be used within a OrderContextProvider");
  }
  return context;
};

export const useOrders = () => {
  const context = useContext(OrderContext);
  if (context === undefined) {
    throw new Error("useOrders must be used within a OrderContextProvider");
  }
  return context;
};


export const OrderContextProvider = ({ children }) => {
  const [orders, setOrders] = useState([]);

  async function loadOrders() {
    const response = await getOrdersRequest();
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
        deleteOrder,
        createOrder,
        getOrder,
        updateOrder,
        toggleOrderDone,
      }}
    >
      {children}
    </OrderContext.Provider>
  );
};
