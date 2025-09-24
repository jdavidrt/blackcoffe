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