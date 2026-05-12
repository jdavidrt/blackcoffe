import { createContext, useContext, useState } from "react";
import {
  getOrdersRequest,
  getCollectedOrders,
  deleteOrderRequest,
  createOrderRequest,
  getOrderRequest,
  updateOrderRequest,
  getUnpaidOrders,
  loadUnPaidOrdersbyClient,
  getNotDeliveredOrdersRequest,
  getDeliveredOrdersRequest,
  getDepositedOrdersByDate,
  getOrphanedOrdersRequest,
  getAbandonedOrdersRequest,
  markOrderAsAbandonedRequest,
  unmarkOrderAsAbandonedRequest
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
  var [unPaidOrder, setUnPaidOrder] = useState(null);
  const [abandonedOrders, setAbandonedOrders] = useState([]);

  async function loadOrders() {
    const response = await getOrdersRequest();
    setOrders(response.data);
  }

  async function loadUnDeliveredOrders() {
    const response = await getNotDeliveredOrdersRequest();
    setOrders(response.data);
  }

  async function loadDeliveredOrders(date) {
    const response = await getDeliveredOrdersRequest(date);
    setOrders(response.data);
  }

  async function loadCollectedOrders(date) {
    const response = await getCollectedOrders(date);
    setOrders(response.data);
  }

  async function loadDepositedOrderByDate(date) {
    const response = await getDepositedOrdersByDate(date);
    setOrders(response.data);
  }

  async function loadOrphanedOrders() {
    const response = await getOrphanedOrdersRequest();
    setOrders(response.data);
  }

  const deleteOrder = async (id) => {
    await deleteOrderRequest(id);
    setOrders(orders.filter((order) => order.id !== id));
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
      setUnPaidOrder(null);
    }
  }

  function resetUnPaidOrder() {
    setUnPaidOrder(null);
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
    try {
      console.log('[OrderProvider] Updating order:', id, newFields);
      const response = await updateOrderRequest(id, newFields);
      console.log('[OrderProvider] Order updated successfully:', response.data);
      return response.data;
    } catch (error) {
      console.error('[OrderProvider] ERROR updating order:', error);
      console.error('[OrderProvider] Error details:', error.response?.data);
      throw error; // Re-throw to allow caller to handle
    }
  };

  const getAbandonedOrders = async () => {
    try {
      const res = await getAbandonedOrdersRequest();
      setAbandonedOrders(res.data);
      return res.data;
    } catch (error) {
      console.error(error);
    }
  };

  const markOrderAsAbandoned = async (id, abandonData) => {
    try {
      await markOrderAsAbandonedRequest(id, abandonData);
      await loadOrders();
      await getAbandonedOrders();
    } catch (error) {
      console.error(error);
    }
  };

  const unmarkOrderAsAbandoned = async (id) => {
    try {
      await unmarkOrderAsAbandonedRequest(id);
      await loadOrders();
      await getAbandonedOrders();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <OrderContext.Provider
      value={{
        orders,
        unPaidOrder,
        abandonedOrders,
        loadOrders,
        loadCollectedOrders,
        deleteOrder,
        createOrder,
        getOrder,
        updateOrder,
        loadUnPaidOrders,
        getUnPaidOrdersbyClient,
        resetUnPaidOrder,
        loadUnDeliveredOrders,
        loadDeliveredOrders,
        loadDepositedOrderByDate,
        loadOrphanedOrders,
        getAbandonedOrders,
        markOrderAsAbandoned,
        unmarkOrderAsAbandoned
      }}
    >
      {children}
    </OrderContext.Provider>
  );
};
