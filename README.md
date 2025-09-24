# BlackCoffe ☕ - Café Order Management System

## 🌟 Project Overview

BlackCoffe is an elegant and efficient order management system designed for cafés, weaving together technology and hospitality. Born from the intricate dance of commerce and customer experience, this system transforms the complex world of café operations into a streamlined digital symphony.

## 🚀 Core Architecture

### Technology Stack
- **Frontend**: React.js with Vite - Crafting responsive and dynamic user interfaces
- **Backend**: Express.js - Providing robust server-side logic
- **Database**: MySQL (DigitalOcean) - Ensuring data integrity and reliable storage
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

## 🗺️ Application Site Map

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
│   ├── `/cobrarOrden/:id` - Process Order Payment
│   ├── `/ordenesPagas` - Completed Orders
│   ├── `/abonos/` - Payment History & Deposits
│   └── `/cobrosHoy/` - Today's Collections
│
├── 🚚 Delivery Management
│   ├── `/recorrido/` - Delivery Routes
│   └── `/entregados/` - Delivered Orders
│
└── 📄 Documents & Reports
    ├── `/pdfOrden/:id` - Generate Order Invoice (PDF)
    └── `/factura/:id` - Public Invoice View
```

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
   - Registers and records payments for each order
   - Provides transparent financial tracking mechanism
   - Supports partial and full payments

5. **User Management** 🔐
   - Authentication and authorization system
   - Role-based access control

## 🔧 System Workflow

1. **Order Creation**: Create an order for a specific customer
2. **Product Addition**: Add products to the order dynamically
3. **Payment Processing**: Record partial or full payments (deposits)
4. **Order Fulfillment**: Track order status through collection and delivery
5. **Invoice Generation**: Generate PDF invoices for completed orders
6. **Order Archiving**: Automatically manage completed orders

## 🌈 Key Features

- **Dynamic Order Management**: Real-time order creation and modification
- **Flexible Payment System**: Support for partial payments and deposits
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

## 📄 License

Developed by jdavidrt in Bogotá Colombia

## 📬 Contact

Juan David Ramírez Torres - [jdramirezt@unal.edu.co](mailto:jdramirezt@unal.edu.co)

---

**Hecho con amor 💝 en COLOMBIA**