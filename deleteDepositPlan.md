# Delete Deposits Feature Implementation Plan

## 📋 Analysis Summary

### Current System State

Based on the CLAUDE.md documentation and code analysis, the deposits system has the following characteristics:

**Database Structure** (`deposits` table):

- `depositId`: Primary key (auto-increment)
- `depositCreatedAt`: Timestamp
- `orderId`: Foreign key to orders
- `clientId`: Foreign key to clients
- `paymentMethod`: "Efectivo" or "Plataforma"
- `depositValue`: Total amount paid after this deposit
- `lastDeposit`: Previous total before this transaction
- `newDeposit`: Amount of this specific deposit

**Current Delete Infrastructure**:

- ❌ **Backend Route Issue**: `server/routes/deposits.routes.js:15` has incorrect route definition (GET instead of DELETE)
- ❌ **Database Column Mismatch**: Controller uses `WHERE id = ?` but table uses `depositId` as primary key
- ✅ **Frontend API**: `deleteDepositById()` exists in `deposits.api.js:15-16`
- ✅ **Context Provider**: Delete function exists in `DepositsProvider.jsx:45-53`

**Current Display Components**:

- `DepositsPage.jsx`: Main deposits listing page with date filtering
- `DepositsCard.jsx`: Individual deposit display component
- `CollectOrderForm.jsx`: Shows deposits for specific orders

## 🎯 Feature Requirements

### Business Rules

1. **Cannot delete deposits from paid orders** (`order.paid = 1`)
2. **Deleted deposits must appear crossed out and in different color**
3. **Trash can icon must be placed at the right of columns and be enabled when a deposit can be deleted, and unabled for deleted deposits**
4. **Must maintain audit trail of deleted deposits**

### Technical Constraints

- Must update order.deposit total when deposit is deleted
- Must check if order becomes unpaid after deposit deletion, this cannot happen
- Must prevent deletion if it would create data inconsistency
- Must provide visual feedback for deleted deposits

## 🗃️ Database Schema Changes

### Add Soft Delete Support

```sql
ALTER TABLE deposits ADD COLUMN isDeleted BOOLEAN DEFAULT FALSE;
ALTER TABLE deposits ADD COLUMN deletedAt TIMESTAMP NULL;
ALTER TABLE deposits ADD COLUMN deletedBy VARCHAR(50) NULL;
```

**Rationale**: Use soft delete to maintain audit trail while marking deposits as deleted.

## 🔧 Backend Implementation

### 1. Fix Route Definition

**File**: `server/routes/deposits.routes.js`

```javascript
// Fix line 15 - change from GET to DELETE
router.delete("/deposits/:id", deleteDeposit);
```

### 2. Update Delete Controller

**File**: `server/controllers/deposits.controllers.js`

```javascript
export const deleteDeposit = async (req, res) => {
  const depositId = req.params.id;

  try {
    // Step 1: Get deposit details before deletion
    const [depositResult] = await pool.query(
      "SELECT * FROM deposits WHERE depositId = ? AND isDeleted = FALSE",
      [depositId]
    );

    if (depositResult.length === 0) {
      return res
        .status(404)
        .json({message: "Depósito no encontrado o ya eliminado"});
    }

    const deposit = depositResult[0];

    // Step 2: Check if order is paid - prevent deletion
    const [orderResult] = await pool.query(
      "SELECT paid FROM orders WHERE id = ?",
      [deposit.orderId]
    );

    if (orderResult[0].paid === 1) {
      return res.status(400).json({
        message:
          "No se puede eliminar un depósito de una orden que ya está pagada completamente",
      });
    }

    // Step 3: Soft delete the deposit
    await pool.query(
      "UPDATE deposits SET isDeleted = TRUE, deletedAt = CURRENT_TIMESTAMP WHERE depositId = ?",
      [depositId]
    );

    // Step 4: Recalculate order deposit total
    const [remainingDeposits] = await pool.query(
      "SELECT SUM(newDeposit) as totalRemaining FROM deposits WHERE orderId = ? AND isDeleted = FALSE",
      [deposit.orderId]
    );

    const newDepositTotal = remainingDeposits[0].totalRemaining || 0;

    // Step 5: Update order deposit total and paid status
    await pool.query(
      "UPDATE orders SET deposit = ?, paid = ? WHERE id = ?",
      [newDepositTotal, 0, deposit.orderId] // Always set paid to 0 when deposit is deleted
    );

    res.json({
      message: "Depósito eliminado correctamente",
      newOrderTotal: newDepositTotal,
    });
  } catch (error) {
    return res.status(500).json({message: error.message});
  }
};
```

### 3. Update Get Deposits Queries

**File**: `server/controllers/deposits.controllers.js`

Update all queries to include deleted deposits but mark them appropriately:

```javascript
export const getDeposits = async (req, res) => {
  const [result] = await pool.query(`
        SELECT *,
               CONVERT_TZ(deposits.depositCreatedAt, '+00:00', '-05:00') as depositCreatedAt,
               isDeleted,
               deletedAt
        FROM deposits
        JOIN orders ON orders.id = deposits.orderId
        ORDER BY deposits.depositCreatedAt ASC
    `);
  res.json(result);
};

export const getDepositsByOrder = async (req, res) => {
  try {
    const [result] = await pool.query(
      `
            SELECT *,
                   deposits.paymentMethod as paymentMethod,
                   CONVERT_TZ(deposits.depositCreatedAt, '+00:00', '-05:00') as depositCreatedAt,
                   isDeleted,
                   deletedAt
            FROM deposits
            JOIN orders ON orders.id = deposits.orderId
            WHERE deposits.orderId = ?
            ORDER BY deposits.depositCreatedAt ASC
        `,
      [req.params.id]
    );

    if (result.length === 0)
      return res.status(404).json({message: "No se encontraron depósitos"});
    res.json(result);
  } catch (error) {
    return res.status(500).json({message: error.message});
  }
};

export const getDepositsByDate = async (req, res) => {
  const [result] = await pool.query(
    `
        SELECT orders.id, orders.clientId, orders.items, orders.deposit,
               deposits.paymentMethod, deposits.depositValue, deposits.lastDeposit,
               deposits.newDeposit, deposits.isDeleted, deposits.deletedAt,
               CONVERT_TZ(deposits.depositCreatedAt, '+00:00', '-05:00') as depositCreatedAt,
               clients.clientName, clients.premises, clients.mall
        FROM deposits
        JOIN orders ON orders.id = deposits.orderId
        JOIN clients ON orders.clientId = clients.id
        WHERE DATE(CONVERT_TZ(deposits.depositCreatedAt, '+00:00', '-05:00')) = ?
        ORDER BY orders.clientId, deposits.depositCreatedAt, orders.createdAt ASC
    `,
    [req.params.date]
  );
  res.json(result);
};
```

## 🎨 Frontend Implementation

### 1. Update DepositsCard Component

**File**: `client/src/components/DepositsCard.jsx`

```jsx
import {useOrders} from "../context/OrderProvider";
import {useDeposits} from "../context/DepositsProvider";
import {useNavigate} from "react-router-dom";
import {DollarOutlined, DeleteOutlined} from "@ant-design/icons";
import {calculateOrderTotal} from "../utils/orderUtils";
import {formatDepositDateTime} from "../utils/dateUtils";
import {useState} from "react";
import {Modal, message} from "antd";

function DepositsCard({order}) {
  const navigate = useNavigate();
  const {deleteDepositById, getDepositsByDate} = useDeposits();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteDeposit = async () => {
    // Check if order is paid
    if (order.paid === 1) {
      message.error(
        "No se puede eliminar un depósito de una orden que ya está pagada completamente"
      );
      return;
    }

    Modal.confirm({
      title: "¿Está seguro de eliminar este depósito?",
      content: `Depósito de $${order.newDeposit} - Esta acción no se puede deshacer.`,
      okText: "Eliminar",
      okType: "danger",
      cancelText: "Cancelar",
      onOk: async () => {
        setIsDeleting(true);
        try {
          await deleteDepositById(order.depositId);
          message.success("Depósito eliminado correctamente");
          // Refresh the deposits list
          const currentDate = new Date().toISOString().split("T")[0];
          await getDepositsByDate(currentDate);
        } catch (error) {
          message.error("Error al eliminar el depósito");
          console.error(error);
        } finally {
          setIsDeleting(false);
        }
      },
    });
  };

  const cardStyle = order.isDeleted
    ? "flex bg-red-100 text-gray-500 rounded-md m-2 opacity-60"
    : "flex bg-stone-100 text-black rounded-md m-2";

  const textStyle = order.isDeleted ? "line-through text-red-400" : "";

  return (
    <div className={cardStyle}>
      <span className={textStyle}>{order.createAt}</span>
      <b>
        <p className={`p-2 flex items-center h-content ${textStyle}`}>
          {order.premises} {order.clientName} - {order.mall}/{" "}
          {formatDepositDateTime(order.depositCreatedAt)} ({order.paymentMethod}
          )
          {order.isDeleted && (
            <span className="ml-2 text-red-500">[ELIMINADO]</span>
          )}
        </p>
      </b>
      <div className="flex p-2 ml-auto">
        <b className={textStyle}>
          {order.deposit ? (
            <>
              <p>Abono: ${order.depositValue}</p>
              <p>Abonado Anterior: ${order.lastDeposit}</p>
              <p className="text-red-500">
                Debe: ${calculateOrderTotal(order) - order.newDeposit}
              </p>
            </>
          ) : (
            ""
          )}
        </b>

        <div className="flex gap-2 ml-4">
          {/* Payment button */}
          <button
            className="flex bg-slate-300 px-2 py-1 text-black"
            onClick={() => navigate(`/cobrarOrden/${order.id}`)}
            disabled={order.isDeleted}
          >
            <DollarOutlined />
          </button>

          {/* Delete button */}
          {!order.isDeleted && (
            <button
              className="flex bg-red-300 hover:bg-red-400 px-2 py-1 text-red-800"
              onClick={handleDeleteDeposit}
              disabled={isDeleting || order.paid === 1}
              title={
                order.paid === 1
                  ? "No se puede eliminar - Orden pagada"
                  : "Eliminar depósito"
              }
            >
              <DeleteOutlined />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default DepositsCard;
```

### 2. Update Frontend API

**File**: `client/src/api/deposits.api.js`

```javascript
export const deleteDepositById = async (id) =>
  await axios.delete(`${API_CONFIG.RENDER_SERVER}/deposits/${id}`);
```

### 3. Update DepositsProvider Context

**File**: `client/src/context/DepositsProvider.jsx`

```javascript
const deleteDepositById = async (id) => {
  try {
    const response = await deleteDepositByIdRequest(id);
    return response.data;
  } catch (error) {
    console.error(error);
    throw error;
  }
};
```

### 4. Update CollectOrderForm Deposits Display

**File**: `client/src/pages/CollectOrderForm.jsx`

Add visual indication for deleted deposits in the order payment form:

```jsx
// In the deposits display section, add styling for deleted deposits
{
  deposits.map((deposit, index) => (
    <div
      key={index}
      className={
        deposit.isDeleted ? "opacity-50 line-through text-red-400" : ""
      }
    >
      <p>
        Depósito {index + 1}: ${deposit.newDeposit} ({deposit.paymentMethod}) -{" "}
        {formatDepositDateTime(deposit.depositCreatedAt)}
        {deposit.isDeleted && (
          <span className="text-red-500 ml-2">[ELIMINADO]</span>
        )}
      </p>
    </div>
  ));
}
```

## 🧪 Testing Plan

### Backend Testing

1. **Test Delete Valid Deposit**:

   - Create unpaid order with deposits
   - Delete a deposit via API
   - Verify soft delete (isDeleted = TRUE)
   - Verify order deposit total recalculation

2. **Test Delete from Paid Order**:

   - Create paid order (paid = 1)
   - Attempt to delete deposit
   - Verify 400 error response

3. **Test Delete Non-existent Deposit**:
   - Attempt to delete invalid deposit ID
   - Verify 404 error response

### Frontend Testing

1. **Visual Testing**:

   - Verify trash icon appears on unpaid order deposits
   - Verify trash icon is disabled/hidden on paid order deposits
   - Verify deleted deposits appear crossed out and grayed

2. **Interaction Testing**:
   - Test delete confirmation modal
   - Test successful deletion feedback
   - Test error handling for failed deletions

## 📝 Implementation Checklist

### Database

- [ ] Run migration to add `isDeleted`, `deletedAt`, `deletedBy` columns
- [ ] Update existing deposits to set `isDeleted = FALSE`

### Backend

- [ ] Fix route definition in `deposits.routes.js`
- [ ] Update `deleteDeposit` controller with business logic
- [ ] Update all get queries to include deleted status
- [ ] Test all deposit endpoints

### Frontend

- [ ] Add DeleteOutlined icon import to DepositsCard
- [ ] Implement delete confirmation modal
- [ ] Add visual styling for deleted deposits
- [ ] Update API call to use DELETE method
- [ ] Test user interactions and error handling

### Documentation

- [ ] Update CLAUDE.md to remove "DEPRECATED NOT WORKING" note
- [ ] Add delete feature documentation
- [ ] Update API documentation

## 🚨 Potential Issues & Solutions

### Issue 1: Route Conflict

**Problem**: Line 15 in routes file has GET method conflicting with line 13
**Solution**: Change line 15 to DELETE method and ensure unique routes

### Issue 2: Database Column Mismatch

**Problem**: Controller uses `id` but table uses `depositId`
**Solution**: Update controller to use correct column name

### Issue 3: Order Consistency

**Problem**: Deleting deposits could create inconsistent order states
**Solution**: Always recalculate order totals and reset paid status when deposits are deleted

### Issue 4: User Experience

**Problem**: No visual feedback for delete operations
**Solution**: Implement loading states, confirmation modals, and success/error messages

## 🎯 Success Criteria

1. ✅ Trash can icon appears on all deposits except those from paid orders
2. ✅ Delete confirmation modal appears before deletion
3. ✅ Deleted deposits appear crossed out and grayed
4. ✅ Order deposit totals are recalculated correctly
5. ✅ Paid orders cannot have deposits deleted
6. ✅ Audit trail is maintained (soft delete)
7. ✅ Error handling provides clear feedback to users
8. ✅ All existing functionality continues to work

This implementation plan provides a comprehensive solution for the delete deposits feature while maintaining data integrity and providing excellent user experience.
