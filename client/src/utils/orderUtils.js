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
 * Extract display timestamp from item ID.
 * Handles both old format "productId HH:mm DD/MM/YY" and new format "productId HH:mm:ss DD/MM/YY".
 * Always displays as "HH:mm DD/MM/YY" (no seconds).
 */
export const getItemDisplayTime = (itemId) => {
  if (!itemId) return '';
  // New format with seconds: "374 17:08:30 10/03/26" → "17:08 10/03/26"
  if (itemId.includes(':') && itemId.split(':').length === 3) {
    return itemId.slice(-17, -12) + itemId.slice(-9);
  }
  // Old format without seconds: "374 17:08 10/03/26" → "17:08 10/03/26"
  return itemId.slice(-14);
};

/**
 * Extract the date portion ("DD/MM/YY") from an item ID.
 * Used to group items into day-separators. Returns '' for empty/invalid ids.
 */
export const getItemDate = (itemId) => getItemDisplayTime(itemId).slice(-8);

/**
 * Extract full timestamp string from item ID for sorting.
 * Returns "HH:mm:ss DD/MM/YY" or "HH:mm DD/MM/YY" depending on format.
 */
const getItemTimestamp = (itemId) => {
  if (!itemId) return '';
  if (itemId.includes(':') && itemId.split(':').length === 3) {
    return itemId.slice(-17);
  }
  return itemId.slice(-14);
};

/**
 * Sort products by timestamp in descending order (newest first)
 * Supports both "HH:mm DD/MM/YY" and "HH:mm:ss DD/MM/YY" formats.
 */
export const sortProductsByDateDesc = (products) => {
  if (!Array.isArray(products)) return [];

  return [...products].sort((a, b) => {
    const timeA = getItemTimestamp(a.id);
    const timeB = getItemTimestamp(b.id);

    if (!timeA || !timeB) return 0;

    try {
      const partsA = timeA.split(' ');
      const partsB = timeB.split(' ');

      const timePartsA = partsA[0].split(':').map(Number);
      const [dayA, monthA, yearA] = partsA[1].split('/').map(Number);

      const timePartsB = partsB[0].split(':').map(Number);
      const [dayB, monthB, yearB] = partsB[1].split('/').map(Number);

      const dateA = new Date(2000 + yearA, monthA - 1, dayA, timePartsA[0], timePartsA[1], timePartsA[2] || 0);
      const dateB = new Date(2000 + yearB, monthB - 1, dayB, timePartsB[0], timePartsB[1], timePartsB[2] || 0);

      return dateB - dateA;
    } catch (error) {
      return 0;
    }
  });
};