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

/**
 * Sort products by timestamp in descending order (newest first)
 * Product IDs have format: "productId HH:mm DD/MM/YY"
 * Example: "prod123 14:30 15/10/24"
 */
export const sortProductsByDateDesc = (products) => {
  if (!Array.isArray(products)) return [];

  return [...products].sort((a, b) => {
    // Extract timestamp from product ID (last 14 characters: "HH:mm DD/MM/YY")
    const timeA = a.id?.slice(-14) || '';
    const timeB = b.id?.slice(-14) || '';

    // If timestamps are invalid, maintain original order
    if (!timeA || !timeB) return 0;

    try {
      // Parse "HH:mm DD/MM/YY" format
      const [timePartA, datePartA] = timeA.split(' ');
      const [timePartB, datePartB] = timeB.split(' ');

      const [hourA, minA] = timePartA.split(':').map(Number);
      const [dayA, monthA, yearA] = datePartA.split('/').map(Number);

      const [hourB, minB] = timePartB.split(':').map(Number);
      const [dayB, monthB, yearB] = datePartB.split('/').map(Number);

      // Create date objects (year is 20XX format)
      const dateA = new Date(2000 + yearA, monthA - 1, dayA, hourA, minA);
      const dateB = new Date(2000 + yearB, monthB - 1, dayB, hourB, minB);

      // Sort descending (newest first)
      return dateB - dateA;
    } catch (error) {
      // If parsing fails, maintain original order
      return 0;
    }
  });
};