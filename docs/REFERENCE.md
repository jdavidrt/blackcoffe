# BlackCoffe — Technical Reference

Deployment configuration, database schema, and timezone-handling reference for the BlackCoffe order management system. This is pure reference material (moved out of the old `PROJECT_IMPROVEMENTS.md`, which mixed it with improvement tracking). For pending work, audit findings, and implementation priorities, see [PENDING_IMPROVEMENTS.md](PENDING_IMPROVEMENTS.md).

## Table of Contents

1. [Deployment Guide](#deployment-guide)
2. [Database Schema](#database-schema)
3. [Timezone Implementation](#timezone-implementation)
4. [Local Testing Against the Real DB](#local-testing-against-the-real-db)

---

# Deployment Guide

## Overview
This is a full-stack application with:
- **Backend**: Express.js server (serves API + static frontend)
- **Frontend**: React + Vite (built and served by backend in production)
- **Database**: MySQL on DigitalOcean

## Deployment Configuration

### 1. Backend Deployment (Render.com)

**Service Type**: Web Service

**Build Command**:
```bash
npm install && npm run build
```

**Start Command**:
```bash
npm start
```

**Environment Variables** (Set in Render dashboard):
```
PORT=25060
```
*Note: The database credentials are already in `server/db.js`. For better security, consider moving them to environment variables.*

**Important Settings**:
- **Auto-Deploy**: Enable (deploys on git push)
- **Branch**: main
- **Root Directory**: Leave empty (uses repository root)

### 2. Frontend Configuration

The frontend is already configured to connect to your deployed backend:
- Production API: `https://coffeserver.onrender.com`
- Local development: `http://localhost:25060`

**No separate frontend deployment needed** - the backend serves the built frontend from `client/dist`.

### 3. Build Process

When you deploy, Render will:
1. Run `npm install` (installs backend dependencies)
2. Run `npm run build` (installs frontend dependencies and builds React app)
3. Run `npm start` (starts Express server on PORT 25060)
4. Express serves built frontend from `client/dist` + API routes

## Local Development

### Start Backend:
```bash
npm run dev
```
Backend runs on: http://localhost:25060

### Start Frontend (separate terminal):
```bash
cd client
npm run dev
```
Frontend runs on: http://localhost:5173

## Deployment Checklist

- [x] Backend `PORT` uses environment variable
- [x] Frontend API URL configured correctly (no `localhost` in production)
- [x] `package.json` has `start` and `build` scripts
- [x] `.gitignore` excludes `node_modules` and `dist`
- [ ] Database credentials moved to environment variables (recommended for security)

## Common Issues

### Issue: Frontend shows "ERR_CONNECTION_REFUSED"
**Cause**: Frontend trying to connect to `localhost` instead of deployed backend
**Solution**: Already fixed - `config.js` now uses `https://coffeserver.onrender.com`

### Issue: "Cannot GET /api/..." errors
**Cause**: Frontend not built or backend not serving static files
**Solution**: Run `npm run build` before deploying

### Issue: Database connection errors
**Cause**: Database credentials incorrect or database not accessible
**Solution**: Verify credentials in `server/db.js` or environment variables

## Render Deployment URL
Your backend should be deployed at: **https://coffeserver.onrender.com**

This URL serves both:
- API routes: `/orders`, `/clients`, `/products`, etc.
- Built React frontend: All other routes serve `index.html`

## Next Steps (Optional Security Improvements)

1. **Move database credentials to environment variables**:
   - Create `.env` file (already in `.gitignore`)
   - Update `server/db.js` to use `process.env` variables
   - Set environment variables in Render dashboard

2. **Add CORS configuration**:
   - Restrict CORS to only allow your frontend domain

3. **Enable HTTPS redirect** (Render does this automatically)

---

# Database Schema

## Overview
BlackCoffe uses a MySQL database hosted on DigitalOcean with 5 primary tables managing customers, products, orders, payments, and users. The schema supports complex operations including partial payments, order tracking, delivery management, and soft deletes.

## 📊 Complete Database Schema

### 1. Users Table (`users`)
Manages authentication and user accounts.

| Column Name    | Data Type    | Constraints        | Description                           |
|----------------|--------------|--------------------|---------------------------------------|
| `userId`       | INT          | PRIMARY KEY, AUTO_INCREMENT | Unique user identifier    |
| `userName`     | VARCHAR(255) | NOT NULL, UNIQUE   | User login name                       |
| `userPassword` | VARCHAR(255) | NOT NULL           | User password (plaintext - needs encryption) |
| `createdAt`    | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP | Account creation timestamp |
| `isDeleted`    | TINYINT(1)   | DEFAULT 0          | Soft delete flag (0=active, 1=deleted) |

**Notes**:
- Passwords currently stored in plaintext (security improvement needed — see [PENDING_IMPROVEMENTS.md](PENDING_IMPROVEMENTS.md) Priority 2)
- Role-based access differentiation in application logic (not schema)

---

### 2. Clients Table (`clients`)
Stores customer information and location assignments.

| Column Name   | Data Type    | Constraints        | Description                           |
|---------------|--------------|--------------------|---------------------------------------|
| `id`          | INT          | PRIMARY KEY, AUTO_INCREMENT | Unique client identifier  |
| `clientName`  | VARCHAR(255) | NOT NULL           | Customer full name                    |
| `phone`       | VARCHAR(50)  | NOT NULL           | Customer phone number                 |
| `premises`    | VARCHAR(100) | NOT NULL           | Store location/premises number        |
| `mall`        | VARCHAR(100) | NOT NULL           | Mall location (Unilago, Alta Tecnología, etc.) |
| `email`       | VARCHAR(255) | NULL               | Customer email address (optional)     |
| `createdAt`   | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP | Client registration timestamp |
| `isDeleted`   | TINYINT(1)   | DEFAULT 0          | Soft delete flag (0=active, 1=deleted) |
| `deletedAt`   | DATETIME     | NULL               | When client was soft-deleted          |

**Notes**:
- `premises` typically stores "Local X" (store number)
- `mall` values: "Unilago", "Alta Tecnología", "Cliente Frecuente", "Otros"
- Clients use soft delete (`isDeleted`), same pattern as deposits; deleted clients can be restored
- **Deletion** is blocked while the client has an active (unpaid, non-abandoned) order (enforced in application logic)
- **Editing** (`clientName`/`premises`/`mall`/`phone`) is always allowed, even with an active order — orders reference clients by `id`, never by these fields, so edits can't break the link. See CLAUDE.md "Completed Improvements #7"

---

### 3. Products Table (`products`)
Maintains the café product catalog.

| Column Name     | Data Type     | Constraints        | Description                           |
|-----------------|---------------|--------------------|---------------------------------------|
| `id`            | INT           | PRIMARY KEY, AUTO_INCREMENT | Unique product identifier |
| `productName`   | VARCHAR(255)  | NOT NULL, UNIQUE   | Product name                          |
| `productValue`  | DECIMAL(10,2) | NOT NULL           | Product unit price                    |
| `createdAt`     | TIMESTAMP     | DEFAULT CURRENT_TIMESTAMP | Product creation timestamp |
| `shopId`        | INT           | NULL               | Store identifier (future multi-store support) |

**Notes**:
- `productValue` stored in COP (Colombian Pesos)
- Cannot delete products used in active orders (enforced in application logic)

---

### 4. Orders Table (`orders`)
Central table managing all order operations and state tracking.

| Column Name     | Data Type     | Constraints        | Description                           |
|-----------------|---------------|--------------------|---------------------------------------|
| `id`            | INT           | PRIMARY KEY, AUTO_INCREMENT | Unique order identifier   |
| `clientId`      | INT           | FOREIGN KEY → clients(id) | Customer who placed the order |
| `shopId`        | INT           | NULL               | Store identifier                      |
| `items`         | JSON          | NOT NULL           | Order items with products, quantities, prices, delivery status |
| `paymentMethod` | VARCHAR(50)   | NULL               | Payment method ("Efectivo", "Plataforma") |
| `deposit`       | DECIMAL(10,2) | DEFAULT 0          | Current total deposited amount        |
| `paid`          | TINYINT(1)    | DEFAULT 0          | Payment status (0=unpaid, 1=fully paid) |
| `paidAt`        | DATETIME      | NULL               | Timestamp when order was fully paid   |
| `delivered`     | TINYINT(1)    | DEFAULT 0          | Delivery status (0=not delivered, 1=delivered) |
| `collectedBy`   | VARCHAR(255)  | NULL               | User who collected payment            |
| `createdAt`     | TIMESTAMP     | DEFAULT CURRENT_TIMESTAMP | Order creation timestamp (UTC, converted to Colombia time) |
| `isAbandoned`   | TINYINT(1)    | DEFAULT 0          | Abandoned status (0=active, 1=abandoned) |
| `abandonedAt`   | DATETIME      | NULL               | When order was marked as abandoned (Colombia time) |
| `abandonedBy`   | VARCHAR(255)  | NULL               | User who marked order as abandoned    |
| `abandonReason` | TEXT          | NULL               | Reason for abandonment (optional)     |
| `clientNameSnapshot`     | VARCHAR(255) | NULL        | Client name captured at the moment `paid` became 1 |
| `clientPremisesSnapshot` | VARCHAR(100) | NULL        | Client premises captured at the moment `paid` became 1 |
| `clientMallSnapshot`     | VARCHAR(100) | NULL        | Client mall captured at the moment `paid` became 1 |

**JSON Items Structure**:
```json
[
  {
    "productName": "Café Americano",
    "quantity": 2,
    "unitValue": 8000,
    "delivered": "pending"  // or "delivered"
  }
]
```

**Notes**:
- `items` JSON column stores complete product details for historical accuracy
- `deposit` tracks cumulative payments, updated with each deposit
- `paid = 1` when `deposit >= order total`
- `isAbandoned = 1` excludes order from active order queries
- Abandoned orders maintained for audit trail and potential reactivation
- `clientId` is a permanent reference — orders are never re-linked to a different client, and editing a client's name/premises/mall never changes it
- `client*Snapshot` columns are populated once, when `paid` transitions to `1`; every SELECT reads display fields via `COALESCE(orders.client*Snapshot, clients.*)`, so a paid order keeps showing the client info as of payment time even if the client is later edited. **Unpaid orders have no snapshot**, so they always display the client's *current* (live) info — see CLAUDE.md "Completed Improvements #7"
- Once `paid = 1`, the order is immutable — `updateOrder` rejects any further changes (items, quantities, delivery status, `clientId`, etc.) with `400`

**Foreign Keys**:
- `clientId` → `clients.id`

---

### 5. Deposits Table (`deposits`)
Tracks all payment transactions with complete audit trail.

| Column Name       | Data Type     | Constraints        | Description                           |
|-------------------|---------------|--------------------|---------------------------------------|
| `depositId`       | INT           | PRIMARY KEY, AUTO_INCREMENT | Unique deposit identifier |
| `orderId`         | INT           | FOREIGN KEY → orders(id) | Order this deposit belongs to |
| `clientId`        | INT           | FOREIGN KEY → clients(id) | Customer who made payment |
| `depositValue`    | DECIMAL(10,2) | NOT NULL           | Individual payment amount (this deposit only) |
| `lastDeposit`     | DECIMAL(10,2) | NOT NULL           | Previous cumulative deposit total     |
| `newDeposit`      | DECIMAL(10,2) | NOT NULL           | New cumulative deposit total after this payment |
| `dueOnDeposit`    | DECIMAL(10,2) | NOT NULL           | Remaining debt after this deposit     |
| `paymentMethod`   | VARCHAR(50)   | NOT NULL           | Payment method ("Efectivo", "Plataforma") |
| `depositCreatedAt`| TIMESTAMP     | DEFAULT CURRENT_TIMESTAMP | Deposit creation timestamp (UTC, converted to Colombia time) |
| `isDeleted`       | TINYINT(1)    | DEFAULT 0          | Soft delete flag (0=active, 1=deleted) |
| `deletedAt`       | DATETIME      | NULL               | When deposit was soft-deleted (Colombia time) |
| `deletedBy`       | VARCHAR(255)  | NULL               | User who deleted the deposit          |

**Notes**:
- `depositValue`: Individual payment amount entered by user
- `lastDeposit`: Running total before this payment
- `newDeposit`: Running total after this payment
- `dueOnDeposit`: Remaining balance after payment
- Soft delete maintains audit trail while marking deposit as invalid
- Delete triggers automatic recalculation of all subsequent deposits

**Foreign Keys**:
- `orderId` → `orders.id`
- `clientId` → `clients.id`

---

## 🔗 Entity Relationships

### Primary Relationships
```
users (1) ───────────────┐
                          │
clients (1) ──────── (N) orders (1) ──────── (N) deposits
                          │
products (N) ────────────┘ (via JSON items)
```

### Relationship Details
- **One-to-Many**: One client can have many orders
- **One-to-Many**: One order can have many deposits (partial payments)
- **Many-to-Many** (via JSON): One order contains many products, one product can be in many orders
- **Soft Deletes**: Users and deposits support soft delete (isDeleted flag)
- **Abandoned Orders**: Orders can be marked as abandoned (isAbandoned flag)

---

## 🔧 Schema Features

### Soft Delete Support
Tables with soft delete capability:
- **users**: `isDeleted` flag preserves user history
- **clients**: `isDeleted`, `deletedAt` — deletion blocked while the client has an active order; restorable via `restoreClient`
- **deposits**: `isDeleted`, `deletedAt`, `deletedBy` maintains payment audit trail

### Client & Order Protection Rules
- **Client edits are never blocked** — `updateClient` has no active-order check, since `clientId` (the FK orders actually use) is untouched by renaming a client or changing their premises/mall/phone
- **Client deletion is blocked** while the client has any active (unpaid, non-abandoned) order
- **Order deletion is blocked** if the order has any deposit history, including soft-deleted deposits
- **Order edits are blocked entirely** once `paid = 1` (full freeze, including delivery toggles)

See CLAUDE.md "Completed Improvements #5, #6, #7" for the implementation history of these rules.

### Abandoned Order Support
- **orders**: `isAbandoned`, `abandonedAt`, `abandonedBy`, `abandonReason`
- Abandoned orders excluded from active queries but maintained for audit
- Can be reactivated if customer returns

### Timezone Handling
- **AUTO timestamps** (createdAt, depositCreatedAt): Stored in UTC, converted to Colombia time (UTC-5) in queries
- **MANUAL timestamps** (paidAt): Sent by frontend in Colombia time
- **COLOMBIA timestamps** (abandonedAt, deletedAt): Stored using `DATE_SUB(NOW(), INTERVAL 5 HOUR)`

See [Timezone Implementation](#timezone-implementation) for complete details.

---

## 📝 Migration History

| Date       | Migration File              | Description                              |
|------------|-----------------------------|------------------------------------------|
| 2025-10-04 | `add_abandoned_fields.sql`  | Added `isAbandoned`, `abandonedAt`, `abandonedBy`, `abandonReason` to orders table |

**Migration Location**: `server/migrations/`

**How to Apply Migrations**: See [Database Migrations](#database-migrations) section below

---

## Database Migrations

### Overview
BlackCoffe uses SQL migration files to manage database schema changes. Migrations are located in `server/migrations/` and must be manually executed on the production DigitalOcean MySQL database.

### Migration System Architecture

**Structure**:
```
server/migrations/
├── MIGRATION_INSTRUCTIONS.md  # Detailed migration documentation
├── add_abandoned_fields.sql   # SQL migration script
├── test_abandoned_migration.js # Migration test script
├── backfill_abandoned_fields.js # Data backfill script
└── apply_migration.js         # Automated migration runner
```

**Process**:
1. **Create Migration**: Write SQL script with `ALTER TABLE` or `CREATE TABLE` statements
2. **Document Migration**: Update MIGRATION_INSTRUCTIONS.md with:
   - Purpose and date
   - SQL script
   - Verification queries
   - Rollback instructions
   - Testing procedures
3. **Test Locally**: Apply migration to local development database
4. **Execute on Production**: Manually run SQL on DigitalOcean database console
5. **Verify**: Run verification queries to confirm changes
6. **Update Docs**: Record execution date and status

### Current Migration: Abandoned Orders (2025-10-04)

**Status**: ⏳ **PENDING EXECUTION ON PRODUCTION**

**Purpose**: Add support for tracking abandoned orders in the orders table

**New Columns**:
- `isAbandoned` TINYINT(1) DEFAULT 0 - Abandoned status flag
- `abandonedAt` DATETIME NULL - Abandonment timestamp
- `abandonedBy` VARCHAR(255) NULL - User who abandoned order
- `abandonReason` TEXT NULL - Optional abandonment reason

**Migration SQL**:
```sql
ALTER TABLE orders
ADD COLUMN isAbandoned TINYINT(1) DEFAULT 0 AFTER paid,
ADD COLUMN abandonedAt DATETIME NULL AFTER isAbandoned,
ADD COLUMN abandonedBy VARCHAR(255) NULL AFTER abandonedAt,
ADD COLUMN abandonReason TEXT NULL AFTER abandonedBy;
```

**Verification Query**:
```sql
DESCRIBE orders;
-- Should show new columns: isAbandoned, abandonedAt, abandonedBy, abandonReason

SELECT COUNT(*) as total_orders,
       SUM(CASE WHEN isAbandoned = 0 OR isAbandoned IS NULL THEN 1 ELSE 0 END) as active_orders,
       SUM(CASE WHEN isAbandoned = 1 THEN 1 ELSE 0 END) as abandoned_orders
FROM orders;
-- All existing orders should have isAbandoned = 0
```

**Affected Code**:
- Backend: `orders.controllers.js` (getOrders, markOrderAsAbandoned, unmarkOrderAsAbandoned, getAbandonedOrders)
- Frontend: `AbandonedOrdersPage.jsx`, `CollectOrderForm.jsx`
- API Routes: `/abandonedOrders`, `/order/:id/abandon`, `/order/:id/reactivate`

### How to Execute Migrations

#### Option 1: DigitalOcean Database Console (Recommended)

1. **Access Database**:
   - Log in to https://cloud.digitalocean.com/databases
   - Select BlackCoffe MySQL database cluster
   - Click "Console" or "Connect" tab

2. **Execute Migration**:
   - Copy SQL from migration file
   - Paste into console
   - Execute command
   - Wait for success confirmation

3. **Verify**:
   - Run `DESCRIBE table_name;` to confirm new columns
   - Execute verification queries from MIGRATION_INSTRUCTIONS.md

#### Option 2: MySQL Command Line

```bash
mysql -h <host>.db.ondigitalocean.com \
      -u <username> \
      -p \
      -P <port> \
      <database-name>

# Paste migration SQL and execute
```

#### Option 3: MySQL Workbench / DBeaver

1. Connect to DigitalOcean database using credentials from `server/db.js`
2. Open SQL editor
3. Paste migration SQL
4. Execute query
5. Verify with verification queries

### Migration Best Practices

**Before Execution**:
- ✅ Backup production database
- ✅ Test migration on local database first
- ✅ Review SQL for syntax errors
- ✅ Check database user has ALTER TABLE privileges
- ✅ Plan for downtime if needed (typically < 1 minute for schema changes)

**During Execution**:
- ⏱️ Note execution start time
- 👀 Monitor for errors
- 📝 Record any warnings or messages

**After Execution**:
- ✅ Run verification queries
- ✅ Test affected application features
- ✅ Check server logs for errors
- ✅ Update MIGRATION_INSTRUCTIONS.md with completion date
- ✅ Document any issues encountered

### Rollback Procedures

Each migration includes rollback SQL in MIGRATION_INSTRUCTIONS.md:

```sql
-- Example: Rollback abandoned fields migration
ALTER TABLE orders
DROP COLUMN abandonReason,
DROP COLUMN abandonedBy,
DROP COLUMN abandonedAt,
DROP COLUMN isAbandoned;
```

**Warning**: Rollback removes all data in affected columns. Only use if absolutely necessary.

### Migration Troubleshooting

**Error: "Unknown column 'table.column'"**
- **Cause**: Migration not executed yet
- **Solution**: Execute migration SQL on database

**Error: "Duplicate column name 'column'"**
- **Cause**: Migration already executed
- **Solution**: Check with `DESCRIBE table;` - no action needed

**Error: "Access denied for ALTER TABLE"**
- **Cause**: Database user lacks ALTER privileges
- **Solution**: Contact database administrator or use admin credentials

**Application Errors After Migration**
- **Cause**: Application code not deployed
- **Solution**: Ensure frontend and backend code deployed before migration

### Future Migration Guidelines

When creating new migrations:

1. **Naming Convention**: `YYYY-MM-DD_description.sql`
   - Example: `2025-10-04_add_abandoned_fields.sql`

2. **Documentation Requirements**:
   - Purpose and date
   - Complete SQL script
   - Verification queries
   - Rollback instructions
   - List of affected code files

3. **Testing Requirements**:
   - Test on local development database
   - Verify application functionality with new schema
   - Test rollback procedure

4. **Deployment Coordination**:
   - Execute migration before deploying code that uses new fields
   - Ensure backward compatibility if possible
   - Plan for potential downtime

### Migration Checklist Template

Use this checklist for each migration:

- [ ] Backup production database
- [ ] Test migration locally
- [ ] Document migration in MIGRATION_INSTRUCTIONS.md
- [ ] Connect to production database
- [ ] Execute migration SQL
- [ ] Run verification queries
- [ ] Test affected features
- [ ] Monitor logs for errors
- [ ] Update migration status in docs
- [ ] Notify team of completion

---

# Timezone Implementation

## Overview
The BlackCoffe application uses **Colombia timezone (UTC-5)** throughout the entire system. This document explains how timestamps are handled to ensure consistency across all operations.

## 🌍 Timezone Strategy

### Core Principle
- **Database**: Stores timestamps (either UTC or Colombia time depending on field)
- **Backend**: Converts all timestamps to Colombia time (UTC-5) before sending to frontend
- **Frontend**: Receives and displays Colombia time directly (no conversion needed)
- **User Experience**: All dates and times shown match Colombia local time

## 📅 Database Schema - Timestamp Fields

### All Date/Time Columns

| Table      | Column              | Type        | Storage Method | Description                                    |
|------------|---------------------|-------------|----------------|------------------------------------------------|
| **orders** | `createdAt`         | TIMESTAMP   | AUTO (UTC)     | Order creation timestamp                       |
| **orders** | `paidAt`            | DATETIME    | MANUAL         | When order was fully paid                      |
| **orders** | `abandonedAt`       | DATETIME    | COLOMBIA       | When order was marked as abandoned             |
| **deposits** | `depositCreatedAt`| TIMESTAMP   | AUTO (UTC)     | Deposit creation timestamp                     |
| **deposits** | `deletedAt`       | TIMESTAMP   | COLOMBIA       | When deposit was soft-deleted                  |
| **clients** | `createdAt`        | TIMESTAMP   | AUTO (UTC)     | Client registration timestamp                  |
| **products** | `createdAt`       | TIMESTAMP   | AUTO (UTC)     | Product creation timestamp                     |
| **users** | `createdAt`          | TIMESTAMP   | AUTO (UTC)     | User registration timestamp                    |

### Storage Methods Explained

1. **AUTO (UTC)** - Database default `CURRENT_TIMESTAMP`
   - Automatically inserted by database
   - Stored in UTC timezone
   - **Retrieval**: ALWAYS use `CONVERT_TZ(field, '+00:00', '-05:00')`

2. **MANUAL** - Frontend sends date string
   - Frontend sends: `dayjs().format('YYYY-MM-DD')` (Colombia date)
   - Stored as-is (no conversion)
   - **Retrieval**: Use `CONVERT_TZ(field, '+00:00', '-05:00')` for consistency

3. **COLOMBIA** - Backend stores Colombia time
   - Uses: `DATE_SUB(NOW(), INTERVAL 5 HOUR)`
   - Stores current Colombia time directly
   - **Retrieval**: Use `CONVERT_TZ(field, '+00:00', '-05:00')` for consistency

## 🔧 Backend Implementation

### Rule 1: ALWAYS Convert Timestamps in SELECT Queries

**Correct** ✅:
```sql
SELECT
    orders.id,
    CONVERT_TZ(orders.createdAt, '+00:00', '-05:00') as createdAt,
    CONVERT_TZ(orders.paidAt, '+00:00', '-05:00') as paidAt,
    CONVERT_TZ(orders.abandonedAt, '+00:00', '-05:00') as abandonedAt
FROM orders
```

**Incorrect** ❌:
```sql
SELECT
    orders.id,
    orders.createdAt,  -- Missing CONVERT_TZ
    orders.paidAt,     -- Missing CONVERT_TZ
    orders.abandonedAt -- Missing CONVERT_TZ
FROM orders
```

### Rule 2: Always Filter by Converted Dates

**Correct** ✅:
```sql
WHERE DATE(CONVERT_TZ(orders.paidAt, '+00:00', '-05:00')) = ?
```

**Incorrect** ❌:
```sql
WHERE DATE(orders.paidAt) = ?  -- Wrong timezone!
```

### Rule 3: Manual Timestamp Insertion (Colombia Time)

For fields that need to store the current Colombia time:

**Correct** ✅:
```sql
UPDATE orders
SET abandonedAt = DATE_SUB(NOW(), INTERVAL 5 HOUR)
WHERE id = ?
```

**Explanation**: `NOW()` returns UTC. Subtracting 5 hours gives Colombia time.

## 🎨 Frontend Display

### No Conversion Needed!
The frontend receives timestamps **already converted** to Colombia time from the backend, so no additional timezone handling is required.

### Date Display with dayjs

```javascript
import dayjs from 'dayjs';

// Backend sends: "2025-10-07T20:54:08.000Z" (Colombia time)
// Display as-is:
dayjs(order.abandonedAt).format('DD/MM/YYYY HH:mm')
// Output: "07/10/2025 20:54"
```

### Current Date for Forms

```javascript
const fechaActual = dayjs().format('YYYY-MM-DD');
// Sends Colombia date: "2025-10-07"
```

**Note**: `dayjs()` uses the browser's local timezone, which for users in Colombia will be UTC-5.

## 🔍 Common Issues & Solutions

### Issue 1: Time Shows 5 Hours Off
**Cause**: Missing `CONVERT_TZ` in SELECT query
**Solution**: Add `CONVERT_TZ(field, '+00:00', '-05:00')` to all timestamp fields

### Issue 2: Date Filter Returns Wrong Results
**Cause**: Filtering on UTC date instead of Colombia date
**Solution**: Use `DATE(CONVERT_TZ(field, '+00:00', '-05:00')) = ?`

### Issue 3: Manual Timestamp Stored in UTC
**Cause**: Using `NOW()` or `CURRENT_TIMESTAMP` directly
**Solution**: Use `DATE_SUB(NOW(), INTERVAL 5 HOUR)`

## 🚀 Best Practices for Future Development

### When Adding New Timestamp Fields

1. **Database Migration**:
   ```sql
   ALTER TABLE table_name
   ADD COLUMN new_timestamp DATETIME NULL;
   ```

2. **Backend Query (SELECT)**:
   ```sql
   SELECT CONVERT_TZ(table.new_timestamp, '+00:00', '-05:00') as new_timestamp
   FROM table_name
   ```

3. **Backend Insert (Manual)**:
   ```sql
   UPDATE table_name
   SET new_timestamp = DATE_SUB(NOW(), INTERVAL 5 HOUR)
   WHERE id = ?
   ```

4. **Frontend Display**:
   ```javascript
   dayjs(data.new_timestamp).format('DD/MM/YYYY HH:mm')
   ```

---

# Local Testing Against the Real DB

BlackCoffe has no separate local/test database — `server/db.js` always connects to the real DigitalOcean DB (credentials in `.env.local`, not checked in). Confirmed with the project owner 2026-07-06:

- **Client id `1557`** ("26 Prueba", premises `TEST`, mall `Otros`) is a designated test client — safe to create/merge orders, make/delete deposits, etc. against it when smoke-testing backend changes. It is not a real customer.
- **Server-side deploys are the project owner's responsibility.** After backend changes are made and locally verified, wait for them to commit and deploy (e.g. push to whichever branch Render auto-deploys from) rather than deploying as part of a task.
- **`server/sigale/`'s DB guardrail blocks booting the full combined server locally** with only BlackCoffe's `.env.local` — it hard-fails unless `SIGALE_DB_NAME`/`DB_NAME === 'sigale'` (intentional, see CLAUDE.md's Sigale guardrail; do not work around it). To exercise BlackCoffe controller logic against the real DB without booting Express/Sigale at all, import the controller functions directly (e.g. from `orders.controllers.js`, `deposits.controllers.js`) and invoke them with minimal mock `req`/`res` objects — this bypasses `server/index.js` (and therefore Sigale's mount) entirely while still hitting the real DB and running the real SQL/transaction logic.
