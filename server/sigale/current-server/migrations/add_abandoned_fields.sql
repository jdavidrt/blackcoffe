-- Migration: Add abandoned orders fields to orders table
-- Date: 2025-10-04
-- Description: Adds fields to track abandoned orders (isAbandoned, abandonedAt, abandonedBy, abandonReason)

-- Add abandoned order fields
ALTER TABLE orders
ADD COLUMN isAbandoned TINYINT(1) DEFAULT 0 AFTER paid,
ADD COLUMN abandonedAt DATETIME NULL AFTER isAbandoned,
ADD COLUMN abandonedBy VARCHAR(255) NULL AFTER abandonedAt,
ADD COLUMN abandonReason TEXT NULL AFTER abandonedBy;

-- Verify the changes
DESCRIBE orders;

-- Rollback script (if needed):
-- ALTER TABLE orders
-- DROP COLUMN abandonReason,
-- DROP COLUMN abandonedBy,
-- DROP COLUMN abandonedAt,
-- DROP COLUMN isAbandoned;
