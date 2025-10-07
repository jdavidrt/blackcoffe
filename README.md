# BlackCoffe ☕ - Café Order Management System

## 🌟 Project Overview

BlackCoffe is an elegant and efficient order management system designed for cafés, weaving together technology and hospitality. Born from the intricate dance of commerce and customer experience, this system transforms the complex world of café operations into a streamlined digital symphony.

## 🚀 Core Architecture

### Technology Stack
- **Frontend**: React.js with Vite - Crafting responsive and dynamic user interfaces
- **Backend**: Express.js - Providing robust server-side logic
- **Database**: MySQL (DigitalOcean) - Ensuring data integrity and reliable storage
- **Timezone**: Colombia (UTC-5) - All timestamps displayed in Colombia local time
- **Styling**: TailwindCSS + Ant Design - Modern and responsive UI components
- **PDF Generation**: React-PDF - For invoice and document generation

### Additional Dependencies
- **State Management**: React Context API
- **Routing**: React Router DOM
- **HTTP Client**: Axios
- **Form Handling**: Formik
- **Date Handling**: Day.js
- **Icons**: Ant Design Icons

## 📁 Project Structure

```
blackcoffe/
├── 📁 client/                    # Frontend React application
│   ├── 📁 public/               # Static assets
│   ├── 📁 src/
│   │   ├── 📁 api/              # API service layer
│   │   │   ├── clients.api.js   # Client management API calls
│   │   │   ├── deposits.api.js  # Deposit/payment API calls
│   │   │   ├── orders.api.js    # Order management API calls
│   │   │   ├── products.api.js  # Product catalog API calls
│   │   │   └── users.api.js     # User authentication API calls
│   │   ├── 📁 components/       # Reusable UI components
│   │   │   ├── ClientCard.jsx   # Customer information display
│   │   │   ├── DepositsCard.jsx # Payment tracking component
│   │   │   ├── Navbar.jsx       # Navigation component
│   │   │   ├── OrderCard.jsx    # Order display component
│   │   │   ├── OrderCollectCard.jsx # Order collection interface
│   │   │   ├── OrderDeliveredCard.jsx # Delivered order tracking
│   │   │   ├── OrderDeliveryCard.jsx # Delivery management
│   │   │   ├── ProductCard.jsx  # Product display component
│   │   │   └── SearchBar.jsx    # Search functionality
│   │   ├── 📁 context/          # React Context providers
│   │   │   ├── ClientContext.jsx & ClientProvider.jsx
│   │   │   ├── DepositsContext.jsx & DepositsProvider.jsx
│   │   │   ├── OrderContext.jsx & OrderProvider.jsx
│   │   │   ├── ProductContext.jsx & ProductProvider.jsx
│   │   │   └── UserContext.jsx & UserProvider.jsx
│   │   ├── 📁 pages/            # Application pages/views
│   │   │   ├── ClientForm.jsx   # Customer creation/editing
│   │   │   ├── ClientsPage.jsx  # Customer management dashboard
│   │   │   ├── CollectedOrdersPage.jsx # Completed orders view
│   │   │   ├── CollectOrderForm.jsx # Order payment interface
│   │   │   ├── CollectOrdersPage.jsx # Orders ready for collection
│   │   │   ├── DeliveredPage.jsx # Delivered orders tracking
│   │   │   ├── DeliveryPage.jsx # Delivery route management
│   │   │   ├── DepositedOrdersPage.jsx # Daily collections view
│   │   │   ├── DepositsPage.jsx # Payment history
│   │   │   ├── Invoice.jsx      # PDF invoice generation
│   │   │   ├── LoginForm.jsx    # User authentication
│   │   │   ├── NotFound.jsx     # 404 error page
│   │   │   ├── OrderForm.jsx    # Order creation/editing
│   │   │   ├── OrdersPage.jsx   # Main orders dashboard
│   │   │   ├── ProductForm.jsx  # Product creation/editing
│   │   │   ├── ProductsPage.jsx # Product catalog management
│   │   │   └── PublicInvoice.jsx # Public invoice view
│   │   ├── 📁 fonts/            # Custom fonts
│   │   ├── App.jsx              # Main application component
│   │   ├── main.jsx             # Application entry point
│   │   ├── App.css & index.css  # Styling files
│   ├── package.json             # Frontend dependencies
│   ├── vite.config.js           # Vite configuration
│   ├── tailwind.config.cjs      # TailwindCSS configuration
│   └── postcss.config.cjs       # PostCSS configuration
├── 📁 server/                   # Backend Express application
│   ├── 📁 controllers/          # Business logic controllers
│   │   ├── clients.controllers.js # Customer management logic
│   │   ├── deposits.controllers.js # Payment processing logic
│   │   ├── orders.controllers.js # Order management logic
│   │   ├── products.controllers.js # Product catalog logic
│   │   └── users.controllers.js # User authentication logic
│   ├── 📁 routes/               # API route definitions
│   │   ├── clients.routes.js    # Customer API endpoints
│   │   ├── deposits.routes.js   # Payment API endpoints
│   │   ├── index.routes.js      # General API endpoints
│   │   ├── orders.routes.js     # Order API endpoints
│   │   ├── products.routes.js   # Product API endpoints
│   │   └── users.routes.js      # User API endpoints
│   ├── config.js                # Server configuration
│   ├── db.js                    # Database connection setup
│   └── index.js                 # Server entry point
├── 📁 .vscode/                  # VS Code configuration
├── package.json                 # Backend dependencies
├── package-lock.json            # Dependency lock files
└── README.md                    # Project documentation
```

## 🗺️ Application Site Map & Navigation Guide

### Public Routes
- `/factura/:id` - Public invoice view (no authentication required)

### Authentication
- `/iniciarSesion` - Login page

### Main Application Routes
```
📱 Main Dashboard
├── `/` - Orders Dashboard (OrdersPage)
│   ├── Create New Order → `/nuevaOrden`
│   └── Edit Order → `/editarOrden/:id`
│
├── 👥 Customer Management
│   ├── `/clientes` - Customers Dashboard (ClientsPage)
│   ├── `/nuevoCliente` - Create Customer (ClientForm)
│   └── `/editarCliente/:id` - Edit Customer (ClientForm)
│
├── 🍵 Product Management
│   ├── `/productos` - Products Dashboard (ProductsPage)
│   ├── `/nuevoProducto` - Create Product (ProductForm)
│   └── `/editarProducto/:id` - Edit Product (ProductForm)
│
├── 💰 Order Processing & Payments
│   ├── `/cobrarOrdenes/:mall` - Orders to Collect by Location
│   ├── `/cobrarOrden/:id` - Process Order Payment (Partial/Full)
│   ├── `/ordenesPagas` - Completed Orders (Fully Paid)
│   ├── `/abonos/` - Payment History & Deposits Audit Trail
│   └── `/cobrosHoy/` - Today's Collections & Financial Reports
│
├── 🚚 Delivery Management
│   ├── `/recorrido/` - Delivery Routes
│   └── `/entregados/` - Delivered Orders
│
└── 📄 Documents & Reports
    ├── `/pdfOrden/:id` - Generate Order Invoice (PDF)
    └── `/factura/:id` - Public Invoice View
```

---

## 📖 Comprehensive Page Documentation

### 🔐 Authentication & Security

#### Login Page (`/iniciarSesion`)
**Component**: `LoginForm.jsx`

User authentication gateway with role-based access control. The system differentiates between "Black coffe Unilago" users (limited menu access) and admin users (full access). Session persists via localStorage and redirects authenticated users to the main dashboard.

---

### 📊 Dashboard & Order Management

#### Main Dashboard - Cuentas por Cobrar (`/`)
**Component**: `OrdersPage.jsx` | **Navigation**: Yellow "Cuentas por cobrar" button

Central hub displaying all unpaid orders across all mall locations. Features comprehensive search, mall-based filtering, and quick actions for editing, payment processing, and invoice generation. Shows order status indicators for payment, delivery, and collection states.

**Key Actions**: View orders, Search by client/premises, Edit orders, Process payments, Generate invoices

#### Create New Order (`/nuevaOrden`)
**Component**: `OrderForm.jsx` | **Navigation**: Green "Nueva Orden" button

Interactive order creation interface with client selection, dynamic product cart, quantity adjustments, and delivery details. Uses Formik for form handling and Context API for state management. Orders are created with initial status of unpaid, undelivered, and uncollected.

**Workflow**: Select client → Add products → Adjust quantities → Add delivery details → Submit

#### Edit Order (`/editarOrden/:id`)
**Component**: `OrderForm.jsx` | **Access**: Via "Editar" button on order cards

Modify existing unpaid orders including client selection, product cart updates, and delivery details. Includes confirmation modals to prevent accidental modifications. Cannot edit fully paid orders.

---

### 💰 Payment & Collection Management

#### Today's Collections (`/cobrosHoy`)
**Component**: `DepositedOrdersPage.jsx` | **Navigation**: Light grey "Cobros del día" button

Daily financial reporting tool showing all payments collected on a specific date. Features date selector, payment summaries by mall location, payment method breakdown (Cash vs Platform), and detailed payment lists. Excludes deleted deposits from calculations (fixed 2025-10-01).

**Use Cases**: Daily financial reconciliation, Cash register balancing, Payment audit trail, Financial reporting

#### Collect by Location (`/cobrarOrdenes/:mall`)
**Component**: `CollectOrdersPage.jsx` | **Navigation**: Grey "Cobrar" buttons

Location-filtered order collection views for efficient payment processing:
- **Cobrar Uni.** → Unilago location
- **Cobrar Alta T.** → Alta Tecnología mall
- **Cobrar C. F.** → Cliente Frecuente (frequent customers)
- **Cobrar Otros** → Other locations

Displays orders with client details, order items, total amounts, current deposits, and remaining balances. Click any order to navigate to payment interface.

#### Process Order Payment (`/cobrarOrden/:id`)
**Component**: `CollectOrderForm.jsx` | **Access**: Via order cards in collection pages

Comprehensive payment processing interface supporting both partial and full payments. Features order summary, payment method selection (Cash/Platform), payment history table with deposit details, and **delete deposit functionality** with automatic recalculation.

**Payment Options**:
- **Partial Payment**: Enter specific amount
- **Full Payment**: "Cobrar Total" button pays remaining balance

**Delete Deposit** ✅: Soft delete with trash icon, confirmation modal, automatic recalculation of subsequent deposits, and audit trail preservation. Cannot delete from fully paid orders.

#### Payment History (`/abonos`)
**Component**: `DepositsPage.jsx` | **Navigation**: Light grey "Abonos" button

Complete financial audit trail showing ALL deposits including deleted ones. Deleted deposits displayed with grey background, strikethrough text, and [ELIMINADO] label. Active deposits counter in header. Search and filter by client, date, payment method, or mall location.

**Data Integrity**: Maintains complete audit trail with soft delete support

#### Fully Paid Orders (`/ordenesPagas`)
**Component**: `CollectedOrdersPage.jsx` | **Navigation**: Dark grey "Cuentas al día" button

Lists all orders with complete payment (`paid = 1`). Displays client details, order items, total amount paid, payment completion date, and delivery status. Features date filtering and search functionality. Orders move here after full payment completion.

---

### 🚚 Delivery Management

#### Delivery Routes (`/recorrido`)
**Component**: `DeliveryOrdersPage.jsx` | **Navigation**: Orange "Recorrido" button

Delivery route management and order fulfillment tracking. Lists all orders ready for delivery, organized by location and premises for efficient routing. Supports marking individual items as delivered and tracking delivery timestamps.

**Features**: Route planning, Partial deliveries, Delivery status updates, Real-time tracking

#### Delivered Orders (`/entregados`)
**Component**: `DeliveredOrdersPage.jsx` | **Access**: Direct link (not in main menu)

Historical view of completed deliveries with date filtering, delivery verification, and delivery timestamp tracking. Distinguishes between fully delivered and partially delivered orders.

---

### 👥 Customer & Product Management

#### Customer Management (`/clientes`)
**Component**: `ClientsPage.jsx` | **Navigation**: Sky blue "Clientes" button

Complete customer database with contact information, premises assignments, and mall associations. Search by name, premises, or phone. Create, edit, or delete customers with validation preventing deletion of customers with active orders.

**Customer Data**: Name, Phone, Premises number, Mall location, Email, Customer ID

#### Create New Customer (`/nuevoCliente`)
**Component**: `ClientForm.jsx` | **Access**: "Nuevo Cliente" button on Clientes page

Customer registration form with required fields (name, phone, premises, mall) and optional email. Includes validation for required fields, phone format, and duplicate detection.

#### Edit Customer (`/editarCliente/:id`)
**Component**: `ClientForm.jsx` | **Access**: "Editar" button on customer cards

Update existing customer information with pre-populated form and validation. Cannot change customer ID.

#### Product Catalog (`/productos`)
**Component**: `ProductsPage.jsx` | **Navigation**: Sky blue "Productos" button

Product inventory management displaying all available products with names, prices, descriptions, and availability status. Search products and perform CRUD operations. Validation prevents deletion of products used in active orders.

#### Create New Product (`/nuevoProducto`)
**Component**: `ProductForm.jsx` | **Access**: "Nuevo Producto" button on Productos page

Add products to catalog with name, price, description, and category. Formatted currency input with validation for required fields and duplicate detection.

#### Edit Product (`/editarProducto/:id`)
**Component**: `ProductForm.jsx` | **Access**: "Editar" button on product cards

Update product information including name, price, and description with validation and confirmation.

---

### 🔧 Utility & Special Pages

#### Orphaned Orders (`/ordenesSinCliente`)
**Component**: `OrphanedOrdersPage.jsx` | **Navigation**: Red "Sin Usuario" button

Data integrity management tool for orders without assigned customers. Features client assignment, order details display, and resolution actions (assign customer, create new customer, delete order). Helps maintain database consistency.

#### Public Invoice View (`/factura/:id`)
**Component**: `PublicInvoice.jsx` | **Access**: Public (no authentication)

Customer-facing invoice view accessible via link or QR code. Professional display with company branding, customer information, itemized products, prices, totals, and payment status. Optimized for printing.

#### PDF Invoice Generation (`/pdfOrden/:id`)
**Component**: `Invoice.jsx` | **Access**: "Factura" button on order cards

Generate professional PDF invoices using React-PDF library. Features company header, invoice number, customer details, itemized products, and payment information. Formatted for thermal/standard printers with download support.

---

## 🎯 Navigation Menu Overview

### Standard User Menu (Full Access)
1. **Cuentas por cobrar** (Yellow) - Unpaid orders dashboard
2. **Cobros del día** (Light grey) - Today's collections
3. **Nueva Orden** (Green) - Create new order
4. **Recorrido** (Orange) - Delivery routes
5. **Cobrar Uni./Alta T./C.F./Otros** (Grey) - Payment collection by location
6. **Abonos** (Light grey) - Payment history
7. **Cuentas al día** (Dark grey) - Fully paid orders
8. **Sin Usuario** (Red) - Orphaned orders
9. **Productos** (Sky blue) - Product catalog
10. **Clientes** (Sky blue) - Customer management
11. **Salir** (Dark red) - Logout

### Limited User Menu ("Black coffe Unilago")
1. **Nueva Orden** (Green) - Create order
2. **Recorrido** (Orange) - Delivery routes
3. **Cobrar Uni.** (Grey) - Collect Unilago only
4. **Salir** (Dark red) - Logout

---

## 🔄 Workflow Examples

### Complete Order Lifecycle
1. **Create** → `/nuevaOrden` (Order created, unpaid)
2. **Dashboard** → `/` (View in accounts receivable)
3. **Collect** → `/cobrarOrdenes/:mall` → `/cobrarOrden/:id` (Process payment)
4. **Track** → `/abonos` & `/cobrosHoy` (Monitor payments)
5. **Paid** → `/ordenesPagas` (Fully paid orders)
6. **Deliver** → `/recorrido` (Delivery management)
7. **Complete** → `/entregados` (Delivery history)

### Daily Financial Reconciliation
1. View daily collections → `/cobrosHoy`
2. Review payment audit → `/abonos`
3. Check outstanding → `/`
4. Verify fully paid → `/ordenesPagas`

## 📦 Key Components

The system elegantly orchestrates five primary entities:

1. **Customers** 👥
   - Represents patrons of the commercial center
   - Tracks individual customer interactions and order histories

2. **Products** 🍵
   - Maintains a comprehensive catalog of café offerings
   - Stores critical details like product name and pricing

3. **Orders** 📝
   - Created under specific user contexts
   - Dynamically evolves by adding products throughout the ordering process
   - Tracks the journey of each customer's culinary desires

4. **Payments/Deposits** 💸
   - **Flexible Payment System**: Supports both partial payments (deposits) and full order payments
   - **Payment Methods**: Cash ("Efectivo") and digital platform ("Plataforma") payments
   - **Complete Audit Trail**: Every payment transaction is recorded with timestamps and amounts
   - **Multi-Payment Support**: Customers can make multiple partial payments until order is fully paid
   - **Real-time Balance Tracking**: System automatically calculates remaining balances and payment status
   - **Daily Collections**: Comprehensive reporting for daily payment collections and financial tracking

5. **User Management** 🔐
   - Authentication and authorization system
   - Role-based access control

## 🔧 System Workflow

1. **Order Creation**: Create an order for a specific customer
2. **Product Addition**: Add products to the order dynamically
3. **Payment Processing**: Record partial or full payments (deposits)
   - **Partial Payments**: Customers can pay any amount towards their order total
   - **Payment Tracking**: System maintains running balance and payment history
   - **Full Payment**: Complete remaining balance with single transaction
   - **Multiple Methods**: Support for cash and digital platform payments
4. **Order Fulfillment**: Track order status through collection and delivery
5. **Invoice Generation**: Generate PDF invoices for completed orders
6. **Order Archiving**: Automatically manage completed orders

## 🌈 Key Features

- **Dynamic Order Management**: Real-time order creation and modification
- **Advanced Payment System**:
  - Support for partial payments and deposits with complete audit trail
  - Multiple payment methods (Cash/Digital Platform) per order
  - Automatic balance calculation and payment status tracking
  - Daily collections reporting and financial analytics
- **Multi-location Support**: Manage orders across different mall locations
- **Delivery Tracking**: Complete delivery route management
- **PDF Invoice Generation**: Professional invoice creation
- **Customer Relationship Management**: Comprehensive customer profiles
- **Product Catalog Management**: Dynamic product inventory
- **Authentication System**: Secure user login and session management
- **Responsive Design**: Mobile-friendly interface with TailwindCSS
- **Real-time Updates**: Context-based state management

## 📋 Prerequisites

- Node.js (v14+ recommended)
- npm or yarn
- MySQL Database access
- Modern web browser

## 🔬 Installation & Setup

### Backend Setup
```bash
# Navigate to project root
cd blackcoffe

# Install backend dependencies
npm install

# Configure database connection in server/db.js
# Set up your MySQL database credentials

# Start the backend server
npm run dev
```

### Frontend Setup
```bash
# Navigate to client directory
cd client

# Install frontend dependencies
npm install

# Start the development server
npm run dev

# Build for production
npm run build
```

### Environment Configuration
- Update database credentials in `server/db.js`
- Configure server port in `server/config.js`
- Ensure CORS settings match your deployment environment

## 🚀 Deployment

The application is configured for deployment with:
- Static file serving from `client/dist`
- Production-ready build scripts
- Database connection to DigitalOcean MySQL

## 🛠️ Development Scripts

**Backend:**
- `npm run dev` - Start backend with nodemon (auto-reload)

**Frontend:**
- `npm run dev` - Start Vite development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## 📚 Additional Documentation

### System Documentation
- **[CLAUDE.md](CLAUDE.md)** - Complete system documentation for Claude Code development
  - Development commands and workflows
  - Architecture overview and database integration
  - Complete deposits and payment system documentation
  - Navigation menu and page documentation
  - Code improvements and implementation progress

- **[TIMEZONE.md](TIMEZONE.md)** - Timezone implementation and management guide ⏰ **NEW**
  - Complete timezone handling documentation for Colombia (UTC-5)
  - Database field storage and retrieval strategies
  - Backend query patterns with CONVERT_TZ
  - Frontend date handling with dayjs
  - Controller reference for all timestamp fields
  - Testing scripts and verification procedures
  - Best practices for future development

### Feature Documentation
- **[INVOICES.md](INVOICES.md)** - Invoice payment information enhancement documentation
  - Implementation plan for adding payment information to invoices
  - Payment display specifications (total paid, remaining debt, payment history)
  - Frontend and backend integration guide
  - Testing checklist and edge cases
  - Visual design considerations for thermal and web invoices

### Project History
- **[MERGE.md](MERGE.md)** - Page merge history and implementation details
  - Cobros del día enhancement (2025-10-04)
  - Feature consolidation documentation

## 📄 License

Developed by jdavidrt in Bogotá Colombia

## 📬 Contact

Juan David Ramírez Torres - [jdramirezt@unal.edu.co](mailto:jdramirezt@unal.edu.co)

---

**Hecho con amor 💝 en COLOMBIA**