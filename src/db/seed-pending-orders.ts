import { db } from "./index";
import * as schema from "./schema";
import { pool } from "../config/database";
import { eq } from "drizzle-orm";

/**
 * Seed pending orders with rider assignments for testing accept/reject flows.
 * Run this after initial seed: npx ts-node src/db/seed-pending-orders.ts
 */
async function seedPendingOrders() {
  console.log("Seeding pending orders for rider testing...");

  try {
    // Get existing users
    const allUsers = await db.select().from(schema.users);
    const customer = allUsers.find(u => u.role === "CUSTOMER");
    const vendor = allUsers.find(u => u.role === "VENDOR");
    const rider = allUsers.find(u => u.role === "RIDER");

    if (!customer || !vendor || !rider) {
      throw new Error("Base users not found. Run seed.ts first.");
    }

    // Get profiles
    const customerProfiles = await db.select().from(schema.customerProfiles).where(eq(schema.customerProfiles.userId, customer.id));
    const vendors = await db.select().from(schema.vendors).where(eq(schema.vendors.userId, vendor.id));
    const riders = await db.select().from(schema.riders).where(eq(schema.riders.userId, rider.id));

    if (customerProfiles.length === 0 || vendors.length === 0 || riders.length === 0) {
      throw new Error("Profiles not found. Run seed.ts first.");
    }

    const customerId = customerProfiles[0].id;
    const vendorId = vendors[0].id;
    const riderId = riders[0].id;

    // Get address & branch
    const addresses = await db.select().from(schema.customerAddresses).where(eq(schema.customerAddresses.customerId, customerId));
    const branches = await db.select().from(schema.vendorBranches).where(eq(schema.vendorBranches.vendorId, vendorId));

    if (addresses.length === 0 || branches.length === 0) {
      throw new Error("Address or branch not found. Run seed.ts first.");
    }

    const addressId = addresses[0].id;
    const branchId = branches[0].id;

    // Get menu item
    const menuItems = await db.select().from(schema.menuItems).where(eq(schema.menuItems.vendorId, vendorId));
    if (menuItems.length === 0) {
      throw new Error("Menu items not found. Run seed.ts first.");
    }
    const item = menuItems[0];

    // Create 5 pending orders with assignments
    console.log("Creating 5 pending orders...");
    for (let i = 1; i <= 5; i++) {
      const [order] = await db
        .insert(schema.orders)
        .values({
          orderNumber: `PENDING-${Date.now()}-${i}`,
          customerId,
          vendorId,
          branchId,
          riderId: null, // Not yet assigned to rider
          addressId,
          subtotal: "250.00",
          taxAmount: "12.50",
          deliveryFee: "40.00",
          platformFee: "5.00",
          discountAmount: "0.00",
          totalAmount: "307.50",
          status: "ACCEPTED", // Vendor accepted, waiting for rider
          paymentMethod: "UPI",
        })
        .returning();

      // Add order item
      await db.insert(schema.orderItems).values({
        orderId: order.id,
        menuItemId: item.id,
        itemName: item.name,
        price: "250.00",
        quantity: 1,
        total: "250.00",
      });

      // Create rider assignment (PENDING status means rider can accept/reject)
      await db
        .insert(schema.riderAssignments)
        .values({
          orderId: order.id,
          riderId,
          status: "PENDING", // Waiting for rider to accept or reject
          assignedAt: new Date(),
        })
        .onConflictDoNothing();

      console.log(`✓ Created pending order: ${order.orderNumber} (ID: ${order.id})`);
    }

    console.log("✅ Pending orders seeded successfully!");
    console.log("You can now test the rider dashboard with pending assignments.");
  } catch (error) {
    console.error("❌ Error seeding pending orders:", error);
    process.exit(1);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

seedPendingOrders();
