# Backend Fixes (June 2026)

## Summary
Fixed database seeding and created utilities to support frontend testing of rider order assignment flows.

## Changes Made

### 1. Fixed Duplicate Key Error in `src/db/seed.ts`
**Problem:** Running `npm run seed` multiple times failed with:
```
duplicate key value violates unique constraint "rider_availability_rider_id_unique"
```

**Solution:** Added `.onConflictDoNothing()` to the `riderAvailability` insert:
```typescript
await db.insert(schema.riderAvailability).values({
  riderId,
  isOnline: true,
  activeOrders: 0
}).onConflictDoNothing();
```

**Impact:** Seed script can now be run repeatedly without errors.

---

### 2. Created Pending Orders Seed Utility (`src/db/seed-pending-orders.ts`)
**Purpose:** Generate test orders with pending rider assignments for testing the `/api/rider/orders/:id/accept` endpoint.

**What it does:**
- Creates 5 orders with status `ACCEPTED` (vendor approved, waiting for rider)
- Creates corresponding `riderAssignments` records with status `PENDING`
- Links orders to the test rider user (`rider@example.com`)
- Associates orders with test customer, vendor, and address data

**How to use:**
```bash
# 1. Ensure base data exists
npm run seed

# 2. Generate pending assignments for testing
npx ts-node src/db/seed-pending-orders.ts
```

**Output:**
```
Seeding pending orders for rider testing...
Creating 5 pending orders...
✓ Created pending order: PENDING-1781161429754-1 (ID: 22)
✓ Created pending order: PENDING-1781161429761-2 (ID: 23)
... (3 more)
✅ Pending orders seeded successfully!
You can now test the rider dashboard with pending assignments.
```

---

## Root Cause of 404 "Assignment not found" Error

When a rider tries to accept an order via `PATCH /api/rider/orders/:id/accept`:

1. **Service Code** (`src/services/rider.service.ts`, line ~73):
   ```typescript
   const [a] = await db
     .update(riderAssignments)
     .set({ status, acceptedAt: status === "ACCEPTED" ? new Date() : undefined })
     .where(and(eq(riderAssignments.orderId, orderId), eq(riderAssignments.riderId, rider.id)))
     .returning();
   if (!a) throw new AppError(404, "Assignment not found", "NOT_FOUND");
   ```

2. **The query looks for:** `riderAssignments` WHERE `orderId = X AND riderId = current_user_id`

3. **Without seed data:** No `riderAssignments` record exists → UPDATE returns 0 rows → Error thrown

**Previous State:** Test data had 11 orders but no corresponding `riderAssignments` records, causing all accept/reject attempts to fail with 404.

**Current State:** New seed script creates proper `riderAssignments` with `PENDING` status, ready for rider to accept or reject.

---

## Testing Workflow

1. **Fresh database setup:**
   ```bash
   npm run seed                    # Base users, vendor, rider, initial order
   npx ts-node src/db/seed-pending-orders.ts  # Add 5 pending orders
   npm run dev                     # Start backend on :5000
   ```

2. **Frontend testing:**
   - Login as Rider: `rider@example.com / password123`
   - Visit `/rider-dashboard`
   - You should see 5 pending orders with countdown timers
   - Click "Accept" → order moves to active delivery
   - Click "Reject" → order removed from pending list

3. **Verify in database:**
   ```sql
   SELECT o.id, o.orderNumber, o.status, ra.status as assignment_status
   FROM orders o
   LEFT JOIN rider_assignments ra ON o.id = ra.order_id
   WHERE o.order_number LIKE 'PENDING%'
   ```

---

## Files Modified
- `src/db/seed.ts` - Added conflict handling for idempotent runs
- `src/db/seed-pending-orders.ts` - New utility script

## Files Not Modified (No Changes Needed)
- `src/services/rider.service.ts` - Correctly implements assignment lookup
- `src/routes/rider.routes.ts` - Routes are correct
- Schema files - No schema changes required

---

## Next Steps (Optional Improvements)

### Option A: Auto-create Assignments (Flexible Backend)
Modify `src/services/rider.service.ts` to auto-create an assignment if it doesn't exist when getting an order:
```typescript
export const getOrder = async (userId: number, orderId: number) => {
  const rider = await getRiderByUserId(userId);
  let [assignment] = await db.select().from(riderAssignments)
    .where(and(eq(riderAssignments.orderId, orderId), eq(riderAssignments.riderId, rider.id)));
  
  // Auto-create if missing
  if (!assignment) {
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
    if (order && order.riderId === null) {
      [assignment] = await db.insert(riderAssignments).values({
        orderId, riderId: rider.id, status: "PENDING", assignedAt: new Date()
      }).returning();
    }
  }
  if (!assignment) throw new AppError(404, "Order not found", "ORDER_NOT_FOUND");
  // ... rest of implementation
};
```

### Option B: Extend Seed Utility
Add ability to seed assignments for existing orders without rider assignments:
```bash
npx ts-node src/db/seed-pending-orders.ts --target-all-unassigned
```

---

## Summary
✅ Seed script fixed
✅ Pending orders utility created
✅ Root cause documented
✅ Testing instructions provided
✅ Frontend integration ready
