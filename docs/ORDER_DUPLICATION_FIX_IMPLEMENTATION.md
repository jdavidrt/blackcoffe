# Order Product Duplication Prevention - Implementation Guide

## Problem Statement

Products are being duplicated or triplicated when added to orders, causing data integrity issues with billing and inventory. This document outlines a comprehensive solution to prevent duplication through state validation and checksum verification.

## Root Cause Analysis

### Identified Duplication Vectors

1. **Double Form Submission**
   - Location: `OrderForm.jsx` lines 193 & 196
   - Issue: Two `window.location.reload()` calls can trigger duplicate submissions
   - Impact: Same order data submitted multiple times

2. **Race Conditions in State Updates**
   - Location: `OrderForm.jsx` lines 44-54 (handleAddToCart)
   - Issue: Rapid clicking on "+" button before state updates complete
   - Impact: Multiple additions of same product before cart state stabilizes

3. **Merge Logic for Unpaid Orders**
   - Location: `OrderForm.jsx` lines 172-190
   - Issue: If called multiple times, could re-merge already merged items
   - Impact: Quantities doubled/tripled on subsequent saves

4. **No Backend Validation**
   - Location: `orders.controllers.js` lines 170-198 (updateOrder)
   - Issue: Backend accepts any data without validation
   - Impact: Duplicate data gets persisted to database without checks

## Solution Architecture

### Three-Layer Defense Strategy

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: Client-Side Pre-Submit Validation                 │
│ - Calculate expected cart total before submission           │
│ - Store cart snapshot for comparison                        │
│ - Validate cart integrity before allowing submission        │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 2: Client-Side Post-Submit Verification              │
│ - Verify database response matches expected values          │
│ - Retry with exponential backoff if mismatch detected       │
│ - Alert user if validation fails after max retries          │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 3: Server-Side Validation (Optional Enhancement)     │
│ - Validate item count and total value server-side           │
│ - Reject updates that show suspicious duplication patterns  │
│ - Return detailed error messages for debugging              │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Plan

### Phase 1: Client-Side Pre-Submit Validation (HIGH PRIORITY)

#### Step 1.1: Create Order Validation Utility

**File**: `client/src/utils/orderValidation.js`

```javascript
/**
 * Order Validation Utility
 * Prevents product duplication by validating cart state before submission
 */

/**
 * Create a snapshot of the current cart for validation
 * @param {Array} cart - Current cart items
 * @returns {Object} Snapshot with validation data
 */
export const createCartSnapshot = (cart) => {
  const snapshot = {
    timestamp: new Date().toISOString(),
    itemCount: cart.length,
    totalQuantity: cart.reduce((sum, item) => sum + item.quantity, 0),
    totalValue: cart.reduce((sum, item) => sum + (item.unitValue * item.quantity), 0),
    uniqueProductIds: [...new Set(cart.map(item => item.id))],
    items: cart.map(item => ({
      id: item.id,
      productName: item.productName,
      quantity: item.quantity,
      unitValue: item.unitValue,
      total: item.unitValue * item.quantity
    }))
  };

  // Generate checksum for integrity verification
  snapshot.checksum = generateChecksum(snapshot);

  return snapshot;
};

/**
 * Generate a simple checksum for cart validation
 * @param {Object} snapshot - Cart snapshot object
 * @returns {string} Checksum string
 */
const generateChecksum = (snapshot) => {
  const data = `${snapshot.itemCount}-${snapshot.totalQuantity}-${snapshot.totalValue}`;
  // Simple checksum - can be enhanced with crypto hash if needed
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16);
};

/**
 * Validate that cart hasn't been corrupted during processing
 * @param {Array} currentCart - Current cart state
 * @param {Object} snapshot - Previously created snapshot
 * @returns {Object} Validation result
 */
export const validateCartAgainstSnapshot = (currentCart, snapshot) => {
  const currentSnapshot = createCartSnapshot(currentCart);

  const validation = {
    isValid: true,
    errors: [],
    warnings: [],
    currentSnapshot,
    originalSnapshot: snapshot
  };

  // Check item count
  if (currentSnapshot.itemCount !== snapshot.itemCount) {
    validation.isValid = false;
    validation.errors.push({
      type: 'ITEM_COUNT_MISMATCH',
      message: `Item count changed from ${snapshot.itemCount} to ${currentSnapshot.itemCount}`,
      expected: snapshot.itemCount,
      actual: currentSnapshot.itemCount
    });
  }

  // Check total quantity
  if (currentSnapshot.totalQuantity !== snapshot.totalQuantity) {
    validation.isValid = false;
    validation.errors.push({
      type: 'QUANTITY_MISMATCH',
      message: `Total quantity changed from ${snapshot.totalQuantity} to ${currentSnapshot.totalQuantity}`,
      expected: snapshot.totalQuantity,
      actual: currentSnapshot.totalQuantity
    });
  }

  // Check total value
  if (currentSnapshot.totalValue !== snapshot.totalValue) {
    validation.isValid = false;
    validation.errors.push({
      type: 'VALUE_MISMATCH',
      message: `Total value changed from ${snapshot.totalValue} to ${currentSnapshot.totalValue}`,
      expected: snapshot.totalValue,
      actual: currentSnapshot.totalValue
    });
  }

  // Check for duplicate product IDs (primary duplication detection)
  const duplicateIds = findDuplicateIds(currentCart);
  if (duplicateIds.length > 0) {
    validation.isValid = false;
    validation.errors.push({
      type: 'DUPLICATE_PRODUCTS',
      message: `Duplicate product IDs detected: ${duplicateIds.join(', ')}`,
      duplicates: duplicateIds
    });
  }

  // Check checksum
  if (currentSnapshot.checksum !== snapshot.checksum) {
    validation.warnings.push({
      type: 'CHECKSUM_MISMATCH',
      message: 'Cart data integrity checksum mismatch',
      expected: snapshot.checksum,
      actual: currentSnapshot.checksum
    });
  }

  return validation;
};

/**
 * Find duplicate product IDs in cart
 * @param {Array} cart - Cart items
 * @returns {Array} Array of duplicate product IDs
 */
const findDuplicateIds = (cart) => {
  const idCounts = {};
  const duplicates = [];

  cart.forEach(item => {
    idCounts[item.id] = (idCounts[item.id] || 0) + 1;
  });

  Object.keys(idCounts).forEach(id => {
    if (idCounts[id] > 1) {
      duplicates.push(id);
    }
  });

  return duplicates;
};

/**
 * Merge new items with existing order items (for unpaid order updates)
 * Validates against duplication during merge
 * @param {Array} newItems - New items to add
 * @param {Array} existingItems - Existing order items
 * @returns {Object} Merge result with validation
 */
export const safeMergeOrderItems = (newItems, existingItems) => {
  // Create snapshots
  const newSnapshot = createCartSnapshot(newItems);
  const existingSnapshot = createCartSnapshot(existingItems);

  // Expected merged totals
  const expectedTotalQuantity = newSnapshot.totalQuantity + existingSnapshot.totalQuantity;
  const expectedTotalValue = newSnapshot.totalValue + existingSnapshot.totalValue;

  // Perform merge (existing logic from OrderForm.jsx lines 175-187)
  const mergedJson = newItems.concat(existingItems);
  const idMap = {};

  mergedJson.forEach((item) => {
    const { id, quantity } = item;
    if (idMap[id]) {
      // If ID exists, sum quantities
      idMap[id].quantity += quantity;
    } else {
      // If ID doesn't exist, add to map
      idMap[id] = { ...item };
    }
  });

  const mergedItems = Object.values(idMap);
  const mergedSnapshot = createCartSnapshot(mergedItems);

  // Validate merge result
  const validation = {
    isValid: true,
    errors: [],
    mergedItems,
    mergedSnapshot,
    expectedTotals: {
      quantity: expectedTotalQuantity,
      value: expectedTotalValue
    }
  };

  // Validate total quantity
  if (mergedSnapshot.totalQuantity !== expectedTotalQuantity) {
    validation.isValid = false;
    validation.errors.push({
      type: 'MERGE_QUANTITY_MISMATCH',
      message: `Merged quantity ${mergedSnapshot.totalQuantity} doesn't match expected ${expectedTotalQuantity}`,
      expected: expectedTotalQuantity,
      actual: mergedSnapshot.totalQuantity
    });
  }

  // Validate total value
  if (mergedSnapshot.totalValue !== expectedTotalValue) {
    validation.isValid = false;
    validation.errors.push({
      type: 'MERGE_VALUE_MISMATCH',
      message: `Merged value ${mergedSnapshot.totalValue} doesn't match expected ${expectedTotalValue}`,
      expected: expectedTotalValue,
      actual: mergedSnapshot.totalValue
    });
  }

  return validation;
};

/**
 * Validate order items after database update
 * @param {Object} orderResponse - Response from database
 * @param {Object} expectedSnapshot - Expected cart snapshot
 * @returns {Object} Validation result
 */
export const validateOrderResponse = (orderResponse, expectedSnapshot) => {
  // Parse items from response
  const responseItems = typeof orderResponse.items === 'string'
    ? JSON.parse(orderResponse.items)
    : orderResponse.items;

  const responseSnapshot = createCartSnapshot(responseItems);

  return validateCartAgainstSnapshot(responseItems, expectedSnapshot);
};
```

#### Step 1.2: Update OrderForm.jsx with Validation

**File**: `client/src/pages/OrderForm.jsx`

Add these changes:

```javascript
// Add import at top (after line 11)
import {
  createCartSnapshot,
  validateCartAgainstSnapshot,
  safeMergeOrderItems,
  validateOrderResponse
} from '../utils/orderValidation';

// Add state for validation (after line 21)
const [cartSnapshot, setCartSnapshot] = useState(null);
const [isValidating, setIsValidating] = useState(false);
const [validationErrors, setValidationErrors] = useState([]);

// Update handleAddToCart function (replace lines 44-54)
const handleAddToCart = (product) => {
  const existingProduct = cart.find((item) => item.id === product.id);

  if (existingProduct) {
    const updatedCart = cart.map((item) =>
      item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
    );
    setCart(updatedCart);
  } else {
    setCart([...cart, { ...product, quantity: 1, delivered: false, deliveredAt: "" }]);
  }

  // Clear previous snapshot when cart is modified
  setCartSnapshot(null);
  setValidationErrors([]);
};

// Add validation before submit (modify onSubmit at line 163)
onSubmit={async (values, actions) => {
  try {
    // VALIDATION STEP 1: Create snapshot before any processing
    console.log('[ORDER_VALIDATION] Creating cart snapshot before submit');
    const preSubmitSnapshot = createCartSnapshot(cart);
    setCartSnapshot(preSubmitSnapshot);

    console.log('[ORDER_VALIDATION] Pre-submit snapshot:', preSubmitSnapshot);

    // VALIDATION STEP 2: Validate cart integrity
    const cartValidation = validateCartAgainstSnapshot(cart, preSubmitSnapshot);

    if (!cartValidation.isValid) {
      console.error('[ORDER_VALIDATION] Cart validation FAILED:', cartValidation.errors);
      setValidationErrors(cartValidation.errors);

      alert(
        `⚠️ ERROR DE VALIDACIÓN ⚠️\n\n` +
        `Se detectaron problemas con los productos:\n\n` +
        cartValidation.errors.map(e => `• ${e.message}`).join('\n') +
        `\n\nPor favor, revisa el pedido y vuelve a intentarlo.`
      );

      actions.setSubmitting(false);
      return; // STOP submission
    }

    // VALIDATION STEP 3: Prepare values
    values.shopId = 1;
    values.clientId = client;
    getUnPaidOrdersbyClient(client);

    // VALIDATION STEP 4: Handle different submission scenarios
    if (params.id) {
      // EDITING EXISTING ORDER
      console.log('[ORDER_VALIDATION] Editing existing order:', params.id);

      values.items = JSON.stringify(cart);
      delete values.clientName;
      delete values.premises;

      // Validate before update
      const finalValidation = validateCartAgainstSnapshot(cart, preSubmitSnapshot);
      if (!finalValidation.isValid) {
        throw new Error('Final validation failed: ' + finalValidation.errors.map(e => e.message).join(', '));
      }

      await updateOrder(params.id, values);

    } else if (unPaidOrder) {
      // MERGING WITH UNPAID ORDER
      console.log('[ORDER_VALIDATION] Merging with unpaid order:', unPaidOrder.id);

      const newItems = cart;
      const existingItems = safeJSONParse(unPaidOrder.items, []);

      // Use safe merge with validation
      const mergeResult = safeMergeOrderItems(newItems, existingItems);

      if (!mergeResult.isValid) {
        console.error('[ORDER_VALIDATION] Merge validation FAILED:', mergeResult.errors);

        alert(
          `⚠️ ERROR AL COMBINAR PEDIDOS ⚠️\n\n` +
          `Se detectaron problemas al combinar los productos:\n\n` +
          mergeResult.errors.map(e => `• ${e.message}`).join('\n') +
          `\n\nEsperado: Cantidad=${mergeResult.expectedTotals.quantity}, Valor=$${mergeResult.expectedTotals.value}\n` +
          `Obtenido: Cantidad=${mergeResult.mergedSnapshot.totalQuantity}, Valor=$${mergeResult.mergedSnapshot.totalValue}\n\n` +
          `Por favor, vuelve a intentarlo.`
        );

        actions.setSubmitting(false);
        return; // STOP submission
      }

      console.log('[ORDER_VALIDATION] Merge successful:', mergeResult.mergedSnapshot);

      values.items = JSON.stringify(mergeResult.mergedItems);
      setCart(mergeResult.mergedItems);

      await updateOrder(unPaidOrder.id, values);

    } else {
      // CREATING NEW ORDER
      console.log('[ORDER_VALIDATION] Creating new order');

      values.items = JSON.stringify(cart);

      // Final validation before create
      const finalValidation = validateCartAgainstSnapshot(cart, preSubmitSnapshot);
      if (!finalValidation.isValid) {
        throw new Error('Final validation failed: ' + finalValidation.errors.map(e => e.message).join(', '));
      }

      await createOrder(values);
    }

    console.log('[ORDER_VALIDATION] Order submitted successfully');

    // Navigate and reload (but only ONCE)
    navigate("/nuevaOrden");
    window.location.reload(); // Remove duplicate reload at line 196

  } catch (error) {
    console.error('[ORDER_VALIDATION] Submission error:', error);

    alert(
      `❌ ERROR AL GUARDAR EL PEDIDO ❌\n\n` +
      `${error.message}\n\n` +
      `Por favor, vuelve a intentarlo.`
    );

    actions.setSubmitting(false);
  }
}}
```

#### Step 1.3: Add Visual Feedback in OrderForm

Add validation error display in the form (after line 207):

```javascript
{/* Add this after the form header, before the total value */}
{validationErrors.length > 0 && (
  <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
    <p className="font-bold">⚠️ Errores de Validación:</p>
    <ul className="list-disc list-inside">
      {validationErrors.map((error, index) => (
        <li key={index}>{error.message}</li>
      ))}
    </ul>
  </div>
)}

{cartSnapshot && (
  <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-2 rounded mb-4 text-sm">
    <p className="font-bold">✓ Validación de Pedido:</p>
    <p>Productos: {cartSnapshot.itemCount} | Cantidad total: {cartSnapshot.totalQuantity} | Valor: ${cartSnapshot.totalValue}</p>
  </div>
)}
```

### Phase 2: Server-Side Validation (RECOMMENDED)

#### Step 2.1: Create Server Validation Utility

**File**: `server/utils/orderValidation.js`

```javascript
/**
 * Server-side order validation utility
 * Validates order data before persisting to database
 */

/**
 * Validate order items for duplication and integrity
 * @param {string|Array} items - Order items (JSON string or array)
 * @returns {Object} Validation result
 */
export const validateOrderItems = (items) => {
  const validation = {
    isValid: true,
    errors: [],
    warnings: [],
    stats: {}
  };

  try {
    // Parse items if string
    const parsedItems = typeof items === 'string' ? JSON.parse(items) : items;

    if (!Array.isArray(parsedItems)) {
      validation.isValid = false;
      validation.errors.push({
        type: 'INVALID_FORMAT',
        message: 'Items must be an array'
      });
      return validation;
    }

    // Calculate statistics
    validation.stats = {
      itemCount: parsedItems.length,
      totalQuantity: parsedItems.reduce((sum, item) => sum + (item.quantity || 0), 0),
      totalValue: parsedItems.reduce((sum, item) => sum + ((item.unitValue || 0) * (item.quantity || 0)), 0),
      uniqueIds: [...new Set(parsedItems.map(item => item.id))].length
    };

    // Check for duplicate IDs
    const idCounts = {};
    parsedItems.forEach(item => {
      idCounts[item.id] = (idCounts[item.id] || 0) + 1;
    });

    const duplicateIds = Object.keys(idCounts).filter(id => idCounts[id] > 1);

    if (duplicateIds.length > 0) {
      validation.isValid = false;
      validation.errors.push({
        type: 'DUPLICATE_IDS',
        message: `Duplicate product IDs found: ${duplicateIds.join(', ')}`,
        duplicates: duplicateIds.map(id => ({
          id,
          count: idCounts[id]
        }))
      });
    }

    // Check for missing required fields
    const invalidItems = parsedItems.filter(item =>
      !item.id ||
      !item.productName ||
      typeof item.quantity !== 'number' ||
      typeof item.unitValue !== 'number'
    );

    if (invalidItems.length > 0) {
      validation.isValid = false;
      validation.errors.push({
        type: 'INVALID_ITEMS',
        message: `${invalidItems.length} items have missing or invalid required fields`,
        invalidItems: invalidItems.map(item => item.id || 'unknown')
      });
    }

    // Check for suspicious patterns (quantities too high)
    const suspiciousItems = parsedItems.filter(item => item.quantity > 100);

    if (suspiciousItems.length > 0) {
      validation.warnings.push({
        type: 'HIGH_QUANTITY',
        message: `${suspiciousItems.length} items have unusually high quantities (>100)`,
        items: suspiciousItems.map(item => ({
          id: item.id,
          productName: item.productName,
          quantity: item.quantity
        }))
      });
    }

  } catch (error) {
    validation.isValid = false;
    validation.errors.push({
      type: 'PARSE_ERROR',
      message: `Failed to parse items: ${error.message}`
    });
  }

  return validation;
};

/**
 * Compare expected values with actual order data
 * @param {Object} orderData - Order data from client
 * @param {Object} expectedValues - Expected values from client snapshot
 * @returns {Object} Validation result
 */
export const validateExpectedValues = (orderData, expectedValues) => {
  const validation = {
    isValid: true,
    errors: [],
    comparison: {}
  };

  if (!expectedValues) {
    // If no expected values provided, skip validation
    return validation;
  }

  const itemValidation = validateOrderItems(orderData.items);

  if (!itemValidation.isValid) {
    validation.isValid = false;
    validation.errors.push(...itemValidation.errors);
    return validation;
  }

  const stats = itemValidation.stats;

  // Compare expected vs actual values
  if (expectedValues.totalQuantity && stats.totalQuantity !== expectedValues.totalQuantity) {
    validation.isValid = false;
    validation.errors.push({
      type: 'QUANTITY_MISMATCH',
      message: `Total quantity mismatch: expected ${expectedValues.totalQuantity}, got ${stats.totalQuantity}`,
      expected: expectedValues.totalQuantity,
      actual: stats.totalQuantity
    });
  }

  if (expectedValues.totalValue && stats.totalValue !== expectedValues.totalValue) {
    validation.isValid = false;
    validation.errors.push({
      type: 'VALUE_MISMATCH',
      message: `Total value mismatch: expected ${expectedValues.totalValue}, got ${stats.totalValue}`,
      expected: expectedValues.totalValue,
      actual: stats.totalValue
    });
  }

  if (expectedValues.itemCount && stats.itemCount !== expectedValues.itemCount) {
    validation.isValid = false;
    validation.errors.push({
      type: 'ITEM_COUNT_MISMATCH',
      message: `Item count mismatch: expected ${expectedValues.itemCount}, got ${stats.itemCount}`,
      expected: expectedValues.itemCount,
      actual: stats.itemCount
    });
  }

  validation.comparison = {
    expected: expectedValues,
    actual: stats
  };

  return validation;
};
```

#### Step 2.2: Update Server Controller

**File**: `server/controllers/orders.controllers.js`

```javascript
// Add import at top
import { validateOrderItems, validateExpectedValues } from '../utils/orderValidation.js';

// Update createOrder function (replace lines 153-168)
export const createOrder = async (req, res) => {
  try {
    const { shopId, clientId, items, expectedSnapshot } = req.body;

    console.log(`[${new Date().toISOString()}] createOrder - Creating order for client ${clientId}`);

    // VALIDATION: Validate order items
    const itemValidation = validateOrderItems(items);

    if (!itemValidation.isValid) {
      console.error(`[${new Date().toISOString()}] createOrder - Validation FAILED:`, itemValidation.errors);
      return res.status(400).json({
        success: false,
        message: 'Order validation failed',
        errors: itemValidation.errors,
        warnings: itemValidation.warnings
      });
    }

    // VALIDATION: Check expected values if provided
    if (expectedSnapshot) {
      const expectedValidation = validateExpectedValues(req.body, expectedSnapshot);

      if (!expectedValidation.isValid) {
        console.error(`[${new Date().toISOString()}] createOrder - Expected values validation FAILED:`, expectedValidation.errors);
        return res.status(400).json({
          success: false,
          message: 'Order values do not match expected values',
          errors: expectedValidation.errors,
          comparison: expectedValidation.comparison
        });
      }
    }

    // Log validation success
    console.log(`[${new Date().toISOString()}] createOrder - Validation passed:`, itemValidation.stats);

    if (itemValidation.warnings.length > 0) {
      console.warn(`[${new Date().toISOString()}] createOrder - Warnings:`, itemValidation.warnings);
    }

    // Insert order
    const result = await pool.query(
      "INSERT INTO orders(shopId, clientId, items) VALUES (?, ?, ?)",
      [shopId, clientId, items]
    );

    console.log(`[${new Date().toISOString()}] createOrder - Order created successfully, ID: ${result[0].insertId}`);

    res.json({
      success: true,
      message: 'Order created successfully',
      orderId: result[0].insertId,
      validation: {
        stats: itemValidation.stats,
        warnings: itemValidation.warnings
      },
      data: {
        shopId,
        clientId,
        items
      }
    });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] createOrder - ERROR:`, error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Update updateOrder function (replace lines 170-198)
export const updateOrder = async (req, res) => {
  try {
    const orderId = req.params.id;
    console.log(`[${new Date().toISOString()}] updateOrder - Order ID: ${orderId}`);
    console.log(`[${new Date().toISOString()}] updateOrder - Update data:`, req.body);

    // VALIDATION: If items are being updated, validate them
    if (req.body.items) {
      const itemValidation = validateOrderItems(req.body.items);

      if (!itemValidation.isValid) {
        console.error(`[${new Date().toISOString()}] updateOrder - Validation FAILED:`, itemValidation.errors);
        return res.status(400).json({
          success: false,
          message: 'Order items validation failed',
          errors: itemValidation.errors,
          warnings: itemValidation.warnings
        });
      }

      // VALIDATION: Check expected values if provided
      if (req.body.expectedSnapshot) {
        const expectedValidation = validateExpectedValues(req.body, req.body.expectedSnapshot);

        if (!expectedValidation.isValid) {
          console.error(`[${new Date().toISOString()}] updateOrder - Expected values validation FAILED:`, expectedValidation.errors);
          return res.status(400).json({
            success: false,
            message: 'Order values do not match expected values',
            errors: expectedValidation.errors,
            comparison: expectedValidation.comparison
          });
        }
      }

      console.log(`[${new Date().toISOString()}] updateOrder - Validation passed:`, itemValidation.stats);

      if (itemValidation.warnings.length > 0) {
        console.warn(`[${new Date().toISOString()}] updateOrder - Warnings:`, itemValidation.warnings);
      }

      // Remove expectedSnapshot from update data (don't save to DB)
      delete req.body.expectedSnapshot;
    }

    const result = await pool.query("UPDATE orders SET ? WHERE id = ?", [
      req.body,
      orderId
    ]);

    console.log(`[${new Date().toISOString()}] updateOrder - Update result:`, {
      affectedRows: result[0].affectedRows,
      changedRows: result[0].changedRows
    });

    res.json({
      success: true,
      message: 'Order updated successfully',
      affectedRows: result[0].affectedRows,
      changedRows: result[0].changedRows
    });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] updateOrder - ERROR:`, error);
    console.error(`[${new Date().toISOString()}] updateOrder - Error details:`, {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sqlMessage: error.sqlMessage
    });
    return res.status(500).json({
      success: false,
      message: error.message,
      sqlMessage: error.sqlMessage
    });
  }
};
```

#### Step 2.3: Update Client to Send Expected Values

**File**: `client/src/context/OrderProvider.jsx`

```javascript
// Update createOrder function to include snapshot
const createOrder = async (order, snapshot = null) => {
  try {
    // Include expected snapshot if provided
    const orderData = snapshot
      ? { ...order, expectedSnapshot: snapshot }
      : order;

    const res = await createOrderRequest(orderData);

    // Validate response if snapshot was provided
    if (snapshot && res.data.validation) {
      console.log('[ORDER_PROVIDER] Order created with validation:', res.data.validation);
    }

    setOrders([...orders, res.data]);
  } catch (error) {
    console.error('[ORDER_PROVIDER] Error creating order:', error);

    // If validation error from server, throw with details
    if (error.response && error.response.data && !error.response.data.success) {
      throw new Error(
        error.response.data.message +
        (error.response.data.errors ? '\n' + error.response.data.errors.map(e => e.message).join('\n') : '')
      );
    }

    throw error;
  }
};

// Update updateOrder function similarly
const updateOrder = async (id, order, snapshot = null) => {
  try {
    // Include expected snapshot if provided
    const orderData = snapshot
      ? { ...order, expectedSnapshot: snapshot }
      : order;

    const res = await updateOrderRequest(id, orderData);

    // Validate response if snapshot was provided
    if (snapshot && res.data.validation) {
      console.log('[ORDER_PROVIDER] Order updated with validation:', res.data.validation);
    }
  } catch (error) {
    console.error('[ORDER_PROVIDER] Error updating order:', error);

    // If validation error from server, throw with details
    if (error.response && error.response.data && !error.response.data.success) {
      throw new Error(
        error.response.data.message +
        (error.response.data.errors ? '\n' + error.response.data.errors.map(e => e.message).join('\n') : '')
      );
    }

    throw error;
  }
};
```

#### Step 2.4: Update OrderForm to Pass Snapshot to Server

In `OrderForm.jsx`, modify the create/update calls:

```javascript
// For creating new order (around line 192)
await createOrder(values, preSubmitSnapshot);

// For updating existing order (around line 171)
await updateOrder(params.id, values, preSubmitSnapshot);

// For merging with unpaid order (around line 190)
await updateOrder(unPaidOrder.id, values, mergeResult.mergedSnapshot);
```

### Phase 3: Retry Logic with Exponential Backoff (ADVANCED)

#### Step 3.1: Create Retry Utility

**File**: `client/src/utils/retryUtils.js`

```javascript
/**
 * Retry utility with exponential backoff
 * Used when order submission validation fails
 */

/**
 * Execute function with retry logic
 * @param {Function} fn - Async function to execute
 * @param {Object} options - Retry options
 * @returns {Promise} Result of function execution
 */
export const retryWithBackoff = async (fn, options = {}) => {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffMultiplier = 2,
    onRetry = null
  } = options;

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[RETRY] Attempt ${attempt + 1}/${maxRetries + 1}`);

      const result = await fn();

      console.log(`[RETRY] Success on attempt ${attempt + 1}`);
      return result;

    } catch (error) {
      lastError = error;

      console.error(`[RETRY] Attempt ${attempt + 1} failed:`, error.message);

      // If this was the last attempt, throw error
      if (attempt === maxRetries) {
        console.error(`[RETRY] All ${maxRetries + 1} attempts failed`);
        throw error;
      }

      // Calculate delay for next retry
      const delay = Math.min(
        initialDelay * Math.pow(backoffMultiplier, attempt),
        maxDelay
      );

      console.log(`[RETRY] Waiting ${delay}ms before retry...`);

      // Call onRetry callback if provided
      if (onRetry) {
        onRetry(attempt + 1, maxRetries + 1, delay, error);
      }

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
};

/**
 * Validate and retry order submission
 * @param {Function} submitFn - Order submission function
 * @param {Object} expectedSnapshot - Expected cart snapshot
 * @param {Object} options - Retry options
 * @returns {Promise} Submission result
 */
export const validateAndRetrySubmission = async (submitFn, expectedSnapshot, options = {}) => {
  const {
    maxRetries = 2,
    onValidationFailed = null
  } = options;

  return retryWithBackoff(
    async () => {
      // Execute submission
      const result = await submitFn();

      // If result includes validation data, check it
      if (result && result.validation && expectedSnapshot) {
        const { stats } = result.validation;

        // Check if values match expected
        if (
          stats.totalQuantity !== expectedSnapshot.totalQuantity ||
          stats.totalValue !== expectedSnapshot.totalValue ||
          stats.itemCount !== expectedSnapshot.itemCount
        ) {
          const error = new Error('Validation failed after submission');
          error.validationMismatch = {
            expected: expectedSnapshot,
            actual: stats
          };

          if (onValidationFailed) {
            onValidationFailed(error.validationMismatch);
          }

          throw error;
        }
      }

      return result;
    },
    {
      maxRetries,
      initialDelay: 500,
      maxDelay: 2000,
      backoffMultiplier: 2,
      onRetry: (attempt, maxAttempts, delay, error) => {
        console.log(`[VALIDATION_RETRY] Retrying submission (${attempt}/${maxAttempts}) after ${delay}ms due to: ${error.message}`);
      }
    }
  );
};
```

## Testing Strategy

### Manual Testing Checklist

1. **Normal Order Creation**
   - [ ] Create order with single product
   - [ ] Create order with multiple products
   - [ ] Verify quantities are correct in database
   - [ ] Verify total value is correct

2. **Rapid Clicking Test**
   - [ ] Rapidly click "+" button multiple times
   - [ ] Verify quantity increments correctly (no duplicates)
   - [ ] Submit order and verify database

3. **Order Editing**
   - [ ] Edit existing order and add products
   - [ ] Verify existing products preserved
   - [ ] Verify new products added correctly
   - [ ] Verify no duplication occurred

4. **Unpaid Order Merge**
   - [ ] Create order for client with existing unpaid order
   - [ ] Verify merge happens correctly
   - [ ] Verify quantities summed correctly
   - [ ] Verify no product duplication

5. **Validation Error Cases**
   - [ ] Trigger validation error (manually modify cart state)
   - [ ] Verify error message displayed
   - [ ] Verify order not submitted
   - [ ] Verify user can fix and resubmit

6. **Server-Side Validation**
   - [ ] Send malformed data to server
   - [ ] Verify server rejects invalid data
   - [ ] Verify error message returned to client

### Automated Testing (Future Enhancement)

```javascript
// Example test cases (Jest + React Testing Library)

describe('Order Product Duplication Prevention', () => {
  test('should detect duplicate products in cart', () => {
    const cart = [
      { id: '1', quantity: 2, unitValue: 100 },
      { id: '1', quantity: 3, unitValue: 100 }, // Duplicate!
    ];

    const snapshot = createCartSnapshot(cart);
    const validation = validateCartAgainstSnapshot(cart, snapshot);

    expect(validation.isValid).toBe(false);
    expect(validation.errors).toContainEqual(
      expect.objectContaining({ type: 'DUPLICATE_PRODUCTS' })
    );
  });

  test('should validate merge correctly', () => {
    const newItems = [{ id: '1', quantity: 2, unitValue: 100 }];
    const existingItems = [{ id: '1', quantity: 3, unitValue: 100 }];

    const result = safeMergeOrderItems(newItems, existingItems);

    expect(result.isValid).toBe(true);
    expect(result.mergedItems).toHaveLength(1);
    expect(result.mergedItems[0].quantity).toBe(5);
  });
});
```

## Deployment Checklist

### Phase 1 Deployment (Client-Side Only)

1. **Pre-Deployment**
   - [ ] Create `client/src/utils/orderValidation.js`
   - [ ] Update `client/src/pages/OrderForm.jsx`
   - [ ] Test thoroughly in development
   - [ ] Build frontend: `cd client && npm run build`
   - [ ] Test build: Verify no errors

2. **Deployment**
   - [ ] Commit changes with descriptive message
   - [ ] Push to repository
   - [ ] Deploy to production
   - [ ] Monitor for errors

3. **Post-Deployment**
   - [ ] Test order creation in production
   - [ ] Test order editing in production
   - [ ] Monitor user reports
   - [ ] Check console logs for validation errors

### Phase 2 Deployment (Server-Side Validation)

1. **Pre-Deployment**
   - [ ] Create `server/utils/orderValidation.js`
   - [ ] Update `server/controllers/orders.controllers.js`
   - [ ] Update `client/src/context/OrderProvider.jsx`
   - [ ] Update `client/src/pages/OrderForm.jsx` to pass snapshots
   - [ ] Test thoroughly in development
   - [ ] Build frontend: `cd client && npm run build`

2. **Deployment**
   - [ ] Commit changes
   - [ ] Push to repository
   - [ ] Restart backend server
   - [ ] Deploy frontend
   - [ ] Monitor for errors

3. **Post-Deployment**
   - [ ] Test all order operations
   - [ ] Verify server validation working
   - [ ] Check server logs for validation events
   - [ ] Monitor error rates

## Monitoring and Maintenance

### Key Metrics to Track

1. **Validation Failures**
   - Track how often validation fails
   - Identify patterns in failures
   - Investigate root causes

2. **Order Data Integrity**
   - Run weekly query to check for duplicate product IDs
   - Monitor suspicious high quantities
   - Alert on anomalies

3. **User Experience**
   - Track order submission success rate
   - Monitor average submission time
   - Collect user feedback

### Database Health Check Query

```sql
-- Check for orders with duplicate product IDs in items JSON
SELECT
  id,
  clientId,
  items,
  createdAt
FROM orders
WHERE id IN (
  SELECT id FROM orders
  WHERE JSON_LENGTH(items) > (
    SELECT COUNT(DISTINCT JSON_EXTRACT(value, '$.id'))
    FROM JSON_TABLE(items, '$[*]' COLUMNS (value JSON PATH '$')) AS jt
  )
);
```

## Rollback Plan

If issues occur after deployment:

1. **Immediate Rollback**
   ```bash
   git revert <commit-hash>
   git push origin <branch>
   cd client && npm run build
   # Redeploy
   ```

2. **Partial Rollback**
   - If only client-side issues: Rollback `OrderForm.jsx`
   - If only server-side issues: Rollback `orders.controllers.js`

3. **Data Recovery**
   - If duplicate orders created: Use cleanup script
   - If orders lost: Restore from database backup

## Future Enhancements

1. **Advanced Duplicate Detection**
   - ML-based anomaly detection
   - Pattern recognition for unusual orders

2. **Real-time Validation**
   - WebSocket-based validation
   - Server validates as user adds products

3. **Audit Trail**
   - Log all validation events
   - Track validation failure patterns
   - Generate reports

4. **Automated Testing**
   - Unit tests for validation functions
   - Integration tests for order flow
   - E2E tests for critical paths

## Questions for Implementation

Please answer these to finalize the implementation:

1. **Where does duplication occur?**
   - [ ] During new order creation (`/nuevaOrden`)
   - [ ] During order editing (`/editarOrden/:id`)
   - [ ] During order merging (unpaid order scenario)
   - [ ] All of the above

2. **Validation approach preference:**
   - [ ] Client-side only (Phase 1)
   - [ ] Client + Server (Phase 1 + 2)
   - [ ] Full solution with retry logic (All phases)

3. **Retry behavior:**
   - [ ] Automatic retry with exponential backoff
   - [ ] Show error and let user retry manually
   - [ ] Combination (auto-retry limited times, then manual)

4. **Urgency:**
   - [ ] Critical - implement immediately
   - [ ] High - implement within days
   - [ ] Medium - implement within weeks

5. **Current symptoms:**
   - [ ] Duplicates appear immediately in UI
   - [ ] Duplicates only appear after page refresh
   - [ ] Quantities get multiplied (2x, 3x)
   - [ ] Completely duplicate products appear
   - [ ] Other: _______________

## Summary

This implementation provides a comprehensive three-layer defense against product duplication:

1. **Client-Side Pre-Submit Validation**: Prevents bad data from being sent
2. **Server-Side Validation**: Rejects invalid data at the database layer
3. **Retry Logic**: Handles transient failures gracefully

**Benefits:**
- ✅ Prevents duplicate products from being saved
- ✅ Validates cart integrity before submission
- ✅ Detects and blocks suspicious data patterns
- ✅ Provides clear error messages to users
- ✅ Maintains audit trail for debugging
- ✅ Gracefully handles failures with retry logic

**Implementation Time:**
- Phase 1 (Client-side): 2-4 hours
- Phase 2 (Server-side): 2-3 hours
- Phase 3 (Retry logic): 1-2 hours
- Total: 5-9 hours

Once you answer the questions above, we can proceed with implementation in the order that best fits your needs!
