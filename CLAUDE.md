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
1. **Console.log Removal**: Removed 77+ debug console.log statements from client and server, improved server logging with ISO timestamps, preserved important console.error statements for error handling.

2. **Safe JSON Parsing Utility**: Created `client/src/utils/jsonUtils.js` with `safeJSONParse()`, `getOrderItems()`, and `hasValidItems()` functions. Updated 11 files to use safe JSON parsing instead of direct JSON.parse calls. Prevents application crashes from malformed JSON data while preserving all existing functionality.

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