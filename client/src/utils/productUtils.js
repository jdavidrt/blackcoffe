/**
 * Product progressive reveal utilities
 */

const PRODUCTS_PER_PAGE = 10;
const INITIAL_VISIBLE_COUNT = 3; // Always show last 3 products initially

/**
 * Determines if "Mostrar más" button should be shown
 * @param {number} totalProducts - Total number of products
 * @param {number} visibleCount - Currently visible products
 * @returns {boolean}
 */
export const shouldShowMoreButton = (totalProducts, visibleCount) => {
  return totalProducts > visibleCount;
};

/**
 * Gets count of remaining hidden products
 * @param {number} totalProducts - Total number of products
 * @param {number} visibleCount - Currently visible products
 * @returns {number}
 */
export const getRemainingCount = (totalProducts, visibleCount) => {
  return Math.max(0, totalProducts - visibleCount);
};

/**
 * Calculates initial visible count (always 3 most recent products)
 * @param {number} totalProducts - Total number of products
 * @returns {number}
 */
export const getInitialVisibleCount = (totalProducts) => {
  return totalProducts <= INITIAL_VISIBLE_COUNT ? totalProducts : INITIAL_VISIBLE_COUNT;
};

/**
 * Calculates next visible count when "Mostrar más" is clicked
 * @param {number} currentVisible - Current visible count
 * @param {number} totalProducts - Total number of products
 * @returns {number}
 */
export const getNextVisibleCount = (currentVisible, totalProducts) => {
  const nextCount = currentVisible + PRODUCTS_PER_PAGE;
  return Math.min(nextCount, totalProducts);
};

export { PRODUCTS_PER_PAGE, INITIAL_VISIBLE_COUNT };
