import { getOrderItems } from './jsonUtils';

/**
 * Calculate order total - ELIMINATES 9 duplicate functions
 * Used in: OrderCard, OrderCollectCard, OrderDeliveryCard, OrderForm, etc.
 */
export const calculateOrderTotal = (order) => {
  const items = getOrderItems(order);
  return items.reduce((total, item) => total + (item.unitValue || 0) * (item.quantity || 0), 0);
};

/**
 * Calculate balance due
 */
export const calculateBalance = (order) => {
  const total = calculateOrderTotal(order);
  const deposit = order.deposit || 0;
  return Math.max(0, total - deposit);
};

/**
 * Check if order is fully paid
 */
export const isOrderPaid = (order) => {
  return calculateBalance(order) === 0;
};

/**
 * Get delivered items for a specific date
 */
export const getDeliveredItemsForDate = (order, date) => {
  const items = getOrderItems(order);
  return items.filter(item => item.delivered && item.deliveredAt === date);
};

/**
 * Get undelivered items
 */
export const getUndeliveredItems = (order) => {
  const items = getOrderItems(order);
  return items.filter(item => !item.delivered);
};