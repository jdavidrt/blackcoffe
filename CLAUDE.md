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

### ⚠️ CRITICAL: Build Testing Requirement
**ALWAYS test builds after making code changes to catch syntax errors before deployment:**

**Backend Testing:**
```bash
# Test backend syntax (fast check)
node --check server/index.js

# Test full backend startup
npm run dev
```

**Frontend Testing:**
```bash
# Test frontend build (required before deployment)
cd client && npm run build

# Expected output: Should complete with "✓ modules transformed" and output dist files
# Warnings about 'use client' and chunk size are normal - only fail on actual errors
```

**When to Test:**
- ✅ After modifying any `.js` or `.jsx` files
- ✅ Before committing changes
- ✅ Before deploying to production
- ✅ After merging branches

**Common Syntax Errors to Watch For:**
- Mixed quote types in template literals (use backticks for template strings)
- Missing closing parentheses or brackets
- Incorrect arrow function syntax
- Import/export statement errors

## Architecture Overview

### Full-Stack Structure
This is a monorepo with separate client (React) and server (Express) applications. The backend serves the built frontend from `client/dist` in production, and both run separately in development.

### Database Integration
- **MySQL Database**: Hosted on DigitalOcean (credentials in `server/db.js`)
- **Connection Pool**: Uses mysql2/promise with connection pooling
- **Timezone Handling**: All timestamps use Colombia timezone (UTC-5)
  - **AUTO Timestamps** (`createdAt`, `depositCreatedAt`): Stored in UTC, retrieved with `CONVERT_TZ(field, '+00:00', '-05:00')`
  - **MANUAL Timestamps** (`paidAt`, `deliveredAt`): Sent by frontend in Colombia time
  - **COLOMBIA Timestamps** (`abandonedAt`, `deletedAt`): Stored using `DATE_SUB(NOW(), INTERVAL 5 HOUR)`
  - **Date Filtering**: Always use `DATE(CONVERT_TZ(field, '+00:00', '-05:00'))` for correct timezone
  - See [PROJECT_IMPROVEMENTS.md](docs/PROJECT_IMPROVEMENTS.md#timezone-implementation) for complete implementation guide
- **Key Tables**: orders, clients, products, users, deposits
- **Order States**: Orders track paid status, delivery status, and collection status

### API Architecture Pattern
The API follows a consistent RESTful pattern:
- **Routes** (`server/routes/*.routes.js`): Define endpoints and HTTP methods
- **Controllers** (`server/controllers/*.controllers.js`): Handle business logic and database queries
- **Frontend API Services** (`client/src/api/*.api.js`): Axios-based HTTP client functions
- **Dual Server Setup**: Frontend API calls point to `renderServer = 'https://coffeserver.onrender.com'` for production, but can work with local backend

### Complete API Endpoints Reference

The BlackCoffe backend exposes 33 RESTful API endpoints organized by entity. All endpoints are prefixed with the base URL (`http://localhost:25060` in development, `https://coffeserver.onrender.com` in production).

#### Orders Endpoints (15 endpoints)
**Base Route**: `/orders` | **Controller**: `orders.controllers.js` | **Route File**: `orders.routes.js`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/orders/` | Get all orders with client details (JOIN with clients table) |
| GET | `/order/:id` | Get single order by ID with client information |
| GET | `/orphanedOrders/` | Get orders without assigned clients (`clientId IS NULL` or invalid) |
| GET | `/notDeliveredOrders/` | Get all orders pending delivery (`delivered = 0`) |
| GET | `/deliveredOrders/:date` | Get orders delivered on specific date (Colombia timezone) |
| GET | `/collectedOrders/:date` | Get orders collected/paid on specific date |
| GET | `/depositedOrdersByDate/:date` | Get orders with deposits on specific date (includes partially and fully paid) |
| GET | `/unPaidOrders/:mall` | Get unpaid orders filtered by mall location (`paid = 0` AND `mall = :mall`) |
| GET | `/unPaidOrdersByClient/:clientId` | Get all unpaid orders for specific client |
| GET | `/abandonedOrders` | Get all abandoned orders (`isAbandoned = 1`) |
| POST | `/order` | Create new order (requires `clientId`, `items` JSON) |
| PUT | `/order/:id` | Update existing order (any field except ID) |
| PUT | `/order/:id/abandon` | Mark order as abandoned (sets `isAbandoned = 1`, records `abandonedAt`, `abandonedBy`, `abandonReason`) |
| PUT | `/order/:id/reactivate` | Reactivate abandoned order (sets `isAbandoned = 0`, clears abandonment fields) |
| DELETE | `/order/:id` | Soft delete order (actual deletion, not soft delete for orders) |

#### Clients Endpoints (6 endpoints)
**Base Route**: `/clients` | **Controller**: `clients.controllers.js` | **Route File**: `clients.routes.js`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/clients` | Get all clients across all locations |
| GET | `/clients/:mall` | Get clients filtered by mall location |
| GET | `/client/:id` | Get single client by ID |
| POST | `/client` | Create new client (requires `clientName`, `phone`, `premises`, `mall`) |
| PUT | `/client/:id` | Update existing client information |
| DELETE | `/client/:id` | Delete client (validation prevents deletion if active orders exist) |

#### Products Endpoints (5 endpoints)
**Base Route**: `/products` | **Controller**: `products.controllers.js` | **Route File**: `products.routes.js`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/products` | Get all products in catalog |
| GET | `/product/:id` | Get single product by ID |
| POST | `/product` | Create new product (requires `productName`, `productValue`) |
| PUT | `/product/:id` | Update product information (name, price, description) |
| DELETE | `/product/:id` | Delete product (validation prevents deletion if used in orders) |

#### Deposits Endpoints (5 endpoints)
**Base Route**: `/deposits` | **Controller**: `deposits.controllers.js` | **Route File**: `deposits.routes.js`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/deposits` | Get all deposits with order information (JOIN with orders and clients) |
| GET | `/deposits/:id` | Get all deposits for specific order ID (includes deleted deposits with `isDeleted` status) |
| GET | `/depositsByDate/:date` | Get all deposits made on specific date (Colombia timezone) |
| POST | `/deposits` | Create new deposit record (requires `orderId`, `clientId`, `depositValue`, `lastDeposit`, `newDeposit`, `dueOnDeposit`, `paymentMethod`) |
| DELETE | `/deposits/:id` | Soft delete deposit (sets `isDeleted = 1`, `deletedAt`, `deletedBy`, triggers automatic recalculation of subsequent deposits) |

#### Users Endpoints (1 endpoint)
**Base Route**: `/users` | **Controller**: `users.controllers.js` | **Route File**: `users.routes.js`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/users/:userName/:pass` | Authenticate user (⚠️ plaintext password, needs security improvement) |

#### Utility Endpoints (1 endpoint)
**Base Route**: `/` | **Route File**: `index.routes.js`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/ping` | Health check endpoint (returns database connection test: `SELECT 1 + 1`) |

---

#### API Request/Response Patterns

**Successful Response (200 OK)**:
```json
[
  {
    "id": 123,
    "field": "value"
  }
]
```

**Error Response (500 Internal Server Error)**:
```json
{
  "message": "Error description"
}
```

**Empty Result (200 OK)**:
```json
[]
```

#### Authentication
- **Current Implementation**: No authentication middleware on API endpoints
- **Login**: Single endpoint `/users/:userName/:pass` returns user object if credentials match
- **Session Management**: Handled client-side via localStorage

#### CORS Configuration
- **Development**: Enabled for all origins
- **Production**: Enabled for cross-origin requests (configured in `server/index.js`)

#### Error Handling
- Most endpoints lack try-catch blocks (improvement opportunity)
- Errors returned as `500` status with `{message: error.message}`
- Console.error used for server-side logging

---

### React Context State Management

BlackCoffe uses React Context API for centralized state management across 5 primary entities. Each entity follows a consistent pattern with Context + Provider architecture.

#### Architecture Pattern

**File Structure**:
```
client/src/context/
├── OrderContext.jsx + OrderProvider.jsx
├── ClientContext.jsx + ClientProvider.jsx
├── ProductContext.jsx + ProductProvider.jsx
├── DepositsContext.jsx + DepositsProvider.jsx
└── UserContext.jsx + UserProvider.jsx
```

**Pattern Components**:
1. **Context File** (`*Context.jsx`): Creates React context with `createContext()`
2. **Provider File** (`*Provider.jsx`): Implements state management and methods
3. **Custom Hook**: Each provider exports `use[Entity]()` hook (e.g., `useOrders()`)
4. **Error Handling**: Hooks throw error if used outside provider scope

#### Complete Context Provider Methods Reference

##### OrderProvider (14 methods)
**Hook**: `useOrders()`
**State**: `orders`, `unPaidOrder`, `abandonedOrders`

| Method | Parameters | Description |
|--------|------------|-------------|
| `loadOrders()` | none | Load all orders with client details |
| `loadUnDeliveredOrders()` | none | Load orders pending delivery (`delivered = 0`) |
| `loadDeliveredOrders(date)` | date | Load orders delivered on specific date |
| `loadCollectedOrders(date)` | date | Load orders collected/paid on specific date |
| `loadDepositedOrderByDate(date)` | date | Load orders with deposits on specific date |
| `loadOrphanedOrders()` | none | Load orders without assigned clients |
| `loadUnPaidOrders(mall)` | mall | Load unpaid orders filtered by location |
| `getOrder(id)` | id | Get single order by ID, returns order object |
| `getUnPaidOrdersbyClient(clientId)` | clientId | Get unpaid orders for specific client |
| `createOrder(order)` | order object | Create new order |
| `updateOrder(id, newFields)` | id, newFields | Update existing order |
| `deleteOrder(id)` | id | Delete order by ID |
| `getAbandonedOrders()` | none | Load all abandoned orders |
| `markOrderAsAbandoned(id, data)` | id, abandonData | Mark order as abandoned with reason |
| `unmarkOrderAsAbandoned(id)` | id | Reactivate abandoned order |

##### ClientProvider (6 methods)
**Hook**: `useClients()`
**State**: `clients`

| Method | Parameters | Description |
|--------|------------|-------------|
| `loadClients()` | none | Load all clients |
| `getClient(id)` | id | Get single client by ID |
| `createClient(client)` | client object | Create new client |
| `updateClient(id, newFields)` | id, newFields | Update existing client |
| `deleteClient(id)` | id | Delete client by ID |
| `toggleClientDone(id)` | id | Toggle client status (legacy method) |

##### ProductProvider (6 methods)
**Hook**: `useProducts()`
**State**: `products`

| Method | Parameters | Description |
|--------|------------|-------------|
| `loadProducts()` | none | Load all products from catalog |
| `getProduct(id)` | id | Get single product by ID |
| `createProduct(product)` | product object | Create new product |
| `updateProduct(id, newFields)` | id, newFields | Update existing product |
| `deleteProduct(id)` | id | Delete product by ID |
| `toggleProductDone(id)` | id | Toggle product status (legacy method) |

##### DepositsProvider (5 methods)
**Hook**: `useDeposits()`
**State**: `deposits`

| Method | Parameters | Description |
|--------|------------|-------------|
| `loadDeposits()` | none | Load all deposits with order information |
| `getDepositsByOrderId(id)` | orderId | Get all deposits for specific order |
| `getDepositsByDate(date)` | date | Get deposits made on specific date |
| `createDeposit(deposits)` | deposit object | Create new deposit record |
| `deleteDepositById(id)` | depositId | Soft delete deposit (triggers recalculation) |

##### UserProvider (1 method)
**Hook**: `useUser()`
**State**: `user`, `isAuthenticated`

| Method | Parameters | Description |
|--------|------------|-------------|
| `autenticateUser(userName, pass)` | userName, pass | Authenticate user and set session |

---

### Frontend API Service Layer

BlackCoffe uses Axios-based API service modules to communicate with the backend. All API calls are centralized in `client/src/api/` directory.

#### API Service Architecture

**Service Files**:
```
client/src/api/
├── orders.api.js    (15 functions)
├── clients.api.js   (6 functions)
├── products.api.js  (5 functions)
├── deposits.api.js  (5 functions)
└── users.api.js     (1 function)
```

**Configuration**:
- **Base URL**: Configured in `client/src/utils/config.js`
- **Development**: `http://localhost:25060`
- **Production**: `https://coffeserver.onrender.com`
- **HTTP Client**: Axios with automatic request/response handling

#### API Service Functions Reference

##### Orders API (`orders.api.js`) - 15 functions

| Function | HTTP Method | Endpoint | Description |
|----------|-------------|----------|-------------|
| `getOrdersRequest()` | GET | `/orders/` | Get all orders |
| `getOrderRequest(id)` | GET | `/order/:id` | Get single order |
| `getOrphanedOrdersRequest()` | GET | `/orphanedOrders/` | Get orders without clients |
| `getNotDeliveredOrdersRequest()` | GET | `/notDeliveredOrders/` | Get pending deliveries |
| `getDeliveredOrdersRequest(date)` | GET | `/deliveredOrders/:date` | Get deliveries by date |
| `getCollectedOrders(date)` | GET | `/collectedOrders/:date` | Get collections by date |
| `getDepositedOrdersByDate(date)` | GET | `/depositedOrdersByDate/:date` | Get orders with deposits by date |
| `getUnpaidOrders(mall)` | GET | `/unPaidOrders/:mall` | Get unpaid orders by location |
| `loadUnPaidOrdersbyClient(clientId)` | GET | `/unPaidOrdersByClient/:clientId` | Get client's unpaid orders |
| `createOrderRequest(order)` | POST | `/order` | Create new order |
| `updateOrderRequest(id, order)` | PUT | `/order/:id` | Update existing order |
| `deleteOrderRequest(id)` | DELETE | `/order/:id` | Delete order |
| `getAbandonedOrdersRequest()` | GET | `/abandonedOrders` | Get abandoned orders |
| `markOrderAsAbandonedRequest(id, data)` | PUT | `/order/:id/abandon` | Mark order as abandoned |
| `unmarkOrderAsAbandonedRequest(id)` | PUT | `/order/:id/reactivate` | Reactivate abandoned order |

##### Clients API (`clients.api.js`) - 6 functions

| Function | HTTP Method | Endpoint | Description |
|----------|-------------|----------|-------------|
| `getClientsRequest()` | GET | `/clients` | Get all clients |
| `getClientsbyMallRequest(mall)` | GET | `/clients/:mall` | Get clients by mall location |
| `getClientRequest(id)` | GET | `/client/:id` | Get single client |
| `createClientRequest(client)` | POST | `/client` | Create new client |
| `updateClientRequest(id, client)` | PUT | `/client/:id` | Update existing client |
| `deleteClientRequest(id)` | DELETE | `/client/:id` | Delete client |

##### Products API (`products.api.js`) - 5 functions

| Function | HTTP Method | Endpoint | Description |
|----------|-------------|----------|-------------|
| `getProductsRequest()` | GET | `/products` | Get all products |
| `getProductRequest(id)` | GET | `/product/:id` | Get single product |
| `createProductRequest(product)` | POST | `/product` | Create new product |
| `updateProductRequest(id, product)` | PUT | `/product/:id` | Update existing product |
| `deleteProductRequest(id)` | DELETE | `/product/:id` | Delete product |

##### Deposits API (`deposits.api.js`) - 5 functions

| Function | HTTP Method | Endpoint | Description |
|----------|-------------|----------|-------------|
| `getDepositsRequest()` | GET | `/deposits` | Get all deposits |
| `getDepositsByOrderRequest(id)` | GET | `/deposits/:id` | Get deposits for order |
| `getDepositsByDateRequest(date)` | GET | `/depositsByDate/:date` | Get deposits by date |
| `createDepositRequest(deposit)` | POST | `/deposits` | Create new deposit |
| `deleteDepositRequest(id)` | DELETE | `/deposits/:id` | Soft delete deposit |

##### Users API (`users.api.js`) - 1 function

| Function | HTTP Method | Endpoint | Description |
|----------|-------------|----------|-------------|
| `autenticateRequest(userName, pass)` | GET | `/users/:userName/:pass` | Authenticate user |

#### API Service Usage Pattern

**Example Usage in Components**:
```javascript
// Import API service functions
import { getOrdersRequest, createOrderRequest } from '../api/orders.api';

// Use in component
const loadData = async () => {
  const response = await getOrdersRequest();
  setOrders(response.data);
};

const handleCreate = async (orderData) => {
  await createOrderRequest(orderData);
  loadData(); // Refresh data
};
```

**Error Handling**:
- Most API functions don't have built-in error handling
- Components using API functions should wrap calls in try-catch blocks
- Errors typically returned as rejected promises

**Response Format**:
- Axios automatically parses JSON responses
- Data accessible via `response.data`
- Error responses accessible via `error.response`

---

### Order Management System
Orders are the central entity with complex state tracking:
- **Order States**: unpaid/paid, delivered/not delivered, collected/not collected, abandoned/active
- **Items Structure**: Orders contain JSON items with product details and delivery status
- **Location-Based**: Orders are filtered by mall and premises (numbered locations)
- **Date-Based Queries**: Many operations filter by date with timezone conversion
- **Payment Tracking**: Supports partial payments through deposits system
- **Abandoned Orders** 🆕: Orders can be marked as abandoned with reason tracking, excluded from active lists, and reactivated if needed

### Core Business Rules

#### 1. One Unpaid Order Per Client (Order Merging)
When creating a new order via `/nuevaOrden` for a client who already has an unpaid order, the system **merges new products into the existing order** instead of creating a second one. This prevents order fragmentation — each client has at most one active (unpaid) order at any time.

**Implementation flow:**
1. User selects a client in `OrderForm.jsx` → `selectClient()` (line 85-90) triggers `getUnPaidOrdersbyClient(clientId)`
2. `OrderProvider.jsx:89-96` fetches unpaid orders for that client and stores only the first result in `unPaidOrder` state
3. On form submit (`OrderForm.jsx:149-157`):
   - If `unPaidOrder && unPaidOrder.id` → calls `updateOrder()` with `[...existingItems, ...newCartItems]` (MERGE)
   - If no unpaid order exists → calls `createOrder()` (NEW ORDER)
4. After successful save in create mode: form resets (cart cleared, client cleared, mall defaults to "Alta Tecnología"), `resetUnPaidOrder()` called
5. After successful save in edit mode: navigates to `/`

**Backend validation:** `hasDuplicateItemIds()` in `orders.controllers.js:3-10` rejects submissions (HTTP 400) if duplicate item IDs are detected in the items JSON, preventing data corruption during merges.

#### 2. Item ID Generation & Uniqueness
Each product added to the cart receives a composite ID: `{productId} {HH:mm:ss} {DD/MM/YY}`

**Example:** Product ID `374` added at 5:08:30 PM on March 10, 2026 → `"374 17:08:30 10/03/26"`

- Generated at `OrderForm.jsx:299`: `product.id + ' ' + dayjs().format('HH:mm:ss DD/MM/YY')`
- Makes each addition globally unique, even for the same product added at different times or across merged orders
- Display utility `getItemDisplayTime()` in `orderUtils.js` strips seconds for readability: `"17:08 10/03/26"`

#### 3. Cart Quantity Logic
- **Adding from product catalog** (clicking + next to a product): Always creates a NEW cart item with a unique timestamp-based ID. Each click = new item entry.
- **+/- buttons on existing cart items** (`handleAddOneToCart`/`handleRemoveFromCart`): Modify quantity of that specific item by ID
- **Auto-removal:** Items reaching quantity 0 are automatically removed from the cart
- **After merge:** Items from different order sessions have different IDs and are NOT deduplicated by product name — they appear as separate line items

#### 4. Per-Item Delivery Tracking
Delivery is tracked at the **individual item level**, not at the order level. Each item in the order's JSON `items` array has:
- `delivered: boolean` — whether this item has been delivered (initially `false`)
- `deliveredAt: "YYYY-MM-DD"` — date delivered (initially `""`)

**Delivery workflow** (`OrderDeliveryCard.jsx`):
1. Delivery driver checks checkbox next to item
2. System sets `delivered = true`, `deliveredAt = getCurrentDate()`
3. Calls `updateOrder()` with updated items JSON
4. Page reloads after 3-second delay

**Backend query patterns:**
- Undelivered orders: `WHERE orders.items LIKE '%"delivered":false%'` (`orders.controllers.js:36`)
- Delivered by date: `WHERE orders.items LIKE CONCAT('%"deliveredAt":"', ?, '"%')` (`orders.controllers.js:65`)

#### 5. paidAt Conditional Logic (Fixed in commit 7dd34ea)
`paidAt` is **ONLY set when the order becomes fully paid** (`paid = 1`):
```javascript
const orderUpdate = {
  deposit: values.deposit,
  paid: values.paid,
  collectedBy: values.collectedBy,
  paymentMethod: values.paymentMethod,
  ...(values.paid === 1 && { paidAt: fechaActual }),  // CONDITIONAL
};
```
- Format: `YYYY-MM-DD` in Colombia local time via `dayjs().format('YYYY-MM-DD')`
- Null-safe read: `order.paidAt ? order.paidAt.slice(0, 10) : null` (in Invoice.jsx, PublicInvoice.jsx, CollectOrderForm.jsx)
- Backend validation: `DATE(orders.paidAt) = ? AND orders.paid = 1` in `getDepositedOrdersByDate` query
- **History:** Previously bugged — `paidAt` was set on every deposit regardless of payment status, causing 106 orders to have stale `paidAt` values while `paid = 0`

#### 6. Full Payment Detection
There is no "Cobrar Total" button — the user enters the exact remaining amount manually in the deposit field. The system auto-detects full payment:
```javascript
if (values.deposit >= calculateTotal()) {
  values.paid = 1;  // Mark as fully paid
}
```
- Payment confirmation modal shows: current debt (red), deposit amount (green), new debt (orange or green if zero)
- Green badge "Orden completamente pagada!" when new debt = 0
- Confirm button disabled when deposit amount = 0
- Overpayment prevention: validation rejects amounts exceeding remaining balance

#### 7. Known Bug: collectedBy Field
`collectedBy` is currently set to `order.mall` (e.g., "Unilago") in `CollectOrderForm.jsx:299,311` instead of the actual username who collected the payment. This should be fixed to capture `localStorage.getItem('user')`.

#### 8. Client Protection + Snapshot on Payment ✅ (Implemented in commit 3f68348; edit-lock relaxed 2026-07-02)
Two paired rules that keep historical orders readable even as the client master record changes. Orders always link to a client via the stable `clientId` FK (`orders.clientId → clients.id`) — never by matching name/premises/mall text — so editing a client's display fields never breaks that link, only *deleting* a client is destructive enough to warrant a hard block.

- **Block client deletion while client has active orders.** `deleteClient` (server/controllers/clients.controllers.js:84-104) checks `SELECT id FROM orders WHERE clientId = ? AND paid = 0 AND (isAbandoned = 0 OR isAbandoned IS NULL) LIMIT 1` and returns `400 { message, orderId }` if any active order is found. Uses a soft delete (`isDeleted = 1`).
- **Client edits are NOT blocked by active orders (changed 2026-07-02).** `updateClient` (server/controllers/clients.controllers.js:64-69) no longer runs an active-order check — `clientName`/`premises`/`mall`/`phoneNumber` can be changed freely even while the client has an active order, since `clientId` itself is never modified. Previously this was a hard `400` block, matching `deleteClient`'s behavior; that block was removed because it was preventing legitimate corrections (typo fixes, premises reassignment) with no integrity benefit.
- **Live linkage for active (unpaid) orders.** Unpaid orders never get a snapshot (see below), so their displayed `clientName`/`premises`/`mall` are always read live via `COALESCE(orders.*Snapshot, clients.*)`, which falls through to the current `clients` row. Consequence: editing a client's `mall` while they have an active order immediately moves that order between mall-filtered collection views (`/cobrarOrdenes/:mall`) — this is expected live-FK behavior, not a bug.
- **Frontend warns before editing a client with an active order.** `ClientForm.jsx` (edit mode) calls `loadUnPaidOrdersbyClient(id)` on submit; if an active order is found, it shows `Modal.confirm` ("Cliente con orden activa... ¿Desea continuar?", naming the order) before saving, since the change is live and immediately affects that order's display. No backend error round-trip is involved — this is a proactive check, not error handling.
- **Snapshot client fields onto the order when fully paid.** `updateOrder` (orders.controllers.js:281) captures `clientNameSnapshot`, `clientPremisesSnapshot`, `clientMallSnapshot` from the clients table when `paid` transitions to 1. All SELECT queries read display values via `COALESCE(orders.clientNameSnapshot, clients.clientName)` so historical (paid) orders survive subsequent client edits/deletes. Pre-fix orders have NULL snapshots — COALESCE falls back to live client data.
- **Frontend pattern for delete.** `ClientCard` still catches `error.response?.status === 400 && error.response?.data?.orderId` from `deleteClient` and renders a `Modal.error` with a link to `/cobrarOrden/:orderId`. This 400 path no longer applies to edits (see above). The provider methods re-throw rather than swallowing.

#### 9. Order Deletion Protection + Paid Order Immutability ✅ (Implemented 2026-05-12)
Extends rule #8 to the orders table itself. Once an order has accumulated payment history or has been fully paid, it becomes immutable.

- **Block order deletion when any deposits exist.** `deleteOrder` (orders.controllers.js:349) queries `SELECT depositId FROM deposits WHERE orderId = ? LIMIT 1` and returns `400 { message: "Order has deposits", orderId }` if found. **Includes soft-deleted deposits** (`isDeleted = 1`) — those rows exist precisely to preserve audit history, which is meaningless if the parent order is hard-deleted.
- **Block all modifications to paid orders.** `updateOrder` (orders.controllers.js:281) reads the current `paid` value before applying changes; if `paid = 1`, returns `400 { message: "Order is already paid and cannot be modified", orderId }`. This is intentionally a full freeze:
  - Items, quantities, `unitValue`, `clientId`, `deposit`, etc. cannot be changed.
  - **Delivery toggles are also blocked.** `OrderDeliveryCard` and `OrderDeliveredCard` both hide the checkbox when `order.paid === 1` and show a "Pagado – sin modificaciones" label. If a toggle somehow reaches the backend, both cards catch the 400 and surface a `Modal.error` linking to `/factura/:id`.
- **Frontend guard points.**
  - `OrderCard.jsx` (Edit button): pre-checks `order.paid === 1` and shows `Modal.error` instead of navigating to `/editarOrden/:id`.
  - `OrderForm.jsx` (edit mode): on order load, if `order.paid === 1`, shows `Modal.error` and navigates back to `/`. The submit catch also handles the 400 distinctly.
  - `OrphanedOrdersPage.jsx`: delete now uses `Modal.confirm` with `okType: 'danger'` (matching `ClientCard`) and surfaces the deposit-block error with a link to `/cobrarOrden/:orderId`.
  - `OrderProvider.deleteOrder` re-throws errors rather than swallowing (matches `updateOrder` pattern).

**Frontend error message catalog** (what users see for these guards):

| Trigger | Title | Body | Link target |
|---------|-------|------|-------------|
| Edit a paid order (OrderCard) | "Orden ya pagada" | "Esta orden ya fue pagada y no puede ser modificada." | `/factura/:id` |
| Navigate to `/editarOrden/:id` for a paid order | "Orden ya pagada" | "Esta orden ya fue pagada y no puede ser modificada." | `/factura/:id` (modal OK navigates back to `/`) |
| Submit form for a paid order (race condition) | "Orden ya pagada" | "Esta orden ya fue pagada y no puede ser modificada." | `/factura/:id` |
| Toggle item delivery on a paid order | "Orden ya pagada" | "Esta orden ya fue pagada y no puede modificarse, incluyendo el estado de entrega de sus productos." | `/factura/:id` |
| Delete an orphaned order with deposits | "Orden con abonos registrados" | "Esta orden tiene abonos registrados y no puede ser eliminada." | `/cobrarOrden/:id` |

All links use the full style set per the "Links inside Ant Design Modals" pattern below:
`style={{ color: '#1677ff', textDecoration: 'underline', fontWeight: '600', display: 'inline-block', marginTop: '4px' }}`.

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
- `isAbandoned`: Boolean flag (0=active, 1=abandoned) 🆕
- `abandonedAt`: Timestamp when order was abandoned 🆕
- `abandonedBy`: User who marked order as abandoned 🆕
- `abandonReason`: Reason for abandonment (optional text) 🆕

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

4. **Full Payment Entry**
   - User enters the exact remaining amount in the deposit field
   - System auto-detects full payment when `deposit >= calculateTotal()`

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
   - Payment recorded in daily collections (`/cobrosHoy`)
   - Order appears in collections view if fully paid

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
- `/cobrosHoy` - Daily payment collections (all orders with payments on selected date)
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
1. User enters remaining amount: 17,000 COP in deposit field
2. System detects: 35,000 + 17,000 = 52,000 >= order total
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

## Navigation Menu & Page Documentation

The BlackCoffe system provides a comprehensive navigation menu with role-based access. Below is detailed documentation for each page accessible through the navigation menu.

### 🔐 Authentication & Security

#### `/iniciarSesion` - Login Page
**Component**: `LoginForm.jsx`
**Access**: Public (no authentication required)
**Purpose**: User authentication and session management

**Features**:
- User credential validation
- Role-based access control (differentiates between "Black coffe Unilago" and admin users)
- Session persistence via localStorage
- Automatic redirect to main dashboard upon successful login

**User Roles**:
- **"Black coffe Unilago"**: Limited navigation menu (Nueva Orden, Recorrido, Cobrar Uni., Salir)
- **Admin/Standard User**: Full navigation menu access

---

### 📊 Dashboard & Order Management

#### `/` - Cuentas por Cobrar (Accounts Receivable Dashboard)
**Component**: `OrdersPage.jsx`
**Navigation**: "Cuentas por cobrar" (Yellow button)
**Purpose**: Main dashboard displaying all unpaid orders across all locations

**Features**:
- **Order Listing**: Displays all orders with pending payments (`paid = 0`)
- **Search Functionality**: Search by client name, premises, or order details
- **Filter by Mall**: View orders specific to each mall location
- **Order Status Indicators**: Visual indicators for payment status, delivery status, and collection status
- **Quick Actions**:
  - Edit order details
  - Delete orders
  - Navigate to payment interface
  - Generate PDF invoices
- **Order Metrics**: Total orders, total pending amount, orders by location

**Data Display**:
- Client information (name, premises, mall)
- Order items and quantities
- Order total amount
- Current deposit/payment status
- Order creation date
- Delivery status

**Navigation Actions**:
- Click order → View order details
- "Editar" → `/editarOrden/:id`
- "Cobrar" → `/cobrarOrden/:id`
- "Factura" → `/pdfOrden/:id`

---

#### `/nuevaOrden` - Nueva Orden (Create New Order)
**Component**: `OrderForm.jsx`
**Navigation**: "Nueva Orden" (Green button - emerald-900)
**Purpose**: Create new customer orders

**Features**:
- **Client Selection**: Dropdown to select existing client or create new client
- **Product Cart**:
  - Add products from catalog
  - Adjust quantities with +/- buttons
  - Real-time total calculation
  - Remove products from cart
- **Order Details**:
  - Optional delivery address
  - Order notes/comments
  - Delivery date selection
- **Form Validation**: Ensures client is selected and cart has items
- **Auto-save**: Order items stored as JSON in database

**Workflow**:
1. Select client (or create new client first)
2. Add products to cart with quantities
3. Adjust quantities as needed
4. Add delivery details (optional)
5. Submit order

**Technical Details**:
- Uses Formik for form handling
- Context API for products and clients state
- JSON serialization for order items
- Creates order with `paid = 0`, `delivered = 0`, `collected = 0`

---

#### `/editarOrden/:id` - Edit Order
**Component**: `OrderForm.jsx` (same as create, different mode)
**Navigation**: Accessed via "Editar" button on order cards
**Purpose**: Modify existing unpaid orders

**Features**:
- Pre-populated form with existing order data
- Modify client selection
- Update product cart (add/remove items, adjust quantities)
- Update delivery details
- Update order notes
- **Restrictions**: Cannot edit fully paid orders

**Warning System**:
- Confirmation modal before saving changes
- Prevents accidental modifications

---

### 💰 Payment & Collection Management

#### `/cobrosHoy` - Cobros del Día (Daily Collections)
**Component**: `DepositedOrdersPage.jsx`
**Navigation**: "Cobros del día" (Light grey button - slate-300)
**Purpose**: Unified daily payment collections report and financial tracking

**Features** (Enhanced 2025-10-05):
- **Date Selector**: View collections for any specific date
- **Payment Summary**:
  - Total collections for selected date (sum of actual deposits received)
  - Collections by mall location with formatted totals
  - Grand total in large, prominent display
- **Detailed Payment List**:
  - Client information with premises and mall
  - Order details with PAGADO badge for fully paid orders ✅ NEW
  - Individual payment amounts for that day
  - Remaining balance (if any)
- **Filtering**: Filter by mall location (Unilago, Alta Tecnología, C.F., Otros)
- **Visual Indicators**:
  - Green PAGADO badge for fully paid orders ✅ NEW
  - Deleted deposits excluded from all calculations
  - Color-coded mall filtering buttons
  - "Abonado este día" shows money received that specific day

**Backend Query** (Enhanced 2025-10-05):
- `getDepositedOrdersByDate()` includes `OR DATE(orders.paidAt) = ?` condition
- Captures ALL payment activity: deposits + orders marked as paid that day
- Filters by deposit creation date AND order paid date
- Returns complete order and deposit information

**Calculations** (Enhanced 2025-10-05):
- ✅ Correctly excludes deleted deposits from totals (`isDeleted = 1`)
- ✅ Accurate "Abonado este día" values per order (aggregates multiple deposits same day)
- ✅ Proper mall-based aggregation with formatted currency
- ✅ Grand total calculation across all malls
- ✅ Shows ONLY money received on selected date (not order totals)
- ✅ Handles edge case: orders paid without deposit records show full order total

**Display Logic** (OrderCollectCard - Enhanced 2025-10-05):
- **Orders with deposits**: Shows sum of `depositValue` for that day
- **Orders paid without deposits**: Shows full order total as "Abonado este día"
- **Partially paid orders**: Shows "Debe: $X" in red for remaining balance
- **Fully paid orders**: Displays green PAGADO badge

**Use Cases**:
- Daily financial reconciliation
- Cash register balancing
- Payment audit trail
- Financial reporting
- Tracking payment completion progress

**Important Notes**:
- Displays ALL orders with payment activity on the selected date
- Shows actual deposits received (not cumulative order totals)
- Multiple deposits same day are aggregated per order
- ✅ Replaces previous "Cuentas al día" functionality (merged 2025-10-05)
- Route `/ordenesPagas` automatically redirects here

---

#### `/cobrarOrdenes/:mall` - Cobrar por Ubicación (Collect by Location)
**Component**: `CollectOrdersPage.jsx`
**Navigation**:
- "Cobrar Uni." (Grey button - gray-600) → `/cobrarOrdenes/Unilago`
- "Cobrar Alta T." (Grey button - gray-600) → `/cobrarOrdenes/Alta%20Tecnología`
- "Cobrar C. F." (Grey button - gray-600) → `/cobrarOrdenes/Cliente%20Frecuente`
- "Cobrar Otros" (Grey button - gray-600) → `/cobrarOrdenes/Otros`

**Purpose**: Display orders ready for payment collection filtered by mall location

**Features**:
- **Location Filtering**: Shows only orders from specified mall
- **Order Display**:
  - Client name and premises
  - Order items and quantities
  - Total order amount
  - Current deposit amount
  - Remaining balance
- **Quick Payment Access**: Click order to navigate to payment interface
- **Visual Order Cards**: Color-coded by payment status
- **Sorting**: Orders sorted by premises number, then client name

**Mall Locations**:
- **Unilago**: Main location (Centro Comercial Unilago)
- **Alta Tecnología**: Technology mall location
- **Cliente Frecuente**: Frequent customer special location
- **Otros**: Other/miscellaneous locations

**Navigation Actions**:
- Click order card → `/cobrarOrden/:id` (payment interface)

---

#### `/cobrarOrden/:id` - Process Order Payment
**Component**: `CollectOrderForm.jsx`
**Navigation**: Accessed via order cards in "Cobrar por Ubicación" pages
**Purpose**: Process partial or full payments for orders

**Features**:
- **Order Summary Display**:
  - Client details
  - Order items breakdown
  - Order total calculation
  - Current deposit amount
  - Remaining balance
- **Payment Options**:
  - **Partial Payment**: Enter specific amount in deposit field
  - **Full Payment**: Enter exact remaining amount — system auto-detects full payment and marks order as paid
- **Payment Methods**:
  - Efectivo (Cash)
  - Plataforma (Digital Platform)
- **Payment History Table**:
  - All previous deposits for this order
  - Deposit amounts and timestamps
  - Payment methods used
  - Cumulative totals
  - **Delete Deposit** feature with trash icon ✅
- **Confirmation Modal**: Shows payment breakdown before processing
- **Real-time Calculations**:
  - Automatic balance updates
  - Payment validation (prevents overpayment)
  - Debt calculation after payment

**Payment Workflow**:
1. View order details and current balance
2. Choose payment method (Efectivo/Plataforma)
3. Enter payment amount OR click "Cobrar Total" for full payment
4. Review payment summary in confirmation modal
5. Confirm payment
6. Deposit record created in database
7. Order status updated (marked as paid if balance = 0)

**Delete Deposit Feature** ✅ (Implemented 2025-09-30):
- Trash can icon for each active deposit
- Confirmation modal before deletion
- Soft delete (maintains audit trail)
- Automatic recalculation of all subsequent deposits
- Protection: Cannot delete deposits from fully paid orders
- Visual feedback: Deleted deposits shown with [ELIMINADO] label and red background

**Technical Details**:
- Creates deposit record with `depositValue`, `lastDeposit`, `newDeposit`, `dueOnDeposit`
- Updates order `deposit` field with cumulative total
- Sets order `paid = 1` and `paidAt = timestamp` when fully paid
- Validates payment amounts to prevent overpayment
- Soft delete support for incorrect payments

---

#### `/abonos` - Abonos (Payment History & Audit Trail)
**Component**: `DepositsPage.jsx`
**Navigation**: "Abonos" (Grey button - gray-400)
**Purpose**: Complete payment audit trail and deposit history

**Features**:
- **Comprehensive Deposit List**:
  - All deposits across all orders (including deleted)
  - Client information
  - Order details
  - Deposit amounts
  - Payment methods
  - Timestamps
- **Search & Filter**:
  - Search by client name
  - Filter by date range
  - Filter by payment method
  - Filter by mall location
- **Deleted Deposit Visibility** ✅ (Updated 2025-10-01):
  - Shows ALL deposits including deleted ones
  - Deleted deposits styled with:
    - Grey background
    - Greyed out text with reduced opacity
    - Strike-through text
    - Red [ELIMINADO] label prefix
    - Disabled action buttons
- **Active Deposits Counter**: Header shows count of active deposits only
- **Deposit Details Display**:
  - Individual payment amount (`depositValue`)
  - Previous cumulative total (`lastDeposit`)
  - New cumulative total (`newDeposit`)
  - Remaining debt (`dueOnDeposit`)

**Use Cases**:
- Financial audit trail
- Payment history verification
- Tracking partial payment sequences
- Identifying incorrect payments (marked as deleted)
- Historical financial reporting

**Data Integrity**:
- Complete audit trail maintained
- Soft delete ensures no data loss
- All payment transactions preserved

---

#### `/ordenesPagas` - DEPRECATED - Redirects to `/cobrosHoy`
**Status**: ✅ DEPRECATED (Merged 2025-10-05)
**Previous Component**: `CollectedOrdersPage.jsx` (archived)
**Current Behavior**: Automatically redirects to `/cobrosHoy`

**Migration Note**:
This route previously showed "Cuentas al día" (fully paid orders). The functionality has been merged into the unified "Cobros del día" page (`/cobrosHoy`) which now displays:
- All orders with payment activity on selected date (partial + full payments)
- Orders that were fully paid on selected date (even without deposit records)
- Accurate daily collection totals excluding deleted deposits
- PAGADO badge for fully paid orders
- Better UI with formatted totals by mall and grand total

**Implementation Details** (Completed 2025-10-05):
- Backend query modified to include `OR DATE(orders.paidAt) = ?` condition
- Frontend enhanced with PAGADO badge and improved totals display
- OrderCollectCard updated to show full order total for orders paid without deposits
- Statistics section removed per user request (only daily sum of payments shown)
- All edge cases handled correctly

**For Users**:
- Bookmarks to `/ordenesPagas` will automatically redirect to `/cobrosHoy`
- No action required - navigation menu already updated
- All functionality preserved and enhanced in new unified page

**For Developers**:
- Original component archived at `client/src/pages/_archived/CollectedOrdersPage.jsx`
- Route configured with `<Navigate>` redirect in `App.jsx` (line 56)
- Backend: `getDepositedOrdersByDate()` in `orders.controllers.js` (lines 65-105)
- Frontend: Enhanced `DepositedOrdersPage.jsx` and `OrderCollectCard.jsx`
- See [PROJECT_IMPROVEMENTS.md](docs/PROJECT_IMPROVEMENTS.md#-4-page-merge-cobros-del-día--cuentas-al-día-completed) for complete planning and implementation details

---

### 🚚 Delivery Management

#### `/recorrido` - Recorrido (Delivery Routes)
**Component**: `DeliveryOrdersPage.jsx`
**Navigation**: "Recorrido" (Orange button - orange-700)
**Purpose**: Manage delivery routes and track orders awaiting delivery

**Features**:
- **Delivery Queue**: Lists all orders ready for delivery
- **Route Organization**:
  - Grouped by mall/location
  - Sorted by premises for efficient routing
  - Optimized delivery sequence
- **Order Details**:
  - Client name and location
  - Delivery address
  - Order items
  - Delivery status
- **Delivery Actions**:
  - Mark items as delivered
  - Update delivery status
  - Partial delivery support (mark individual items)
- **Visual Route Planning**: Color-coded by location for easy route planning

**Delivery Workflow**:
1. View all pending deliveries
2. Plan route by location/premises
3. Mark items as delivered during route
4. Update delivery status in real-time

**Technical Details**:
- Updates order items JSON to mark individual products as delivered
- Tracks delivery timestamps
- Supports partial deliveries (some items delivered, others pending)

---

#### `/entregados` - Entregados (Delivered Orders)
**Component**: `DeliveredOrdersPage.jsx`
**Navigation**: "Entregados" (accessed via link, not in main nav menu)
**Purpose**: Track completed deliveries and delivery history

**Features**:
- **Delivery History**: All orders with completed deliveries
- **Date Filtering**: View deliveries by specific date
- **Delivery Verification**:
  - Confirm items were delivered
  - View delivery timestamps
  - Track delivery completion
- **Order Status**: Shows which orders are fully delivered vs partially delivered
- **Search & Filter**: Search by client, date, or location

**Use Cases**:
- Delivery confirmation
- Delivery performance tracking
- Historical delivery records
- Customer service verification

---

### 👥 Customer & Product Management

#### `/clientes` - Clientes (Customer Management)
**Component**: `ClientsPage.jsx`
**Navigation**: "Clientes" (Sky blue button - sky-800)
**Purpose**: Manage customer database and customer information

**Features**:
- **Customer Directory**:
  - All registered customers
  - Customer contact information
  - Premises/location assignments
  - Mall associations
- **Search Functionality**: Search by name, premises, or phone
- **Customer Actions**:
  - Create new customer
  - Edit customer details
  - Delete customers (with validation)
  - View customer order history
- **Customer Information Display**:
  - Full name
  - Phone number
  - Premises/local number
  - Mall location
  - Email (if available)
  - Customer ID

**Navigation Actions**:
- "Nuevo Cliente" button → `/nuevoCliente`
- "Editar" button → `/editarCliente/:id`
- Delete button → Confirmation modal → Delete customer

**Data Validation**:
- Cannot delete customers with active orders
- Duplicate customer detection

---

#### `/nuevoCliente` - Create New Customer
**Component**: `ClientForm.jsx`
**Navigation**: "Nuevo Cliente" button on Clientes page
**Purpose**: Register new customers in the system

**Features**:
- **Customer Information Form**:
  - Full name (required)
  - Phone number (required)
  - Premises/local number (required)
  - Mall selection (required)
  - Email (optional)
- **Form Validation**:
  - Required field validation
  - Phone number format validation
  - Duplicate detection
- **Mall Selection Dropdown**:
  - Unilago
  - Alta Tecnología
  - Cliente Frecuente
  - Otros

**Workflow**:
1. Fill in customer details
2. Select mall location
3. Submit form
4. Customer created and added to database
5. Redirect to customers list

---

#### `/editarCliente/:id` - Edit Customer
**Component**: `ClientForm.jsx` (same component, edit mode)
**Navigation**: "Editar" button on customer cards
**Purpose**: Update existing customer information

**Features**:
- Pre-populated form with current customer data
- Update any customer field
- Form validation
- Confirmation before saving changes

**Restrictions**:
- Cannot change customer ID
- Customer name uniqueness validation

---

#### `/productos` - Productos (Product Catalog)
**Component**: `ProductsPage.jsx`
**Navigation**: "Productos" (Sky blue button - sky-800)
**Purpose**: Manage product catalog and pricing

**Features**:
- **Product Catalog Display**:
  - All available products
  - Product names
  - Prices
  - Product descriptions
  - Product availability status
- **Product Management**:
  - Create new products
  - Edit product details
  - Delete products
  - Update pricing
- **Search Functionality**: Search products by name or description
- **Product Cards**: Visual display of each product with quick actions

**Navigation Actions**:
- "Nuevo Producto" button → `/nuevoProducto`
- "Editar" button → `/editarProducto/:id`
- Delete button → Confirmation → Delete product

**Data Validation**:
- Cannot delete products used in active orders
- Unique product name validation

---

#### `/nuevoProducto` - Create New Product
**Component**: `ProductForm.jsx`
**Navigation**: "Nuevo Producto" button on Productos page
**Purpose**: Add new products to the catalog

**Features**:
- **Product Information Form**:
  - Product name (required)
  - Product price (required)
  - Product description (optional)
  - Category (optional)
- **Form Validation**:
  - Required fields
  - Price format validation
  - Duplicate product name detection
- **Price Input**: Formatted currency input

**Workflow**:
1. Enter product details
2. Set price
3. Submit form
4. Product added to catalog
5. Redirect to products list

---

#### `/editarProducto/:id` - Edit Product
**Component**: `ProductForm.jsx` (same component, edit mode)
**Navigation**: "Editar" button on product cards
**Purpose**: Update product information and pricing

**Features**:
- Pre-populated form with current product data
- Update product name, price, description
- Form validation
- Confirmation before saving

**Use Cases**:
- Price updates
- Product name corrections
- Description updates
- Product information maintenance

---

### 🔧 Utility & Special Pages

#### `/ordenesSinCliente` - Sin Usuario (Orphaned Orders)
**Component**: `OrphanedOrdersPage.jsx`
**Navigation**: "Sin Usuario" (Red button - red-600)
**Purpose**: Manage orders without assigned customers (data integrity issue resolution)

**Features**:
- **Orphaned Order Detection**: Lists orders where `clientId` is null or invalid
- **Client Assignment**: Ability to assign customer to orphaned orders
- **Order Details**: Full order information display
- **Resolution Actions**:
  - Assign existing customer
  - Create new customer and assign
  - Delete orphaned order (if invalid)

**Use Cases**:
- Data integrity cleanup
- Fix orders created with missing customer data
- System maintenance
- Database error resolution

**Technical Details**:
- Query: `SELECT * FROM orders WHERE clientId IS NULL OR clientId NOT IN (SELECT id FROM clients)`
- Allows reassignment of customer to order
- Prevents orphaned orders from affecting reports

---

#### `/factura/:id` - Public Invoice View
**Component**: `PublicInvoice.jsx`
**Access**: Public (no authentication required)
**Purpose**: Customer-facing invoice view

**Features**:
- **Public Access**: No login required (accessible via link/QR code)
- **Professional Invoice Display**:
  - Company branding
  - Customer information
  - Order details
  - Itemized product list
  - Quantities and prices
  - Order total
  - Payment status
- **Printable Format**: Optimized for printing
- **QR Code Support**: Can be accessed via QR code on printed receipts

**Use Cases**:
- Customer invoice viewing
- Order confirmation
- Email invoice links
- Mobile invoice access
- Physical receipt QR codes

---

#### `/pdfOrden/:id` - PDF Invoice Generation
**Component**: `Invoice.jsx`
**Navigation**: "Factura" button on order cards (or accessed programmatically)
**Purpose**: Generate printable PDF invoices

**Features**:
- **PDF Generation**: Uses React-PDF library
- **Professional Layout**:
  - Company header with branding
  - Invoice number
  - Customer details
  - Order date
  - Itemized products with quantities and prices
  - Subtotals and totals
  - Payment information
- **Print Optimized**: Formatted for thermal/standard printers
- **Download Support**: Can download or print directly

**Technical Details**:
- Uses `@react-pdf/renderer` library
- Custom fonts (ShareTechMono)
- Responsive layout for different paper sizes
- Real-time PDF rendering

**Use Cases**:
- Customer invoices
- Accounting records
- Order receipts
- Financial documentation

---

#### `*` - Not Found Page
**Component**: `NotFound.jsx`
**Access**: Any invalid route
**Purpose**: Handle 404 errors gracefully

**Features**:
- Friendly 404 error message
- Navigation back to main dashboard
- Helpful links to common pages

---

### Navigation Menu Summary

**Standard User Full Menu** (Updated 2025-10-05):
1. **Cuentas por cobrar** (Yellow) - Main dashboard `/`
2. **Cobros del día** (Light grey) - Daily collections `/cobrosHoy` ⭐ ENHANCED (2025-10-05)
3. **Nueva Orden** (Green) - Create order `/nuevaOrden`
4. **Recorrido** (Orange) - Delivery routes `/recorrido`
5. **Cobrar Uni.** (Grey) - Collect Unilago `/cobrarOrdenes/Unilago`
6. **Cobrar Alta T.** (Grey) - Collect Alta Tecnología `/cobrarOrdenes/Alta%20Tecnología`
7. **Cobrar C. F.** (Grey) - Collect Frequent Customers `/cobrarOrdenes/Cliente%20Frecuente`
8. **Cobrar Otros** (Grey) - Collect Others `/cobrarOrdenes/Otros`
9. **Abonos** (Light grey) - Payment history `/abonos`
10. **Sin Usuario** (Red) - Orphaned orders `/ordenesSinCliente`
11. **Abandonadas** (Orange) - Abandoned orders `/ordenesAbandonadas`
12. **Productos** (Sky blue) - Product catalog `/productos`
13. **Clientes** (Sky blue) - Customer management `/clientes`
14. **Salir** (Dark red) - Logout

**Notes**:
- ✅ "Cuentas al día" removed - functionality merged into "Cobros del día" (item #2) on 2025-10-05
- "Cobros del día" now shows ALL payment activity for selected date (deposits + full payments)
- "Abandonadas" added (2025-10-04) - Track and manage abandoned orders

**Limited User Menu** ("Black coffe Unilago" - Lines 54-68 in Navbar.jsx):
1. **Nueva Orden** (Green) - Create order `/nuevaOrden`
2. **Recorrido** (Orange) - Delivery routes `/recorrido`
3. **Cobrar Uni.** (Grey) - Collect Unilago only `/cobrarOrdenes/Unilago`
4. **Salir** (Dark red) - Logout

---

### Page Access Patterns & Workflow Integration

**Order Lifecycle Flow**:
1. **Create Order** (`/nuevaOrden`) → Order created with `paid = 0`
2. **View Unpaid** (`/` - Cuentas por cobrar) → Order appears in dashboard
3. **Collect Payment** (`/cobrarOrdenes/:mall` → `/cobrarOrden/:id`) → Process payments
4. **Track Payments** (`/abonos`, `/cobrosHoy`) → Monitor payment history
5. **Fully Paid** → Order marked as `paid = 1`, visible in `/cobrosHoy` on payment date
6. **Delivery** (`/recorrido`) → Deliver items to customer
7. **Completed** (`/entregados`) → Order fully delivered and paid

**Financial Reporting Flow**:
1. Daily collections → `/cobrosHoy` (all payments received on selected date)
2. Payment audit → `/abonos` (complete deposit history)
3. Outstanding → `/` (unpaid orders)
4. Payment statistics → `/cobrosHoy` (fully paid vs partial payments)

**Customer Management Flow**:
1. View customers → `/clientes`
2. Create customer → `/nuevoCliente`
3. Edit customer → `/editarCliente/:id`
4. Customer used in → `/nuevaOrden` (order creation)

**Product Management Flow**:
1. View products → `/productos`
2. Create product → `/nuevoProducto`
3. Edit product → `/editarProducto/:id`
4. Products used in → `/nuevaOrden` (order creation)

### Development Patterns
- **File Naming**: Consistent `.jsx` extension for React components
- **Component Structure**: Pages in `pages/`, reusable components in `components/`
- **Styling**: TailwindCSS + Ant Design components
- **Form Handling**: Formik for complex forms
- **PDF Generation**: React-PDF for invoice generation
- **Authentication**: localStorage-based session management with route protection
- **Button Types**: ⚠️ **CRITICAL** - Always use `type="button"` for buttons inside forms that should NOT submit the form. Only buttons intended to submit should omit the type attribute or use `type="submit"`. This prevents accidental form submissions when interacting with UI elements like "Mostrar más", "+/-" quantity controls, delete buttons, etc.
- **Links inside Ant Design Modals**: ⚠️ **RECURRING BUG** - Never rely solely on `style={{ color: '...' }}` for `<a>` tags inside `Modal.error()` / `Modal.confirm()` content. Tailwind's base reset (`color: inherit`) overrides it, making the link invisible (white on white) until hover. Always use the full style set: `style={{ color: '#1677ff', textDecoration: 'underline', fontWeight: '600', display: 'inline-block', marginTop: '4px' }}`. This bug has recurred multiple times.

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

4. **Page Merge: Cobros del Día + Cuentas al Día** ✅ **COMPLETED** (2025-10-05 - 3 hours): Merged "Cuentas al día" functionality into unified "Cobros del día" page. Enhanced UI with formatted totals by mall, grand total display, and PAGADO badge for fully paid orders. Backend query enhanced to include orders paid on selected date. Frontend updated to handle edge cases (orders paid without deposits). Implemented graceful route redirect from `/ordenesPagas` to `/cobrosHoy`. Archived original `CollectedOrdersPage.jsx` for reference. Files modified: 3 (DepositedOrdersPage.jsx, OrderCollectCard.jsx, CLAUDE.md). Backend already included necessary query logic. See [PROJECT_IMPROVEMENTS.md](docs/PROJECT_IMPROVEMENTS.md#-4-page-merge-cobros-del-día--cuentas-al-día-completed) for complete planning details.

5. **Client Protection + Snapshot on Payment** ✅ **COMPLETED** (commit 3f68348; edit-lock relaxed 2026-07-02, see #7): Clients cannot be deleted while they have active (unpaid + non-abandoned) orders — `deleteClient` returns `400 { orderId }` when blocked, and `ClientCard` surfaces a `Modal.error` linking to the offending order. **Editing is no longer blocked** — see #7 below. When an order transitions to `paid = 1`, `clientNameSnapshot`/`clientPremisesSnapshot`/`clientMallSnapshot` are captured onto the order row. All order read queries use `COALESCE(snapshot, live)` so historical (paid) orders survive client edits/deletes. Pre-fix orders fall back to live data via COALESCE — no destructive backfill. See Rule #8 in "Core Business Rules" above.

6. **Order Deletion Protection + Paid Order Immutability** ✅ **COMPLETED** (2026-05-12): Extends the integrity pattern from #5 to the orders table. `deleteOrder` rejects with `400 { orderId }` when ANY deposit row exists for the order (including soft-deleted ones — required to keep the audit trail anchored). `updateOrder` reads the existing `paid` value before any change; if `paid = 1`, returns `400 { orderId }` with no exceptions (delivery toggles included, matching the "Pagado – sin modificaciones" UI label). Frontend: `OrderCard` pre-checks `paid` on Edit click; `OrderForm` guards in edit mode on load and on submit; `OrphanedOrdersPage` uses `Modal.confirm` (`okType: 'danger'`) for delete + surfaces the deposit-block 400; `OrderProvider.deleteOrder` re-throws errors. `OrderDeliveredCard` now hides the checkbox when `paid = 1`, matching `OrderDeliveryCard`. Files modified: 7 (1 backend, 6 frontend). See Rule #9 in "Core Business Rules" above for the full error message catalog.

7. **Client Edit Unlocked While Active Order Exists** ✅ **COMPLETED** (2026-07-02): Relaxed the edit half of Rule #8. `updateClient` (clients.controllers.js:64) no longer blocks edits when the client has an active (unpaid, non-abandoned) order — orders link to clients via the stable `clientId` FK, which `updateClient` never touches, so renaming a client or changing their `premises`/`mall`/`phoneNumber` is safe regardless of order status. `deleteClient` is unchanged and still blocks deletion. Frontend (`ClientForm.jsx`) now proactively calls `loadUnPaidOrdersbyClient(id)` before submitting an edit and shows a `Modal.confirm` warning (naming the active order) if one exists, since the change is live and will immediately be reflected on that order's display — including moving it between mall-filtered collection views if `mall` changes. The old dead-end `400`/`orderId` `Modal.error` handler in `ClientForm.jsx` (which only ever fired for this now-removed backend check) was removed. Files modified: 2 (1 backend, 1 frontend). See Rule #8 in "Core Business Rules" above for full details.

**Implementation Summary**:
- ✅ Backend: Query already included `OR DATE(orders.paidAt) = ?` condition (no changes needed)
- ✅ Frontend: Enhanced DepositedOrdersPage.jsx with better totals display (removed statistics per user request)
- ✅ OrderCollectCard: Added PAGADO badge and logic to show full order total for orders paid without deposits
- ✅ Navigation: Redirect already configured in App.jsx line 56
- ✅ Archive: CollectedOrdersPage.jsx already in `_archived` folder
- ✅ Documentation: Updated CLAUDE.md with implementation details

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
- ✅ `client/src/pages/DepositedOrdersPage.jsx` - Uses safe parsing throughout
- ✅ `client/src/components/OrderDeliveryCard.jsx:39,43,72` - All instances updated
- ✅ `client/src/components/OrderDeliveredCard.jsx:39,43,72` - All instances updated
- ✅ `client/src/components/OrderCollectCard.jsx:13` - Updated to use `getOrderItems()`
- ✅ `client/src/components/OrderCard.jsx:10` - Updated to use `getOrderItems()`
- ✅ `client/src/components/DepositsCard.jsx:9` - Updated to use `getOrderItems()`

**Note**: `CollectedOrdersPage.jsx` archived (2025-10-04) - functionality merged into `DepositedOrdersPage.jsx`

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

## 📚 Additional Documentation

### Technical Documentation
- **[PROJECT_IMPROVEMENTS.md](docs/PROJECT_IMPROVEMENTS.md)** - Comprehensive technical documentation consolidating all implementation guides
  - **Deployment Guide**: Production deployment configuration, build process, and environment setup
  - **Database Schema**: Full table definitions, relationships, and soft-delete/protection rules for clients, orders, and deposits
  - **Timezone Implementation**: Complete timezone handling for Colombia (UTC-5) with database patterns and best practices
  - **Completed Improvements**: Full documentation of implemented features including delete deposits, safe JSON parsing, utility functions, page merges, client/order protection rules, and the client edit unlock
  - **Feature Implementation Guides**: Invoice payment enhancements, progressive product reveal, and UI improvements
  - **Code Improvement Opportunities**: Security enhancements, error handling, performance optimizations
  - **Implementation Guides**: Step-by-step instructions for all improvements with code examples

### Project Documentation
- **[README.md](README.md)** - Project overview, setup instructions, and architecture