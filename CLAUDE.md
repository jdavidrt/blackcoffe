# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Backend Development
- `npm run dev` - Start backend server with nodemon (auto-reload) on port 25060
- `npm install` - Install backend dependencies
- Backend serves from root directory using Express.js

### Frontend Development
- `cd client && npm run dev` - Start Vite development server
- `cd client && npm run build` - Build for production
- `cd client && npm run preview` - Preview production build
- `cd client && npm install` - Install frontend dependencies

### Full Application Startup
1. Start backend: `npm run dev` (from root)
2. Start frontend: `cd client && npm run dev` (new terminal)
3. Backend runs on port 25060, frontend typically on port 5173

## Architecture Overview

### Full-Stack Structure
This is a monorepo with separate client (React) and server (Express) applications. The backend serves the built frontend from `client/dist` in production, and both run separately in development.

### Database Integration
- **MySQL Database**: Hosted on DigitalOcean (credentials in `server/db.js`)
- **Connection Pool**: Uses mysql2/promise with connection pooling
- **Timezone Handling**: All queries convert from UTC to Colombia timezone (`CONVERT_TZ(field, '+00:00', '-05:00')`)
- **Key Tables**: orders, clients, products, users, deposits
- **Order States**: Orders track paid status, delivery status, and collection status

### API Architecture Pattern
The API follows a consistent RESTful pattern:
- **Routes** (`server/routes/*.routes.js`): Define endpoints and HTTP methods
- **Controllers** (`server/controllers/*.controllers.js`): Handle business logic and database queries
- **Frontend API Services** (`client/src/api/*.api.js`): Axios-based HTTP client functions
- **Dual Server Setup**: Frontend API calls point to `renderServer = 'https://coffeserver.onrender.com'` for production, but can work with local backend

### React Context State Management
Each major entity uses React Context for state management:
- **Pattern**: `Context.jsx` + `Provider.jsx` files in `client/src/context/`
- **Custom Hooks**: Each provider exports a `use[Entity]` hook (e.g., `useOrders()`)
- **State Operations**: Providers include CRUD operations and state management functions
- **Error Handling**: Context hooks throw errors if used outside their provider scope

### Order Management System
Orders are the central entity with complex state tracking:
- **Order States**: unpaid/paid, delivered/not delivered, collected/not collected
- **Items Structure**: Orders contain JSON items with product details and delivery status
- **Location-Based**: Orders are filtered by mall and premises (numbered locations)
- **Date-Based Queries**: Many operations filter by date with timezone conversion
- **Payment Tracking**: Supports partial payments through deposits system

### Deposits and Payment System
The BlackCoffe system implements a comprehensive payment tracking system that supports both partial payments (deposits) and full order payments. This system allows café managers to handle complex payment scenarios where customers may pay in installments or make partial payments over time.

#### Database Structure
The payment system is built around two main tables:

**Orders Table** (`orders`):
- `id`: Unique order identifier
- `deposit`: Current total amount deposited for this order
- `paid`: Boolean flag (0=unpaid, 1=fully paid)
- `paidAt`: Timestamp when order was fully paid
- `paymentMethod`: Payment method ("Efectivo", "Plataforma", etc.)

**Deposits Table** (`deposits`):
- `depositId`: Unique deposit record identifier
- `orderId`: Foreign key linking to the order
- `clientId`: Foreign key linking to the client
- `depositValue`: Individual payment amount entered by user (THIS deposit only)
- `lastDeposit`: Previous cumulative deposit total before this transaction
- `newDeposit`: New cumulative deposit total AFTER this deposit
- `dueOnDeposit`: Remaining debt after this deposit
- `paymentMethod`: Method used for this specific deposit
- `depositCreatedAt`: Timestamp of deposit creation
- `isDeleted`: Soft delete flag (0=active, 1=deleted)
- `deletedAt`: Timestamp of deletion
- `deletedBy`: User who deleted the deposit (for audit)

#### Core Payment Functions

**Backend Controllers** (`server/controllers/deposits.controllers.js`):
- `getDeposits()`: Retrieves all deposits with order information (includes isDeleted status)
- `getDepositsByOrder(orderId)`: Gets all deposits for a specific order (includes isDeleted status)
- `getDepositsByDate(date)`: Retrieves deposits made on a specific date (includes isDeleted status)
- `createDeposit(depositData)`: Creates a new deposit record
- `deleteDeposit(depositId)`: ✅ **WORKING** - Soft deletes a deposit with automatic recalculation of all subsequent deposits

**Frontend Context** (`client/src/context/DepositsProvider.jsx`):
- `createDeposit(deposits)`: Creates new deposit via API
- `getDepositsByOrderId(id)`: Fetches deposits for an order
- `getDepositsByDate(date)`: Retrieves daily deposits
- `loadDeposits()`: Loads all deposits into state
- `deleteDepositById(id)`: ✅ **WORKING** - Soft deletes a deposit via API

#### Payment Processing Workflow

**Step 1: Partial Payment (Deposit)**
1. Navigate to `/cobrarOrden/:id` to access payment form
2. System loads order details via `getOrder(id)` in `CollectOrderForm.jsx:210`
3. System loads existing deposits via `getDepositsByOrderId(id)` in `CollectOrderForm.jsx:211`
4. User enters deposit amount in the payment form
5. System calculates payment details:
   - `calculateTotal()`: Calculates order total from items
   - `currentDebt = calculateTotal() - order.deposit`: Remaining balance
   - `newDebt = currentDebt - depositAmount`: Balance after payment
6. Payment confirmation modal displays payment breakdown
7. On confirmation, system creates deposit record:
   ```javascript
   const newDeposit = {
     orderId: params.id,
     clientId: order.clientId,
     paymentMethod: platformPayment ? "Plataforma" : "Efectivo",
     depositValue: order.deposit + deposit, // Total after payment
     lastDeposit: order.deposit, // Previous total
     newDeposit: deposit // This payment amount
   }
   ```
8. System updates order deposit total via `updateOrder()` in `CollectOrderForm.jsx:171`
9. If total deposits >= order total, order.paid is set to 1

**Step 2: Full Payment**
1. When `depositedTotal` flag is true, system processes full payment
2. Calculates remaining balance: `remainingAmount = calculateTotal() - order.deposit`
3. Creates deposit for exact remaining amount
4. Sets `order.paid = 1` and `order.paidAt = currentDate`
5. Order moves to "fully paid" status

**Step 3: Payment Tracking and History**
- `/abonos/` route displays payment history via `DepositsPage.jsx`
- `/cobrosHoy/` shows today's collections via `DepositedOrdersPage.jsx`
- Each deposit maintains complete audit trail with timestamps and amounts

#### Key Payment Functions by File

**CollectOrderForm.jsx**:
- `handleConfirmPayment()`: Processes payment confirmation (lines 150-196)
- `calculateTotal()`: Computes order total from items
- `loadOrder()`: Initializes order and deposit data (lines 207-249)

**DepositsProvider.jsx**:
- `createDeposit()`: API wrapper for creating deposits (lines 28-34)
- `getDepositsByOrderId()`: Fetches order-specific deposits (lines 36-43)

**deposits.controllers.js**:
- `createDeposit()`: Backend deposit creation (lines 27-34)
- `getDepositsByOrder()`: Retrieves deposits with order JOIN (lines 7-18)

#### Payment Method Support
The system supports multiple payment methods:
- **"Efectivo"**: Cash payments (default)
- **"Plataforma"**: Digital platform payments
- Payment method is tracked per deposit and can vary between payments for the same order

#### Real-time Payment Updates
- After payment processing, system refreshes via `window.location.reload()` in `CollectOrderForm.jsx:190`
- Context providers maintain synchronized state across components
- Payment status updates are immediately reflected in order lists and collection views

#### Complete Order Payment Process (Full Charge)

**Scenario**: Customer wants to pay the complete order balance in one transaction

**Step-by-Step Process**:

1. **Access Payment Interface**
   - Navigate to `/cobrarOrden/:orderId`
   - Example: `/cobrarOrden/123` for order ID 123
   - System calls `loadOrder()` function in `CollectOrderForm.jsx:207-249`

2. **Order Data Loading**
   ```javascript
   // CollectOrderForm.jsx:210-213
   const order = await getOrder(params.id);
   const depositsRequest = await getDepositsByOrderId(params.id);
   setDeposits(depositsRequest);
   setCart(safeJSONParse(order.items, []))
   ```

3. **Calculate Outstanding Balance**
   - System calculates total via `calculateTotal()` function
   - Current debt = `calculateTotal() - order.deposit`
   - Displays current balance to user

4. **Full Payment Selection**
   - User clicks "Cobrar Total" (Charge Full) button
   - Sets `depositedTotal = true` flag in `CollectOrderForm.jsx:34`
   - System automatically calculates exact remaining amount

5. **Payment Confirmation Modal**
   - Displays payment breakdown:
     - Order total: `calculateTotal()`
     - Previously paid: `order.deposit`
     - Amount to pay: `calculateTotal() - order.deposit`
   - Shows payment method selection (Efectivo/Plataforma)

6. **Payment Processing** (`handleConfirmPayment()` in `CollectOrderForm.jsx:150-196`):
   ```javascript
   // Calculate final deposit amount
   if (depositedTotal) {
     values.deposit = order.deposit + deposit // Full remaining amount
   }

   // Mark as fully paid
   if (values.deposit >= calculateTotal()) {
     values.paid = 1;
     values.paidAt = fechaActual;
   }
   ```

7. **Database Updates**
   - Creates deposit record via `createDeposit(newDeposit)` in `CollectOrderForm.jsx:170`
   - Updates order via `updateOrder(params.id, values)` in `CollectOrderForm.jsx:171`
   - Deposit record includes:
     ```javascript
     const newDeposit = {
       orderId: params.id,
       clientId: order.clientId,
       paymentMethod: platformPayment ? "Plataforma" : "Efectivo",
       depositValue: calculateTotal(), // Final total
       lastDeposit: order.deposit, // Previous amount
       newDeposit: remainingAmount // This payment
     }
     ```

8. **Order Status Update**
   - Order `paid` field set to `1`
   - Order `paidAt` field set to current timestamp
   - Order moves from "pending payment" to "fully paid" status

9. **Post-Payment Actions**
   - System reloads page via `window.location.reload()` in `CollectOrderForm.jsx:190`
   - Order appears in "Collected Orders" view (`/ordenesPagas`)
   - Payment recorded in daily collections (`/cobrosHoy`)

#### Partial Payment Process (Deposit)

**Scenario**: Customer makes a partial payment towards their order

**Step-by-Step Process**:

1. **Access Payment Interface** (same as full payment)
   - Navigate to `/cobrarOrden/:orderId`
   - System loads order and existing deposits

2. **Enter Partial Amount**
   - User enters specific amount in deposit field
   - System validates amount doesn't exceed remaining balance
   - `depositedTotal` flag remains `false`

3. **Payment Calculation** (`CollectOrderForm.jsx:152-154`):
   ```javascript
   // For partial payments
   values.deposit = values.deposit + order.deposit

   // Check if this payment completes the order
   if (values.deposit >= calculateTotal()) {
     values.paid = 1; // Mark as fully paid
   } else {
     values.paid = 0; // Remains partially paid
   }
   ```

4. **Deposit Record Creation**
   - Creates partial payment record in deposits table
   - Maintains payment history for audit trail
   - Updates order's total deposit amount

5. **Remaining Balance**
   - Order remains in "pending payment" status if balance > 0
   - Customer can make additional payments later
   - System tracks cumulative payment total

#### Payment History and Reporting

**Daily Collections** (`/cobrosHoy` - `DepositedOrdersPage.jsx`):
- Shows all payments made on specific date
- Calls `getDepositsByDate(date)` via `DepositsProvider.jsx:55-58`
- Displays: client info, payment amounts, payment methods

**Payment History** (`/abonos` - `DepositsPage.jsx`):
- Complete payment audit trail
- Shows all deposits with timestamps
- Filterable by date, client, or order

**Order Collection Views**:
- `/cobrarOrdenes/:mall` - Orders pending payment by location
- `/ordenesPagas` - Fully paid orders ready for collection
- Real-time status updates based on payment completion

#### Practical Usage Examples

**Example 1: Processing a $50,000 COP Order with Partial Payments**

```javascript
// Order Details
Order ID: 123
Client: "Juan Pérez" (Premises: "Local 15", Mall: "Centro Comercial Norte")
Items: [
  { productName: "Café Americano", quantity: 2, unitValue: 8000 },
  { productName: "Croissant", quantity: 3, unitValue: 12000 }
]
Total: 52,000 COP
Current Deposit: 0 COP
```

**Step 1: First Partial Payment (20,000 COP)**
1. Navigate to `/cobrarOrden/123`
2. System loads via `CollectOrderForm.jsx:loadOrder()`
3. Enter 20,000 in deposit field
4. Confirm payment - creates deposit record:
   ```sql
   INSERT INTO deposits (orderId, clientId, paymentMethod, depositValue, lastDeposit, newDeposit)
   VALUES (123, 45, 'Efectivo', 20000, 0, 20000)
   ```
5. Updates order: `deposit = 20000, paid = 0`
6. Remaining balance: 32,000 COP

**Step 2: Second Partial Payment (15,000 COP)**
1. Same process, enter 15,000 COP
2. Creates new deposit record:
   ```sql
   INSERT INTO deposits (orderId, clientId, paymentMethod, depositValue, lastDeposit, newDeposit)
   VALUES (123, 45, 'Plataforma', 35000, 20000, 15000)
   ```
3. Updates order: `deposit = 35000, paid = 0`
4. Remaining balance: 17,000 COP

**Step 3: Final Payment (Complete Order)**
1. Click "Cobrar Total" button (`depositedTotal = true`)
2. System calculates remaining: 52,000 - 35,000 = 17,000 COP
3. Creates final deposit:
   ```sql
   INSERT INTO deposits (orderId, clientId, paymentMethod, depositValue, lastDeposit, newDeposit)
   VALUES (123, 45, 'Efectivo', 52000, 35000, 17000)
   ```
4. Updates order: `deposit = 52000, paid = 1, paidAt = '2024-01-15'`
5. Order moves to fully paid status

**Example 2: Single Full Payment (25,000 COP Order)**

```javascript
// Order Details
Order ID: 124
Client: "María González"
Items: [{ productName: "Combo Desayuno", quantity: 1, unitValue: 25000 }]
Total: 25,000 COP
Current Deposit: 0 COP
```

**Single Payment Process**:
1. Navigate to `/cobrarOrden/124`
2. Click "Cobrar Total" for full payment
3. Confirm 25,000 COP payment
4. System creates single deposit record:
   ```sql
   INSERT INTO deposits (orderId, clientId, paymentMethod, depositValue, lastDeposit, newDeposit)
   VALUES (124, 67, 'Efectivo', 25000, 0, 25000)
   ```
5. Updates order: `deposit = 25000, paid = 1, paidAt = CURRENT_TIMESTAMP`
6. Order immediately moves to collected status

**Example 3: Daily Collections Report**

Accessing `/cobrosHoy/` on date 2024-01-15 shows:

```javascript
// Query executed: getDepositsByDate('2024-01-15')
// Results from deposits.controllers.js:20-25

[
  {
    orderId: 123,
    clientName: "Juan Pérez",
    premises: "Local 15",
    mall: "Centro Comercial Norte",
    depositValue: 20000,
    newDeposit: 20000,
    paymentMethod: "Efectivo",
    depositCreatedAt: "2024-01-15 09:30:00"
  },
  {
    orderId: 123,
    clientName: "Juan Pérez",
    premises: "Local 15",
    depositValue: 35000,
    newDeposit: 15000,
    paymentMethod: "Plataforma",
    depositCreatedAt: "2024-01-15 14:20:00"
  },
  {
    orderId: 124,
    clientName: "María González",
    depositValue: 25000,
    newDeposit: 25000,
    paymentMethod: "Efectivo",
    depositCreatedAt: "2024-01-15 16:45:00"
  }
]
```

**Daily Summary**:
- Total Collections: 60,000 COP
- Cash Payments: 45,000 COP
- Platform Payments: 15,000 COP
- Orders Completed: 2
- Partial Payments: 2

**Example 4: Error Handling and Validation**

**Invalid Payment Scenarios**:
1. **Overpayment Prevention**:
   ```javascript
   // In CollectOrderForm.jsx payment validation
   const remainingBalance = calculateTotal() - order.deposit;
   if (enteredAmount > remainingBalance) {
     // System prevents overpayment
     alert("Amount exceeds remaining balance");
   }
   ```

2. **Database Transaction Safety**:
   ```javascript
   // deposits.controllers.js:27-34 with error handling
   try {
     const result = await pool.query("INSERT INTO deposits SET ?", req.body);
     res.json(result);
   } catch (error) {
     return res.status(500).json({ message: error.message });
   }
   ```

3. **Network Error Recovery**:
   ```javascript
   // DepositsProvider.jsx:28-34 with error handling
   const createDeposit = async (deposits) => {
     try {
       await createDepositRequest(deposits);
     } catch (error) {
       console.error(error);
       // System maintains state consistency
     }
   };
   ```

These examples demonstrate the complete payment lifecycle from order creation through final collection, showing how the system maintains data integrity and provides comprehensive audit trails for all financial transactions.

####Delete Deposits Feature ✅ IMPLEMENTED & CORRECTED (Updated 2025-10-01)

The system now supports deleting incorrect deposits while maintaining data integrity through automatic recalculation. **IMPORTANT**: The field mapping has been corrected to properly handle edge cases, and UI consistency has been improved across all views.

**Location**: Delete functionality is ONLY available in `CollectOrderForm.jsx` (`/cobrarOrden/:id` route)

**Corrected Database Schema** (Updated 2025-09-30):
The deposit fields have been clarified for proper handling:
- `depositValue`: **Individual payment amount** (what user entered for THIS deposit)
- `lastDeposit`: **Previous cumulative total** before this deposit
- `newDeposit`: **New cumulative total** AFTER this deposit
- `dueOnDeposit`: **Remaining debt** after this deposit

**UI Implementation**:

*CollectOrderForm (`/cobrarOrden/:id`)*:
- Deposits table displayed at end of payment form with columns:
  - "Valor de Abono" displays `depositValue` (individual payment)
  - "Valor Abonado Anterior" displays `lastDeposit` (previous cumulative)
  - "Abono de la Orden" displays `newDeposit` (cumulative total)
  - "Nueva Deuda" displays `dueOnDeposit` (remaining debt)
- Trash can icon in "Eliminar" column for each active deposit
- Deleted deposits marked with [ELIMINADO] label and crossed-out styling with red background
- Trash icon disabled for paid orders

*DepositsPage (`/abonos`)* ✅ **UPDATED 2025-10-01**:
- Shows ALL deposits including deleted ones for audit trail
- **Deleted deposits visual styling**:
  - Grey background (`bg-gray-300`)
  - Greyed out text (`text-gray-500`)
  - Reduced opacity (`opacity-60`)
  - Strike-through text (`line-through`)
  - Red `[ELIMINADO]` label prefix
  - Disabled button with grey background and `cursor-not-allowed`
- Active deposits count shown in header (excludes deleted)
- Maintains full audit trail visibility

*DepositedOrdersPage (`/cobrosHoy`)* ✅ **UPDATED 2025-10-01**:
- **Fixed deposit value calculation**: Now correctly filters out deleted deposits
- `sumarDepositos()` function skips deposits where `isDeleted === 1`
- `sumarDepositosPorMall()` function excludes deleted deposits from mall totals
- Displays accurate "Abonado este día" values per order

*OrderCollectCard Component* ✅ **UPDATED 2025-10-01**:
- Context-aware display logic:
  - On `/cobrosHoy`: Shows "Abonado este día: $[depositValue]" (only that day's deposits)
  - On `/cobrarOrdenes/:mall`: Shows "Abono total: $[deposit]" (cumulative total)
  - Orders with no deposits: Shows "Total: $[orderTotal]" in green

**Backend Logic** (`deleteDeposit` in `deposits.controllers.js:36-118`):
1. Validates deposit exists and is not already deleted
2. Prevents deletion if order is fully paid (`order.paid = 1`)
3. Performs soft delete (sets `isDeleted = 1`, `deletedAt = timestamp`)
4. **Corrected Automatic Recalculation** (Fixed 2025-09-30):
   - Retrieves all active deposits ordered by creation date
   - Uses `depositValue` (individual amount) for recalculation
   - Recalculates cumulative values sequentially:
     - `lastDeposit`: Previous cumulative total
     - `newDeposit`: New cumulative total after this deposit
     - `dueOnDeposit`: Remaining debt
5. Updates order total deposit amount
6. Resets order `paid` status to 0

**Frontend Logic** (`CollectOrderForm.jsx:168-197`):
Corrected deposit creation to properly set field values:
```javascript
const individualDepositAmount = depositedTotal ? deposit : parseFloat(values.deposit);
const newCumulativeTotal = order.deposit + individualDepositAmount;

neewDeposit.depositValue = individualDepositAmount;  // Individual payment
neewDeposit.lastDeposit = order.deposit;             // Previous cumulative
neewDeposit.newDeposit = newCumulativeTotal;         // New cumulative
neewDeposit.dueOnDeposit = calculateTotal() - newCumulativeTotal; // Remaining
```

**Example - Corrected Field Mapping** (Order Total: $60,000):
```javascript
// Deposit 1: User enters $20,000
depositValue: 20000  // Individual payment
lastDeposit: 0       // No previous deposits
newDeposit: 20000    // Cumulative total
dueOnDeposit: 40000  // Remaining debt

// Deposit 2: User enters $15,000
depositValue: 15000  // Individual payment
lastDeposit: 20000   // Previous cumulative
newDeposit: 35000    // Cumulative total
dueOnDeposit: 25000  // Remaining debt

// Deposit 3: User enters $10,000
depositValue: 10000  // Individual payment
lastDeposit: 35000   // Previous cumulative
newDeposit: 45000    // Cumulative total
dueOnDeposit: 15000  // Remaining debt
```

**Example - Deleting Middle Deposit** (All Edge Cases Fixed):
```javascript
// Initial State - 3 deposits
1. depositValue: 20000, lastDeposit: 0,     newDeposit: 20000, dueOnDeposit: 40000
2. depositValue: 15000, lastDeposit: 20000, newDeposit: 35000, dueOnDeposit: 25000
3. depositValue: 10000, lastDeposit: 35000, newDeposit: 45000, dueOnDeposit: 15000

// Delete Deposit 2 (middle deposit)
DELETE /deposits/depositId_2

// After Deletion - Automatic Recalculation
1. depositValue: 20000, lastDeposit: 0,     newDeposit: 20000, dueOnDeposit: 40000 ✅ UNCHANGED
2. [DELETED] depositValue: 15000, isDeleted: 1 ✅ SOFT DELETED
3. depositValue: 10000, lastDeposit: 20000, newDeposit: 30000, dueOnDeposit: 30000 ✅ RECALCULATED

Order Deposit: 30000 ✅ UPDATED (was 45000)
```

**Edge Cases Handled**:
- ✅ **Delete First Deposit**: Subsequent deposits recalculated from zero
- ✅ **Delete Middle Deposit**: All following deposits recalculated correctly
- ✅ **Delete Last Deposit**: Previous deposits unchanged, order total updated
- ✅ **Multiple Deletions**: Each deletion triggers full recalculation of remaining active deposits

**Key Features**:
- **Soft Delete**: Maintains audit trail, deposit never removed from database
- **Corrected Recalculation**: Uses `depositValue` (individual amounts) for accurate cumulative totals
- **Data Integrity**: Order totals always consistent with active deposits
- **Visual Feedback**: Deleted deposits crossed out with red background
- **Protection**: Cannot delete deposits from fully paid orders
- **Edge Case Safety**: Properly handles deletion of deposits in any position

**Files Modified**:
- **2025-09-30 (Initial Implementation)**:
  - Backend: `server/routes/deposits.routes.js`, `server/controllers/deposits.controllers.js`
  - Frontend: `client/src/context/DepositsProvider.jsx`, `client/src/pages/CollectOrderForm.jsx`

- **2025-10-01 (UI Consistency & Calculation Fixes)**:
  - Backend: `server/controllers/orders.controllers.js` (added `isDeleted`, `deletedAt` to `getDepositedOrdersByDate`)
  - Frontend:
    - `client/src/pages/DepositedOrdersPage.jsx` (filter deleted deposits in calculations)
    - `client/src/pages/DepositsPage.jsx` (show deleted deposits with grey styling)
    - `client/src/components/DepositsCard.jsx` (visual styling for deleted deposits)
    - `client/src/components/OrderCollectCard.jsx` (context-aware deposit display)

**Bug Fix & Enhancement History**:
- **2025-09-30**: Fixed edge case where deleting middle deposit caused incorrect recalculation
  - Root cause: Confusion between `depositValue` (individual) and `newDeposit` (cumulative)
  - Solution: Clarified field semantics and corrected creation/deletion logic
  - Result: All edge cases now handled correctly (first, middle, last deposit deletion)

- **2025-10-01**: Fixed inconsistencies in deposit display and calculation across all views
  - **Issue 1**: "Abonado este día" not showing values on `/cobrosHoy`
    - Root cause: `OrderCollectCard` not handling `depositValue` field properly
    - Solution: Added context-aware logic to display different values based on route
  - **Issue 2**: Deleted deposits included in daily totals
    - Root cause: `sumarDepositos()` and `sumarDepositosPorMall()` not filtering deleted deposits
    - Solution: Added `if (objeto.isDeleted === 1) return;` checks in both functions
  - **Issue 3**: Deleted deposits not visible in `/abonos` audit trail
    - Root cause: Filter was excluding deleted deposits completely
    - Solution: Show all deposits with visual styling for deleted ones (grey, strikethrough, disabled)
  - **Issue 4**: Backend query missing `isDeleted` field
    - Root cause: `getDepositedOrdersByDate` didn't include deletion status fields
    - Solution: Added `deposits.isDeleted, deposits.deletedAt` to SELECT statement

### Route Organization
Frontend routes are organized by functionality:
- **Public Routes**: `/factura/:id` (no auth required)
- **Authentication**: `/iniciarSesion`
- **Entity Management**: CRUD routes for orders, clients, products
- **Workflow Routes**: Collection (`/cobrarOrdenes/:mall`), delivery (`/recorrido/`), payment processing
- **Reporting**: Various date-filtered views for business operations

### Development Patterns
- **File Naming**: Consistent `.jsx` extension for React components
- **Component Structure**: Pages in `pages/`, reusable components in `components/`
- **Styling**: TailwindCSS + Ant Design components
- **Form Handling**: Formik for complex forms
- **PDF Generation**: React-PDF for invoice generation
- **Authentication**: localStorage-based session management with route protection

### Database Query Patterns
- **Timezone Awareness**: All datetime queries use CONVERT_TZ for Colombia timezone
- **JOIN Patterns**: Orders typically joined with clients for display data
- **Sorting**: Results often sorted by premises (cast as number), client name, then creation date
- **Status Filtering**: Complex WHERE clauses for order states (paid, delivered, collected)
- **JSON Queries**: Orders.items column searched with LIKE patterns for delivery status

### Key Integration Points
- **Server Static Serving**: `app.use(express.static(join(__dirname, '../client/dist')))` serves built frontend
- **CORS Configuration**: Enabled for cross-origin requests during development
- **Error Handling**: Try-catch patterns in controllers with console.error logging
- **State Synchronization**: Frontend contexts reload data after mutations to stay in sync

## Code Improvements & Implementation Progress

### Completed Improvements ✅

0. **Delete Deposits Feature** ✅ **COMPLETED** (6 hours): Implemented comprehensive soft delete functionality with automatic recalculation of all affected deposits. Location: ONLY in `CollectOrderForm.jsx`. Features: trash can icons, confirmation modals, visual feedback for deleted deposits, paid order protection. Backend: automatic recalculation of `lastDeposit`, `depositValue`, `dueOnDeposit` for all remaining deposits. Files modified: 5 (3 backend, 2 frontend). Tested successfully with order 15651. See detailed documentation above in "Delete Deposits Feature" section.

1. **Console.log Removal** ✅ **COMPLETED**: Removed 77+ debug console.log statements from client and server, improved server logging with ISO timestamps, preserved important console.error statements for error handling.

2. **Safe JSON Parsing Utility** ✅ **COMPLETED**: Created `client/src/utils/jsonUtils.js` with `safeJSONParse()`, `getOrderItems()`, and `hasValidItems()` functions. Updated 11 files to use safe JSON parsing instead of direct JSON.parse calls. Prevents application crashes from malformed JSON data while preserving all existing functionality.

3. **Comprehensive Utility Functions** ✅ **COMPLETED**: Created 8 comprehensive utility files with 25+ functions. Updated 15+ high and medium impact components. Eliminated 50+ lines of duplicate code across order calculations, date formatting, mall styling, cart management, and API configuration.

### Priority Improvements Available for Implementation

#### 1. Component Utility Functions 🟢 (MEDIUM PRIORITY - 2 hours)
- **Issue**: Duplicated order calculation logic across components
- **Implementation**: Create `client/src/utils/orderUtils.js` with functions like `calculateOrderTotal()`, `formatCurrency()`, `calculateBalance()`, `isOrderPaid()`
- **Impact**: DRY principle compliance, maintainable code

#### 2. Basic Error Handling in Controllers 🟢 (HIGH PRIORITY - 2 hours)
- **Issue**: Only 1 try-catch block in entire backend
- **Files**: All controller files in `server/controllers/`
- **Implementation**: Create `server/utils/responseUtils.js` with `sendSuccess()` and `sendError()` functions, wrap all database operations in try-catch
- **Impact**: Prevents server crashes, provides consistent error responses

#### 3. Standardize API Response Format 🟢 (MEDIUM PRIORITY - 3 hours)
- **Issue**: Inconsistent API response formats across endpoints
- **Implementation**: Use responseUtils to return consistent format: `{success: boolean, message: string, data: any, timestamp: string}`
- **Impact**: Consistent client-side error handling and response processing

#### 4. React Error Boundaries 🟢 (MEDIUM PRIORITY - 2 hours)
- **Issue**: No error boundaries to catch component crashes
- **Implementation**: Create `client/src/components/ErrorBoundary.jsx`, wrap App and major routes
- **Impact**: Better user experience when errors occur, prevents white screen crashes

### JSON Parsing Implementation Results ✅
All unsafe `JSON.parse(order.items)` calls have been successfully replaced with safe parsing:
- ✅ `client/src/pages/PublicInvoice.jsx:26` - Updated to use `safeJSONParse()`
- ✅ `client/src/pages/OrderForm.jsx:98,170,171,186` - All 4 instances updated
- ✅ `client/src/pages/Invoice.jsx:87` - Updated to use `safeJSONParse()`
- ✅ `client/src/pages/CollectOrderForm.jsx:212` - Updated to use `safeJSONParse()`
- ✅ `client/src/pages/CollectedOrdersPage.jsx:55` - Updated to use `getOrderItems()`
- ✅ `client/src/components/OrderDeliveryCard.jsx:39,43,72` - All instances updated
- ✅ `client/src/components/OrderDeliveredCard.jsx:39,43,72` - All instances updated
- ✅ `client/src/components/OrderCollectCard.jsx:13` - Updated to use `getOrderItems()`
- ✅ `client/src/components/OrderCard.jsx:10` - Updated to use `getOrderItems()`
- ✅ `client/src/components/DepositsCard.jsx:9` - Updated to use `getOrderItems()`

### Implementation Notes
- **Test after each file change** to ensure functionality is preserved
- **Keep browser dev tools open** to catch errors immediately
- **Make incremental commits** after each successful step
- **Follow existing code patterns** and naming conventions
- **Rollback plan**: Use `git checkout -- <file>` for immediate rollback if issues occur

### Higher Priority Items Requiring Environment Changes
- **Database Credentials Security**: Hardcoded password in `server/db.js` (requires environment variables)
- **Environment Configuration**: Hardcoded URLs in API files (requires Vite env vars)
- **Authentication Security**: Plain text passwords in database (requires bcrypt + DB migration)