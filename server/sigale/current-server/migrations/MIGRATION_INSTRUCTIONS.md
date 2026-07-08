# Database Migration Instructions - Abandoned Orders Feature

## Overview
This migration adds support for tracking abandoned orders in the BlackCoffe system. Four new columns are added to the `orders` table to store abandonment information.

## Migration Date
**Created**: 2025-10-04
**Required for**: Production deployment of abandoned orders feature

---

## 🚨 IMPORTANT - Production Database Migration Required

The abandoned orders feature **will not work** until this migration is executed on the **DigitalOcean production database**.

### Current Status
- ✅ **Local Development**: Migration applied
- ❌ **Production (DigitalOcean)**: Migration **NOT YET APPLIED**

---

## Database Changes

### New Columns Added to `orders` Table

| Column Name | Type | Default | Nullable | Description |
|------------|------|---------|----------|-------------|
| `isAbandoned` | TINYINT(1) | 0 | NO | Flag indicating if order is abandoned (0=active, 1=abandoned) |
| `abandonedAt` | DATETIME | NULL | YES | Timestamp when order was marked as abandoned |
| `abandonedBy` | VARCHAR(255) | NULL | YES | Username of person who marked order as abandoned |
| `abandonReason` | TEXT | NULL | YES | Optional reason for abandoning the order |

---

## Migration SQL Script

### Execute on Production Database

```sql
-- ========================================
-- BLACKCOFFE ABANDONED ORDERS MIGRATION
-- Date: 2025-10-04
-- ========================================

-- Add abandoned order tracking fields
ALTER TABLE orders
ADD COLUMN isAbandoned TINYINT(1) DEFAULT 0 AFTER paid,
ADD COLUMN abandonedAt DATETIME NULL AFTER isAbandoned,
ADD COLUMN abandonedBy VARCHAR(255) NULL AFTER abandonedAt,
ADD COLUMN abandonReason TEXT NULL AFTER abandonedBy;
```

---

## How to Execute Migration

### Option 1: DigitalOcean Database Console (Recommended)

1. **Log in to DigitalOcean**
   - Navigate to: https://cloud.digitalocean.com/databases

2. **Select Your Database**
   - Find your BlackCoffe MySQL database cluster
   - Click on the database name

3. **Open Console**
   - Click on "Console" or "Connect" tab
   - Select "Connect with MySQL client" or use web console

4. **Execute Migration**
   - Copy the SQL script from above
   - Paste into the console
   - Execute the command
   - Wait for confirmation message

5. **Verify Success**
   - Run verification query (see below)

### Option 2: MySQL Command Line

```bash
# Connect to production database
mysql -h <your-host>.db.ondigitalocean.com \
      -u <username> \
      -p \
      -P <port> \
      <database-name>

# Paste and execute the migration SQL
# (See SQL script above)
```

### Option 3: MySQL Workbench or DBeaver

1. Connect to DigitalOcean database using credentials from `server/db.js`
2. Open new SQL editor
3. Paste migration SQL
4. Execute query
5. Verify with verification queries

---

## Verification Queries

### 1. Verify Column Structure
```sql
DESCRIBE orders;
```

**Expected Output** should include:
```
+--------------+--------------+------+-----+---------+----------------+
| Field        | Type         | Null | Key | Default | Extra          |
+--------------+--------------+------+-----+---------+----------------+
| id           | int          | NO   | PRI | NULL    | auto_increment |
| createdAt    | timestamp    | NO   |     | CURRENT_TIMESTAMP |      |
| shopId       | int          | NO   |     | NULL    |                |
| clientId     | int          | NO   |     | NULL    |                |
| paymentMethod| varchar(20)  | YES  |     | NULL    |                |
| paid         | tinyint(1)   | YES  |     | 0       |                |
| isAbandoned  | tinyint(1)   | YES  |     | 0       |                | ← NEW
| abandonedAt  | datetime     | YES  |     | NULL    |                | ← NEW
| abandonedBy  | varchar(255) | YES  |     | NULL    |                | ← NEW
| abandonReason| text         | YES  |     | NULL    |                | ← NEW
| paidAt       | datetime     | YES  |     | NULL    |                |
| items        | text         | YES  |     | NULL    |                |
| deposit      | int          | YES  |     | NULL    |                |
| collectedBy  | varchar(20)  | YES  |     | NULL    |                |
+--------------+--------------+------+-----+---------+----------------+
```

### 2. Check Default Values
```sql
SELECT COUNT(*) as total_orders,
       SUM(CASE WHEN isAbandoned = 0 OR isAbandoned IS NULL THEN 1 ELSE 0 END) as active_orders,
       SUM(CASE WHEN isAbandoned = 1 THEN 1 ELSE 0 END) as abandoned_orders
FROM orders;
```

**Expected**: All existing orders should have `isAbandoned = 0` (active)

### 3. Test Query (Used by Application)
```sql
-- This is the query used in getOrders() controller
SELECT orders.id, orders.deposit, orders.clientId, orders.paid, orders.collectedBy,
       clients.premises, clients.clientName, clients.mall
FROM orders
JOIN clients ON orders.clientId = clients.id
WHERE orders.paid = 0
  AND (orders.isAbandoned = 0 OR orders.isAbandoned IS NULL)
ORDER BY CAST(clients.premises AS SIGNED), clients.clientname ASC, orders.createdAt ASC
LIMIT 5;
```

**Expected**: Query executes without errors and returns unpaid, non-abandoned orders

---

## Testing After Migration

### 1. Test Marking Order as Abandoned

1. Navigate to `/cobrarOrden/:id` for any unpaid order
2. Scroll to bottom and click "Marcar como Abandonada"
3. Enter abandonment reason (optional)
4. Confirm action
5. Verify success message appears
6. Confirm redirect to main dashboard

### 2. Test Abandoned Orders Page

1. Navigate to `/ordenesAbandonadas`
2. Verify abandoned order appears in list
3. Check that abandonment details are displayed:
   - Abandoned date/time
   - Abandoned by (username)
   - Abandonment reason
4. Test "Reactivar" button to restore order

### 3. Test Main Dashboard Exclusion

1. Navigate to main dashboard `/`
2. Verify abandoned orders do NOT appear in "Cuentas por cobrar" list
3. Confirm only active (non-abandoned) unpaid orders are shown

### 4. Test Order Details View

1. Navigate to any abandoned order via `/cobrarOrden/:id`
2. Verify red warning banner displays at top
3. Confirm "Marcar como Abandonada" button is hidden (order already abandoned)

---

## Rollback Instructions

### If You Need to Revert the Migration

```sql
-- WARNING: This will remove all abandoned order data
-- Only use if absolutely necessary

ALTER TABLE orders
DROP COLUMN abandonReason,
DROP COLUMN abandonedBy,
DROP COLUMN abandonedAt,
DROP COLUMN isAbandoned;
```

**Note**: Rolling back will:
- ❌ Remove all abandoned order tracking
- ❌ Lose abandonment history data
- ⚠️ Cause application errors if abandoned orders feature is deployed

---

## Code References

### Files Using Abandoned Fields

1. **Backend Controllers** (`server/controllers/orders.controllers.js`):
   - `getOrders()` - Line 4: Filters out abandoned orders
   - `markOrderAsAbandoned()` - Lines 235-272: Marks order as abandoned
   - `unmarkOrderAsAbandoned()` - Lines 275-297: Reactivates order
   - `getAbandonedOrders()` - Lines 300-322: Retrieves abandoned orders

2. **Frontend Pages**:
   - `CollectOrderForm.jsx` - Lines 354-373: Warning banner
   - `CollectOrderForm.jsx` - Lines 646-707: Abandon button
   - `AbandonedOrdersPage.jsx` - Full page for managing abandoned orders

3. **Context Providers** (`client/src/context/OrderProvider.jsx`):
   - `getAbandonedOrders()` - Lines 120-128
   - `markOrderAsAbandoned()` - Lines 130-138
   - `unmarkOrderAsAbandoned()` - Lines 140-148

4. **API Routes** (`server/routes/orders.routes.js`):
   - GET `/abandonedOrders` - Line 45
   - PUT `/order/:id/abandon` - Line 46
   - PUT `/order/:id/reactivate` - Line 47

---

## Troubleshooting

### Error: "Unknown column 'orders.isAbandoned'"

**Cause**: Migration not yet executed on database
**Solution**: Run the migration SQL script on production database

### Error: "Duplicate column name 'isAbandoned'"

**Cause**: Migration already executed
**Solution**: Run verification queries to confirm columns exist. No action needed.

### Orders Not Appearing in Abandoned Orders Page

**Possible Causes**:
1. No orders have been marked as abandoned yet
2. Database connection issue
3. Query error in backend

**Solution**: Check browser console and server logs for errors

### Main Dashboard Still Shows Abandoned Orders

**Possible Causes**:
1. Frontend cache issue
2. Database query not filtering correctly

**Solution**:
1. Clear browser cache and reload
2. Verify backend query includes `isAbandoned = 0` filter
3. Check database values: `SELECT id, isAbandoned FROM orders WHERE paid = 0;`

---

## Support

If you encounter issues during migration:

1. **Check Database Connection**: Verify credentials in `server/db.js`
2. **Review Server Logs**: Check for SQL errors in terminal output
3. **Database Permissions**: Ensure user has ALTER TABLE privileges
4. **Backup First**: Always backup production data before migrations

---

## Migration Checklist

- [ ] Backup production database (recommended)
- [ ] Connect to DigitalOcean production database
- [ ] Execute migration SQL script
- [ ] Run verification queries
- [ ] Test abandoned orders functionality
- [ ] Verify main dashboard excludes abandoned orders
- [ ] Test order reactivation
- [ ] Monitor application logs for errors
- [ ] Document completion date and time

---

**Migration Status**: ⏳ **PENDING EXECUTION ON PRODUCTION**

Once executed, update this file with:
- Execution date and time
- Executed by (username)
- Any issues encountered
- Verification results

---

**Document Version**: 1.0
**Last Updated**: 2025-10-07
**Maintained By**: BlackCoffe Development Team
