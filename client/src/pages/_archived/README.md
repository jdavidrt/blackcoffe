# Archived Pages

This folder contains deprecated pages that have been replaced or merged with other functionality.

## Files

### CollectedOrdersPage.jsx
**Archived**: 2025-10-04
**Reason**: Merged with DepositedOrdersPage.jsx (/cobrosHoy)

The "Cuentas al día" functionality was merged into the "Cobros del día" page to create a unified view of daily payment collections. The merged page shows:
- All orders with payments on the selected date
- Accurate daily collection totals (sum of actual deposits, not order totals)
- Payment statistics (fully paid vs partial payments)
- Better UI with formatted totals and mall breakdowns

**Route Handling**: The old route `/ordenesPagas` now redirects to `/cobrosHoy` (see App.jsx)

**Preserved for**: Reference and potential rollback if needed

---

**Note**: Do not delete archived files. They serve as historical reference and backup in case of issues with new implementations.
