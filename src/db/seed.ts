import { db } from "./index";
import * as schema from "./schema";
import { pool } from "../config/database";
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";

async function seed() {
  console.log("Seeding database with comprehensive data...");

  try {
    // 1. Roles
    console.log("Seeding roles...");
    await db.insert(schema.roles).values([
      { roleName: "ADMIN", description: "Administrator" },
      { roleName: "CUSTOMER", description: "Customer" },
      { roleName: "VENDOR", description: "Vendor" },
      { roleName: "RIDER", description: "Delivery Rider" },
    ]).onConflictDoNothing();

    const passwordHash = await bcrypt.hash("password123", 10);

    // 2. Users
    console.log("Seeding users...");
    await db.insert(schema.users).values([
      { name: "John Customer", phone: "9876543210", email: "john@example.com", passwordHash, role: "CUSTOMER" },
      { name: "Meat Master Vendor", phone: "9876543211", email: "vendor@example.com", passwordHash, role: "VENDOR" },
      { name: "Speedy Rider", phone: "9876543212", email: "rider@example.com", passwordHash, role: "RIDER" },
      { name: "Admin Super", phone: "9876543213", email: "admin@example.com", passwordHash, role: "ADMIN" }
    ]).onConflictDoNothing();

    const allUsers = await db.select().from(schema.users);
    const customer = allUsers.find(u => u.role === "CUSTOMER");
    const vendor = allUsers.find(u => u.role === "VENDOR");
    const rider = allUsers.find(u => u.role === "RIDER");
    const admin = allUsers.find(u => u.role === "ADMIN");

    if (!customer || !vendor || !rider || !admin) {
      throw new Error("Base users could not be created or found.");
    }

    // 3. Profiles
    let customerId;
    console.log("Seeding customer profile...");
    const cProfileResult = await db.insert(schema.customerProfiles)
      .values({ userId: customer.id, gender: "MALE" })
      .onConflictDoNothing()
      .returning();
    
    if (cProfileResult.length > 0) customerId = cProfileResult[0].id;
    else {
      const existing = await db.select().from(schema.customerProfiles).where(eq(schema.customerProfiles.userId, customer.id));
      customerId = existing[0].id;
    }

    let vendorId;
    console.log("Seeding vendor profile...");
    const vProfileResult = await db.insert(schema.vendors)
      .values({ userId: vendor.id, name: "Premium Meats Co.", phone: vendor.phone, email: vendor.email, status: "ACTIVE" })
      .onConflictDoNothing()
      .returning();
      
    if (vProfileResult.length > 0) vendorId = vProfileResult[0].id;
    else {
      const existing = await db.select().from(schema.vendors).where(eq(schema.vendors.userId, vendor.id));
      vendorId = existing[0].id;
    }

    let riderId;
    console.log("Seeding rider profile...");
    const rProfileResult = await db.insert(schema.riders)
      .values({ userId: rider.id, vehicleType: "BIKE", vehicleNumber: "MH12AB1234", status: "ACTIVE" })
      .onConflictDoNothing()
      .returning();
    
    if (rProfileResult.length > 0) riderId = rProfileResult[0].id;
    else {
      const existing = await db.select().from(schema.riders).where(eq(schema.riders.userId, rider.id));
      riderId = existing[0].id;
    }

    // 4. Addresses & Zones
    console.log("Seeding zones and addresses...");
    const [zone] = await db.insert(schema.zones).values({
      zoneName: "Downtown Mumbai", city: "Mumbai", state: "Maharashtra", status: "ACTIVE"
    }).returning();

    const [address] = await db.insert(schema.customerAddresses).values({
      customerId, addressType: "HOME", houseNumber: "12A", street: "Linking Road",
      city: "Mumbai", state: "Maharashtra", pincode: "400050", latitude: "19.0596", longitude: "72.8295", isDefault: true
    }).returning();

    const [branch] = await db.insert(schema.vendorBranches).values({
      vendorId, zoneId: zone.id, branchName: "Bandra Branch", phone: "9876543211", address: "Bandra West",
      latitude: "19.0544", longitude: "72.8339", status: "ACTIVE"
    }).returning();

    // 5. Categories & Menu Items
    console.log("Seeding categories and menu items...");
    const [category] = await db.insert(schema.categories).values({
      vendorId, name: "Fresh Chicken", description: "Farm fresh chicken"
    }).returning();

    const [item1, item2] = await db.insert(schema.menuItems).values([
      { vendorId, categoryId: category.id, name: "Chicken Breast Boneless", price: "250.00", isVeg: false, stockQuantity: 50 },
      { vendorId, categoryId: category.id, name: "Chicken Curry Cut", price: "180.00", isVeg: false, stockQuantity: 100 }
    ]).returning();

    // 6. Orders (Past and Active)
    console.log("Seeding orders and related transactional data...");
    
    // Create an order
    const [order] = await db.insert(schema.orders).values({
      orderNumber: `ORD-${Date.now()}`,
      customerId, vendorId, branchId: branch.id, riderId, addressId: address.id,
      subtotal: "430.00", taxAmount: "21.50", deliveryFee: "40.00", platformFee: "5.00", discountAmount: "0.00", totalAmount: "496.50",
      status: "COMPLETED", paymentMethod: "UPI"
    }).returning();

    // Order Items
    await db.insert(schema.orderItems).values([
      { orderId: order.id, menuItemId: item1.id, itemName: item1.name, price: item1.price, quantity: 1, total: "250.00" },
      { orderId: order.id, menuItemId: item2.id, itemName: item2.name, price: item2.price, quantity: 1, total: "180.00" }
    ]);

    // Order Status History
    await db.insert(schema.orderStatusHistory).values([
      { orderId: order.id, status: "PLACED", remarks: "Customer placed the order" },
      { orderId: order.id, status: "ACCEPTED", remarks: "Vendor accepted the order" },
      { orderId: order.id, status: "PREPARING", remarks: "Vendor is preparing" },
      { orderId: order.id, status: "READY", remarks: "Order is ready for pickup" },
      { orderId: order.id, status: "PICKED_UP", remarks: "Rider picked up" },
      { orderId: order.id, status: "COMPLETED", remarks: "Delivered successfully" }
    ]);

    // Rider Assignment
    await db.insert(schema.riderAssignments).values({
      orderId: order.id, riderId, status: "COMPLETED",
      assignedAt: new Date(Date.now() - 3600000), // 1 hour ago
      acceptedAt: new Date(Date.now() - 3500000),
      completedAt: new Date()
    });

    // Payment
    await db.insert(schema.payments).values({
      orderId: order.id, gateway: "RAZORPAY", paymentReference: `pay_${Date.now()}`,
      amount: "496.50", status: "SUCCESS", paymentMode: "UPI"
    });

    // Complaint
    await db.insert(schema.complaints).values({
      orderId: order.id, customerId, category: "DELIVERY_DELAY",
      description: "The delivery was delayed by 15 minutes.", status: "OPEN"
    });

    // Support Ticket
    await db.insert(schema.supportTickets).values({
      customerId, subject: "How to apply coupon codes?", status: "OPEN", priority: "LOW"
    });

    // Carts (Active Cart for testing checkout)
    const [cart] = await db.insert(schema.carts).values({
      customerId, vendorId, status: "ACTIVE"
    }).onConflictDoNothing().returning();
    
    if (cart) {
      await db.insert(schema.cartItems).values({
        cartId: cart.id, menuItemId: item1.id, quantity: 2, price: item1.price
      });
    }

    console.log("✅ Comprehensive seeding completed successfully!");
  } catch (error) {
    console.error("❌ Error seeding database:", error);
  } finally {
    // Close the DB connection
    await pool.end();
    process.exit(0);
  }
}

seed();
