/**
 * Order validation utilities to prevent product duplication.
 * Used in OrderForm.jsx before submitting create/edit/merge operations.
 */

/**
 * Snapshot the current cart's totals for pre-submit integrity checks.
 * @param {Array} cart - Array of cart items
 * @returns {{ totalQuantity: number, totalValue: number, itemCount: number }}
 */
export const createCartSnapshot = (cart) => ({
  itemCount: cart.length,
  totalQuantity: cart.reduce((sum, item) => sum + (item.quantity || 0), 0),
  totalValue: cart.reduce((sum, item) => sum + (item.unitValue || 0) * (item.quantity || 0), 0),
});

/**
 * Merges new cart items with existing order items and validates the result.
 * Products with the same id have their quantities summed.
 * Returns the merged array only if totals match expectations.
 *
 * @param {Array} newItems    - Items from the current cart (new order being created)
 * @param {Array} existingItems - Items already in the unpaid order in the DB
 * @returns {{ isValid: boolean, mergedItems: Array, errors: string[] }}
 */
export const validateSafeMerge = (newItems, existingItems) => {
  const newSnap = createCartSnapshot(newItems);
  const existSnap = createCartSnapshot(existingItems);

  const expectedQuantity = newSnap.totalQuantity + existSnap.totalQuantity;
  const expectedValue = newSnap.totalValue + existSnap.totalValue;

  // Merge: same id → sum quantities
  const idMap = {};
  [...newItems, ...existingItems].forEach((item) => {
    if (idMap[item.id]) {
      idMap[item.id].quantity += item.quantity;
    } else {
      idMap[item.id] = { ...item };
    }
  });
  const mergedItems = Object.values(idMap);

  const mergedSnap = createCartSnapshot(mergedItems);
  const errors = [];

  if (mergedSnap.totalQuantity !== expectedQuantity) {
    errors.push(
      `Cantidad esperada: ${expectedQuantity}, obtenida: ${mergedSnap.totalQuantity}`
    );
  }
  if (mergedSnap.totalValue !== expectedValue) {
    errors.push(
      `Valor esperado: $${expectedValue}, obtenido: $${mergedSnap.totalValue}`
    );
  }

  return { isValid: errors.length === 0, mergedItems, errors };
};
