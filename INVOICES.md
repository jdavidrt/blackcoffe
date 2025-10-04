# INVOICES.md - Payment Information Enhancement

## 📄 Overview

This document describes the implementation plan for adding comprehensive payment information to both invoice views in the BlackCoffe system. The enhancement will display current payment status, total payments received, and remaining debt directly on invoices.

## 🎯 Objective

Add payment tracking information to both invoice interfaces:
- **`Invoice.jsx`** - PDF/Printable invoice for internal use (`/pdfOrden/:id`)
- **`PublicInvoice.jsx`** - Public-facing invoice view (`/factura/:id`)

## 📊 Payment Information to Display

### Core Payment Data
1. **Order Total** - Total amount of the order (already calculated)
2. **Total Paid** - Sum of all active deposits (`order.deposit` field)
3. **Remaining Debt** - Order Total minus Total Paid
4. **Payment Status** - Visual indicator (Fully Paid, Partially Paid, Unpaid)
5. **Payment History** - List of all deposits with dates and amounts
6. **Payment Method** - Cash ("Efectivo") or Platform ("Plataforma") for each deposit

## 🏗️ Current Implementation Analysis

### Current State - Invoice.jsx (`/pdfOrden/:id`)

**File Location**: `client/src/pages/Invoice.jsx`

**Current Data Fetched**:
- Line 64: `const order = await getOrder(params.id)` - Fetches order with `deposit` field
- Line 89: `setCart(safeJSONParse(order.items, []))` - Parses order items
- Lines 67-88: Sets order state including `deposit: order.deposit`

**Current Display**:
- Lines 130-165: Financial breakdown table with:
  - Total Bruto (Gross Total)
  - Descuento (Discount) - Always $0
  - Total Neto (Net Total)
  - Total Exento (Tax Exempt)
  - Base INC 0%
  - INC 0% (Tax)
  - Total Impuesto (Total Tax)
  - **Total General (Grand Total)** - Line 161-162

**Missing**:
- Payment history (deposits list)
- Total paid amount display
- Remaining debt calculation
- Payment status indicator
- Individual deposit details

### Current State - PublicInvoice.jsx (`/factura/:id`)

**File Location**: `client/src/pages/PublicInvoice.jsx`

**Current Data Fetched**:
- Line 25: `const order = await getOrder(params.id)` - Fetches order with `deposit` field
- Line 28: `setCart(safeJSONParse(order.items, []))` - Parses order items
- Lines 29-50: Sets order state including `deposit: order.deposit`

**Current Display**:
- Lines 99-134: Financial breakdown table (similar to Invoice.jsx)
- Displays order items, totals, and tax information
- No print button integration with payment data

**Missing**:
- Payment history (deposits list)
- Total paid amount display
- Remaining debt calculation
- Payment status indicator
- Individual deposit details

## 🔧 Implementation Plan

### Phase 1: Backend - Extend Order Query with Deposits

**File**: `server/controllers/orders.controllers.js`

**Current Query** (Line 132-134):
```javascript
const [result] = await pool.query("SELECT orders.id, DATE(CONVERT_TZ(orders.createdAt, '+00:00', '-05:00')) as createdAt, orders.clientId, orders.collectedBy, orders.paid, orders.deposit, orders.paymentMethod, orders.paidAt, orders.items, clients.premises, clients.clientName, clients.mall FROM orders join clients on orders.clientId = clients.id WHERE orders.id = ?", [
    req.params.id,
]);
```

**Enhancement Options**:

**Option A: Create New Endpoint** (RECOMMENDED)
Create a new controller function `getOrderWithDeposits()` that returns order data WITH deposits array.

```javascript
export const getOrderWithDeposits = async (req, res) => {
    try {
        // Get order data
        const [orderResult] = await pool.query(`
            SELECT
                orders.id,
                DATE(CONVERT_TZ(orders.createdAt, '+00:00', '-05:00')) as createdAt,
                orders.clientId,
                orders.collectedBy,
                orders.paid,
                orders.deposit,
                orders.paymentMethod,
                orders.paidAt,
                orders.items,
                clients.premises,
                clients.clientName,
                clients.mall
            FROM orders
            JOIN clients ON orders.clientId = clients.id
            WHERE orders.id = ?
        `, [req.params.id]);

        if (orderResult.length === 0) {
            return res.status(404).json({ message: "Order not found" });
        }

        // Get deposits for this order (excluding deleted)
        const [depositsResult] = await pool.query(`
            SELECT
                depositId,
                orderId,
                clientId,
                depositValue,
                lastDeposit,
                newDeposit,
                dueOnDeposit,
                paymentMethod,
                CONVERT_TZ(depositCreatedAt, '+00:00', '-05:00') as depositCreatedAt,
                isDeleted,
                deletedAt
            FROM deposits
            WHERE orderId = ? AND isDeleted = 0
            ORDER BY depositCreatedAt ASC
        `, [req.params.id]);

        // Combine results
        const order = orderResult[0];
        order.deposits = depositsResult;

        res.json(order);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}
```

**Option B: Use Existing Deposits Endpoint**
Keep `getOrder()` as is, and fetch deposits separately in frontend using existing `getDepositsByOrderId()`.

**Recommendation**: Use **Option B** to minimize backend changes and leverage existing, tested code.

### Phase 2: Frontend - Update Context/API Layer

**Files**:
- `client/src/context/OrderProvider.jsx` - Already has `getOrder()` function
- `client/src/context/DepositsProvider.jsx` - Already has `getDepositsByOrderId()` function

**Action**: No changes required - reuse existing context functions.

### Phase 3: Frontend - Update Invoice.jsx

**File**: `client/src/pages/Invoice.jsx`

**Changes Required**:

1. **Import DepositsProvider** (Line 1):
```javascript
import { useDeposits } from "../context/DepositsProvider";
```

2. **Add deposits state** (After Line 53):
```javascript
const { getDepositsByOrderId } = useDeposits();
const [deposits, setDeposits] = useState([]);
```

3. **Update loadOrder function** (Lines 62-95):
```javascript
useEffect(() => {
    const loadOrder = async () => {
        if (params.id) {
            const order = await getOrder(params.id);
            const depositsData = await getDepositsByOrderId(params.id);

            setDeposits(depositsData || []);
            setCart(safeJSONParse(order.items, []))

            order.paid ?
                setOrder({
                    orderId: order.id,
                    clientId: order.clientId,
                    shopId: 1,
                    items: cart,
                    clientName: order.clientName,
                    premises: order.premises,
                    createdAt: order.createdAt.slice(0, 10),
                    paid: order.paid,
                    paidAt: order.paidAt.slice(0, 10),
                    deposit: order.deposit
                }) : setOrder({
                    orderId: order.id,
                    clientId: order.clientId,
                    shopId: 1,
                    items: cart,
                    clientName: order.clientName,
                    premises: order.premises,
                    createdAt: order.createdAt.slice(0, 10),
                    deposit: order.deposit
                })
        }
    };
    loadOrder();
}, [params.id]); // Remove order from dependency array to prevent infinite loop
```

4. **Add helper functions** (After Line 59):
```javascript
const calculateTotal = () => {
    return cart.reduce((total, item) => total + item.unitValue * item.quantity, 0);
};

const calculateRemainingDebt = () => {
    return calculateTotal() - (order.deposit || 0);
};

const getPaymentStatus = () => {
    const debt = calculateRemainingDebt();
    if (debt <= 0) return "PAGADO COMPLETAMENTE";
    if (order.deposit > 0) return "PAGO PARCIAL";
    return "NO PAGADO";
};
```

5. **Update payment display section** (After Line 165, before "CODIGO CIIU"):
```javascript
<br />
<table>
    <tbody className="w-full">
        <tr>
            <td className="font-bold">ESTADO DE PAGO:</td>
            <td className="font-bold">{getPaymentStatus()}</td>
        </tr>
        <tr>
            <td>TOTAL ABONADO:</td>
            <td>${order.deposit || 0}</td>
        </tr>
        <tr>
            <td>DEUDA RESTANTE:</td>
            <td>${calculateRemainingDebt()}</td>
        </tr>
    </tbody>
</table>
{deposits.length > 0 && (
    <>
        <br />
        <div className="font-bold">HISTORIAL DE PAGOS:</div>
        <table>
            <tbody>
                {deposits.map((deposit, index) => (
                    <tr key={deposit.depositId}>
                        <td>{index + 1}.</td>
                        <td>{deposit.depositCreatedAt.slice(0, 10)}</td>
                        <td>{deposit.paymentMethod}</td>
                        <td>${deposit.depositValue}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    </>
)}
<br />
```

### Phase 4: Frontend - Update PublicInvoice.jsx

**File**: `client/src/pages/PublicInvoice.jsx`

**Changes Required**:

1. **Import DepositsProvider** (Line 1):
```javascript
import { useDeposits } from "../context/DepositsProvider";
```

2. **Add deposits state** (After Line 14):
```javascript
const { getDepositsByOrderId } = useDeposits();
const [deposits, setDeposits] = useState([]);
```

3. **Update loadOrder function** (Lines 23-56):
```javascript
useEffect(() => {
    const loadOrder = async () => {
        if (params.id) {
            const order = await getOrder(params.id);
            const depositsData = await getDepositsByOrderId(params.id);

            setDeposits(depositsData || []);
            setCart(safeJSONParse(order.items, []))

            order.paid ?
                setOrder({
                    orderId: order.id,
                    clientId: order.clientId,
                    shopId: 1,
                    items: cart,
                    clientName: order.clientName,
                    premises: order.premises,
                    createdAt: order.createdAt.slice(0, 10),
                    paid: order.paid,
                    paidAt: order.paidAt.slice(0, 10),
                    deposit: order.deposit
                }) : setOrder({
                    orderId: order.id,
                    clientId: order.clientId,
                    shopId: 1,
                    items: cart,
                    clientName: order.clientName,
                    premises: order.premises,
                    createdAt: order.createdAt.slice(0, 10),
                    deposit: order.deposit
                })
        }
    };
    loadOrder();
}, [params.id]); // Remove order from dependency array
```

4. **Add helper functions** (After Line 20):
```javascript
const calculateTotal = () => {
    return cart.reduce((total, item) => total + item.unitValue * item.quantity, 0);
};

const calculateRemainingDebt = () => {
    return calculateTotal() - (order.deposit || 0);
};

const getPaymentStatus = () => {
    const debt = calculateRemainingDebt();
    if (debt <= 0) return "PAGADO COMPLETAMENTE";
    if (order.deposit > 0) return "PAGO PARCIAL";
    return "NO PAGADO";
};

const getPaymentStatusColor = () => {
    const debt = calculateRemainingDebt();
    if (debt <= 0) return "text-green-600 font-bold";
    if (order.deposit > 0) return "text-yellow-600 font-bold";
    return "text-red-600 font-bold";
};
```

5. **Update payment display section** (After Line 134, before CODIGO CIIU):
```javascript
<div className="mt-8 border-t-2 border-black pt-4">
    <h2 className="text-xl font-bold mb-4">INFORMACIÓN DE PAGO</h2>
    <table className="w-full">
        <tbody>
            <tr>
                <td className="py-2 font-bold">ESTADO DE PAGO:</td>
                <td className={`py-2 ${getPaymentStatusColor()}`}>{getPaymentStatus()}</td>
            </tr>
            <tr>
                <td className="py-2">TOTAL ABONADO:</td>
                <td className="py-2 text-green-600 font-bold">${order.deposit || 0}</td>
            </tr>
            <tr>
                <td className="py-2">DEUDA RESTANTE:</td>
                <td className={`py-2 font-bold ${calculateRemainingDebt() > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    ${calculateRemainingDebt()}
                </td>
            </tr>
        </tbody>
    </table>

    {deposits.length > 0 && (
        <div className="mt-6">
            <h3 className="text-lg font-bold mb-2">HISTORIAL DE PAGOS</h3>
            <table className="w-full border-collapse border border-black">
                <thead>
                    <tr>
                        <th className="py-2 border border-black">#</th>
                        <th className="py-2 border border-black">FECHA</th>
                        <th className="py-2 border border-black">MÉTODO</th>
                        <th className="py-2 border border-black">MONTO</th>
                        <th className="py-2 border border-black">TOTAL ACUMULADO</th>
                    </tr>
                </thead>
                <tbody>
                    {deposits.map((deposit, index) => (
                        <tr key={deposit.depositId}>
                            <td className="py-2 border border-black text-center">{index + 1}</td>
                            <td className="py-2 border border-black text-center">
                                {deposit.depositCreatedAt.slice(0, 10)}
                            </td>
                            <td className="py-2 border border-black text-center">
                                {deposit.paymentMethod}
                            </td>
                            <td className="py-2 border border-black text-center">
                                ${deposit.depositValue}
                            </td>
                            <td className="py-2 border border-black text-center">
                                ${deposit.newDeposit}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )}
</div>
```

## 🎨 Visual Design Considerations

### Invoice.jsx (Thermal Printer Style)
- Minimal formatting (text-based)
- Compact layout to fit thermal paper width
- Clear section dividers with `<br />` tags
- Simple table structures without heavy styling

### PublicInvoice.jsx (Web Display)
- Professional web styling with TailwindCSS
- Color-coded payment status:
  - 🟢 Green: Fully paid
  - 🟡 Yellow: Partially paid
  - 🔴 Red: Unpaid
- Bordered tables for payment history
- Responsive design for mobile/desktop viewing
- Print-friendly styling (hidden print button when printing)

## 📋 Data Flow Diagram

```
┌─────────────────────────────────────────────────┐
│  User Requests Invoice                          │
│  /pdfOrden/:id or /factura/:id                  │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│  Frontend: Invoice.jsx / PublicInvoice.jsx      │
│  - useEffect triggered on mount                 │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│  API Call 1: getOrder(id)                       │
│  → GET /orders/:id                              │
│  ← Returns: Order data with deposit field       │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│  API Call 2: getDepositsByOrderId(id)           │
│  → GET /deposits/:id                            │
│  ← Returns: Array of deposits (active only)     │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│  Frontend: Process Data                         │
│  - Parse order items (JSON)                     │
│  - Calculate order total from items             │
│  - Calculate remaining debt                     │
│  - Determine payment status                     │
│  - Format deposit history                       │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│  Frontend: Render Invoice                       │
│  - Display order details                        │
│  - Show product list                            │
│  - Show payment breakdown                       │
│  - Show payment history table                   │
│  - Show payment status badge                    │
└─────────────────────────────────────────────────┘
```

## 🧪 Testing Checklist

### Test Scenarios

#### Invoice.jsx
- [ ] Order with no payments (deposit = 0)
  - Should show "NO PAGADO" status
  - Total Abonado: $0
  - Deuda Restante: Full order total
  - No payment history section

- [ ] Order with partial payment
  - Should show "PAGO PARCIAL" status
  - Total Abonado: Sum of deposits
  - Deuda Restante: Positive number
  - Payment history with all deposits listed

- [ ] Order with full payment (paid = 1)
  - Should show "PAGADO COMPLETAMENTE" status
  - Total Abonado: Equal to order total
  - Deuda Restante: $0
  - Payment history with all deposits listed
  - Display paidAt date

- [ ] Order with deleted deposits
  - Should exclude deleted deposits from calculations
  - Payment history shows only active deposits

- [ ] Order with multiple payments (3+ deposits)
  - All deposits appear in chronological order
  - Running totals are accurate

#### PublicInvoice.jsx
- [ ] All scenarios from Invoice.jsx above
- [ ] Color coding displays correctly:
  - Green for fully paid
  - Yellow for partial payment
  - Red for unpaid
- [ ] Print functionality works with payment info
- [ ] Responsive design on mobile devices
- [ ] Payment history table formats correctly

### Edge Cases
- [ ] Order with malformed items JSON (should use safe parsing)
- [ ] Order with no deposits record in database
- [ ] Order with deposit but no payment history (data inconsistency)
- [ ] Very long payment history (10+ deposits)
- [ ] Large payment amounts (formatting)
- [ ] Zero-value orders (free items)

## 📝 Implementation Order

1. ✅ **Create INVOICES.md documentation** (Current step)
2. 🔄 **Update README.md** - Add reference to INVOICES.md
3. 🔄 **Update CLAUDE.md** - Document payment display features
4. 🔨 **Implement Invoice.jsx changes** - Add payment info display
5. 🔨 **Implement PublicInvoice.jsx changes** - Add payment info display
6. 🧪 **Test all scenarios** - Verify functionality with real data
7. 🎨 **UI/UX refinements** - Adjust styling based on testing
8. 📄 **Update user documentation** - Add screenshots/examples

## 🔄 Future Enhancements

### Potential Additions
1. **QR Code for Payment** - Generate QR code for digital payments on invoice
2. **Payment Receipt PDF** - Separate receipt for each deposit
3. **Email Invoice with Payment Link** - Send invoice via email with payment portal
4. **Payment Reminders** - Automated reminders for unpaid invoices
5. **Multi-Currency Support** - Display amounts in USD/COP
6. **Payment Analytics** - Average payment time, payment method preferences
7. **Downloadable Payment History** - Export deposits to CSV/Excel
8. **Invoice Watermark** - "PAID" or "UNPAID" watermark on PDF

## 📚 Related Documentation

- **Main Documentation**: [CLAUDE.md](CLAUDE.md) - Complete system documentation
- **Project Overview**: [README.md](README.md) - System architecture and setup
- **Page Merge History**: [MERGE.md](MERGE.md) - Cobros del día enhancement (2025-10-04)

## 🤝 Dependencies

### Existing Code to Leverage
- ✅ `getOrder()` - OrderProvider.jsx (already fetches order.deposit)
- ✅ `getDepositsByOrderId()` - DepositsProvider.jsx (fetches deposits array)
- ✅ `safeJSONParse()` - jsonUtils.js (safe JSON parsing for order.items)
- ✅ `sortProductsByDateDesc()` - orderUtils.js (sorts products by date)
- ✅ Deposit soft delete logic - deposits.controllers.js (excludes isDeleted = 1)

### New Dependencies
- None - All functionality can be implemented with existing dependencies

## 🚀 Performance Considerations

### Optimization Strategies
1. **Single API Call Approach** - Consider combining order + deposits into single endpoint in future
2. **Caching** - Cache deposit data to avoid repeated API calls on page refresh
3. **Lazy Loading** - Load deposit history only when expanded (accordion pattern)
4. **Pagination** - For orders with 50+ deposits, implement pagination

### Current Performance
- **Two API Calls**: `getOrder()` + `getDepositsByOrderId()`
- **Expected Response Time**: < 500ms for typical order with 5-10 deposits
- **Network Efficiency**: Minimal payload, only active deposits returned

## ⚠️ Important Notes

1. **Soft Delete Handling**: The system uses soft deletes for deposits (`isDeleted` flag). Always filter deposits where `isDeleted = 0` to ensure accurate calculations.

2. **Field Mapping** (Critical - Updated 2025-09-30):
   - `depositValue`: Individual payment amount (what user entered)
   - `lastDeposit`: Previous cumulative total
   - `newDeposit`: New cumulative total after this deposit
   - `dueOnDeposit`: Remaining debt after deposit

3. **Timezone Handling**: All dates use `CONVERT_TZ(field, '+00:00', '-05:00')` for Colombia timezone.

4. **Order.deposit Field**: This field stores the CURRENT cumulative total of all active deposits. It's updated automatically when deposits are created or deleted.

5. **Paid Status Logic**:
   - `order.paid = 0`: Unpaid or partially paid
   - `order.paid = 1`: Fully paid (deposit >= order total)

6. **useEffect Dependency Array**: When updating loadOrder functions, ensure dependency array includes only `params.id` to prevent infinite loops.

## 📞 Support & Maintenance

**Developer Contact**: Juan David Ramírez Torres - jdramirezt@unal.edu.co

**Last Updated**: 2025-10-04

**Document Version**: 1.0

---

**Implementation Status**: ✅ COMPLETED (2025-10-04)

**Actual Implementation Time**: 1 hour

**Complexity Level**: 🟢 Low (leveraged existing infrastructure, minimal new code)

## 🎉 Implementation Summary

Both invoice views have been successfully enhanced with comprehensive payment information:

### Files Modified:
1. ✅ `client/src/pages/Invoice.jsx` - Thermal printer invoice
2. ✅ `client/src/pages/PublicInvoice.jsx` - Web-based public invoice

### Features Implemented:
- ✅ Payment status display (PAGADO COMPLETAMENTE / PAGO PARCIAL / NO PAGADO)
- ✅ Total paid amount (from order.deposit)
- ✅ Remaining debt calculation
- ✅ Complete payment history table with all deposits
- ✅ Payment method tracking (Efectivo / Plataforma)
- ✅ Color-coded status (PublicInvoice.jsx):
  - 🟢 Green: Fully paid
  - 🟡 Yellow: Partially paid
  - 🔴 Red: Unpaid
- ✅ Cumulative payment totals in history
- ✅ Conditional display (payment history only shows when deposits exist)

### Technical Implementation:
- Uses existing `getOrder()` and `getDepositsByOrderId()` functions
- No backend changes required
- Maintains thermal printer compatibility (Invoice.jsx)
- Responsive web design (PublicInvoice.jsx)
- Fixed useEffect dependency array to prevent infinite loops
- Proper error handling with safe defaults (|| 0)

### Testing Status:
- ✅ Server compiles without errors
- ✅ Vite development server running successfully
- ⏳ Manual testing recommended with real order data
