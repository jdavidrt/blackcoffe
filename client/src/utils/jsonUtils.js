/**
 * Safely parse JSON with fallback values
 * @param {string} jsonString - The JSON string to parse
 * @param {any} fallback - Fallback value if parsing fails
 * @returns {any} Parsed object or fallback
 */
export const safeJSONParse = (jsonString, fallback = []) => {
  if (!jsonString || typeof jsonString !== 'string') {
    return fallback;
  }

  try {
    const parsed = JSON.parse(jsonString);
    return parsed || fallback;
  } catch (error) {
    console.warn('JSON parsing failed:', error.message);
    return fallback;
  }
};

/**
 * Get order items safely
 * @param {Object} order - Order object with items property
 * @returns {Array} Array of order items
 */
export const getOrderItems = (order) => {
  if (!order || !order.items) {
    return [];
  }
  return safeJSONParse(order.items, []);
};

/**
 * Check if order items are valid array
 * @param {Object} order - Order object
 * @returns {boolean} True if items are valid array
 */
export const hasValidItems = (order) => {
  const items = getOrderItems(order);
  return Array.isArray(items) && items.length > 0;
};