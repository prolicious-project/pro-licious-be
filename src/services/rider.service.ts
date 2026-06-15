import { eq, and, desc, gte, sql } from "drizzle-orm";
import { db } from "../db";
import {
  riders,
  riderAvailability,
  riderAssignments,
  orders,
  orderItems,
  customerAddresses,
  deliveryTrackingEvents,
  riderEarnings,
  riderShiftLogs,
  riderSettlements,
  riderPayoutTransactions,
  notifications,
  otpVerifications,
  customerProfiles,
  vendors,
  vendorBranches,
} from "../db/schema";
import { AppError } from "../lib/errors";
import { getRiderByUserId, recordOrderStatus } from "../lib/helpers";
import { generateOTP, hashOTP, verifyOTP, storeOtpRedis, getOtpRedis, clearOtpRedis } from "../utils/otp";
import { users } from "../db/schema";
import { getIo } from "../socket";

/** PATCH /availability — online/offline toggle */
export const setAvailability = async (userId: number, isOnline: boolean) => {
  const rider = await getRiderByUserId(userId);
  const [existing] = await db.select().from(riderAvailability).where(eq(riderAvailability.riderId, rider.id));
  if (existing) {
    const [u] = await db.update(riderAvailability).set({ isOnline, lastSeen: new Date() }).where(eq(riderAvailability.riderId, rider.id)).returning();
    return u;
  }
  const [u] = await db.insert(riderAvailability).values({ riderId: rider.id, isOnline, lastSeen: new Date() }).returning();
  if (isOnline) await db.insert(riderShiftLogs).values({ riderId: rider.id, loginTime: new Date() });
  return u;
};

/** POST /location — push GPS */
export const pushLocation = async (userId: number, body: { orderId?: number; latitude: number; longitude: number }) => {
  const rider = await getRiderByUserId(userId);
  if (body.orderId && Number.isFinite(body.orderId)) {
    await db.insert(deliveryTrackingEvents).values({
      orderId: body.orderId,
      riderId: rider.id,
      eventType: "LOCATION_UPDATE",
      latitude: String(body.latitude),
      longitude: String(body.longitude),
    });
  }
  await db.update(riderAvailability).set({ lastSeen: new Date() }).where(eq(riderAvailability.riderId, rider.id));
  return { message: "Location updated" };
};

const enrichRiderOrder = async (assignment: any) => {
  const [order] = await db.select().from(orders).where(eq(orders.id, assignment.orderId));
  if (!order) return null;

  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, assignment.orderId));
  const address = order.addressId
    ? (await db.select().from(customerAddresses).where(eq(customerAddresses.id, order.addressId)))[0]
    : null;

  const customerProfile = order.customerId
    ? (await db.select().from(customerProfiles).where(eq(customerProfiles.id, order.customerId)))[0]
    : null;
  const customerUser = customerProfile
    ? (await db.select().from(users).where(eq(users.id, customerProfile.userId)))[0]
    : null;

  const vendorBranch = order.branchId
    ? (await db.select().from(vendorBranches).where(eq(vendorBranches.id, order.branchId)))[0]
    : (await db.select().from(vendorBranches).where(eq(vendorBranches.vendorId, order.vendorId)))[0];
  const vendorProfile = order.vendorId
    ? (await db.select().from(vendors).where(eq(vendors.id, order.vendorId)))[0]
    : null;

  return {
    id: order.id,
    orderId: order.id,
    assignmentId: assignment.id,
    orderNumber: order.orderNumber,
    status: order.status,
    orderStatus: order.status,
    assignmentStatus: assignment.status,
    assignedAt: assignment.assignedAt ? assignment.assignedAt.toISOString() : null,
    acceptedAt: assignment.acceptedAt ? assignment.acceptedAt.toISOString() : null,
    completedAt: assignment.completedAt ? assignment.completedAt.toISOString() : null,
    subtotal: order.subtotal ? Number(order.subtotal) : 0,
    taxAmount: order.taxAmount ? Number(order.taxAmount) : 0,
    deliveryFee: order.deliveryFee ? Number(order.deliveryFee) : 0,
    platformFee: order.platformFee ? Number(order.platformFee) : 0,
    discountAmount: order.discountAmount ? Number(order.discountAmount) : 0,
    totalAmount: order.totalAmount ? Number(order.totalAmount) : 0,
    paymentMethod: order.paymentMethod,
    orderCreatedAt: order.createdAt ? order.createdAt.toISOString() : null,
    orderUpdatedAt: order.updatedAt ? order.updatedAt.toISOString() : null,
    items: items.map((item) => ({
      id: item.id,
      name: item.itemName,
      quantity: item.quantity,
      price: Number(item.price),
    })),
    address: address ? {
      streetAddress: `${address.houseNumber || ""} ${address.street || ""}`.trim() || address.landmark || "Delivery Address",
      city: address.city,
      latitude: address.latitude ? Number(address.latitude) : null,
      longitude: address.longitude ? Number(address.longitude) : null,
    } : null,
    vendor: vendorProfile ? {
      id: vendorProfile.id,
      name: vendorProfile.name,
      address: vendorBranch?.address || "",
      phone: vendorBranch?.phone || vendorProfile.phone || "",
      latitude: vendorBranch?.latitude ? Number(vendorBranch.latitude) : null,
      longitude: vendorBranch?.longitude ? Number(vendorBranch.longitude) : null,
    } : null,
    customer: customerUser ? {
      name: customerUser.name,
      phone: customerUser.phone || "",
    } : null,
  };
};

/** GET /orders — return enriched assignments with order details */
export const listOrders = async (userId: number) => {
  const rider = await getRiderByUserId(userId);
  const assigns = await db
    .select()
    .from(riderAssignments)
    .where(eq(riderAssignments.riderId, rider.id))
    .orderBy(desc(riderAssignments.assignedAt));

  const results: any[] = [];
  for (const a of assigns) {
    const enriched = await enrichRiderOrder(a);
    if (enriched) results.push(enriched);
  }
  return results;
};

/** GET /orders/:id */
export const getOrder = async (userId: number, orderId: number) => {
  const rider = await getRiderByUserId(userId);
  const [assignment] = await db.select().from(riderAssignments).where(and(eq(riderAssignments.orderId, orderId), eq(riderAssignments.riderId, rider.id)));
  if (!assignment) throw new AppError(404, "Order not found", "ORDER_NOT_FOUND");
  const enriched = await enrichRiderOrder(assignment);
  if (!enriched) throw new AppError(404, "Order details not found", "ORDER_NOT_FOUND");
  return enriched;
};

const assignmentAction = async (userId: number, orderId: number, status: string, orderStatus: string, title: string) => {
  if (!orderId || !Number.isFinite(orderId)) {
    throw new AppError(400, "Invalid order ID", "INVALID_ORDER_ID");
  }
  const rider = await getRiderByUserId(userId);
  const [a] = await db
    .update(riderAssignments)
    .set({ status, acceptedAt: status === "ACCEPTED" ? new Date() : undefined })
    .where(and(eq(riderAssignments.orderId, orderId), eq(riderAssignments.riderId, rider.id)))
    .returning();
  if (!a) throw new AppError(404, "Assignment not found", "NOT_FOUND");
  try {
    await db.update(orders).set({ riderId: rider.id }).where(eq(orders.id, orderId));
    await recordOrderStatus(orderId, orderStatus, title, userId);
  } catch (err) {
    console.error(`assignmentAction post-update error for order ${orderId}:`, err);
    // Assignment was already updated, so don't throw — just log
  }
  return a;
};

export const acceptOrder = (userId: number, orderId: number) => assignmentAction(userId, orderId, "ACCEPTED", "RIDER_ASSIGNED", "Rider Assigned");
export const rejectOrder = (userId: number, orderId: number) => assignmentAction(userId, orderId, "REJECTED", "RIDER_REJECTED", "Rider Rejected");
export const arrivedVendor = (userId: number, orderId: number) => assignmentAction(userId, orderId, "ACCEPTED", "ARRIVED_VENDOR", "Arrived at Vendor");
export const pickedUp = (userId: number, orderId: number) => assignmentAction(userId, orderId, "ACCEPTED", "PICKED_UP", "Order Picked Up");
export const arrivedCustomer = async (userId: number, orderId: number) => {
  const a = await assignmentAction(userId, orderId, "ACCEPTED", "ARRIVED_CUSTOMER", "Arrived at Customer");

  // Generate 4-digit OTP
  const otp = String(Math.floor(1000 + Math.random() * 9000));
  const otpHash = await hashOTP(otp);

  // Get customer phone
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (order) {
    const customerProfile = (await db.select().from(customerProfiles).where(eq(customerProfiles.id, order.customerId)))[0];
    const customerUser = customerProfile ? (await db.select().from(users).where(eq(users.id, customerProfile.userId)))[0] : null;
    const phone = customerUser?.phone || "0000000000";

    // Store in DB
    await db.insert(otpVerifications).values({
      phone,
      otpHash,
      purpose: "DELIVERY_CONFIRM",
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    });

    // Store in Redis using "delivery:orderId" as key
    await storeOtpRedis("delivery:" + orderId, otpHash);

    // Print to console in dev
    console.log(`[DELIVERY OTP] Order ${orderId} OTP is: ${otp}`);

    // Emit socket event to the customer room
    const io = getIo();
    if (io) {
      io.to(`order:${orderId}`).emit("otp_sent_to_customer", {
        orderId,
        message: "OTP has been sent to customer",
      });
      // Also emit order status changed to customer
      io.to(`order:${orderId}`).emit("order_status_changed", {
        orderId,
        status: "ARRIVED_CUSTOMER",
        message: "Rider arrived at customer location",
      });
    }
  }

  return a;
};

/** POST /orders/:id/deliver — OTP verify */
export const deliverOrder = async (userId: number, orderId: number, otp: string) => {
  const rider = await getRiderByUserId(userId);
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order) throw new AppError(404, "Order not found", "ORDER_NOT_FOUND");

  // Get customer user phone
  const customerProfile = (await db.select().from(customerProfiles).where(eq(customerProfiles.id, order.customerId)))[0];
  const customerUser = customerProfile ? (await db.select().from(users).where(eq(users.id, customerProfile.userId)))[0] : null;
  const phone = customerUser?.phone || "0000000000";

  let verified = false;

  // Try Redis first
  const redisHash = await getOtpRedis("delivery:" + orderId);
  if (redisHash) {
    if (await verifyOTP(otp, redisHash)) {
      verified = true;
      await clearOtpRedis("delivery:" + orderId);
      
      // Also mark in DB as used
      const [dbRecord] = await db
        .select()
        .from(otpVerifications)
        .where(and(eq(otpVerifications.phone, phone), eq(otpVerifications.purpose, "DELIVERY_CONFIRM"), eq(otpVerifications.used, false)))
        .orderBy(desc(otpVerifications.createdAt))
        .limit(1);
      if (dbRecord) {
        await db.update(otpVerifications).set({ used: true }).where(eq(otpVerifications.id, dbRecord.id));
      }
    }
  }

  // Fallback to DB check
  if (!verified) {
    const [otpRecord] = await db
      .select()
      .from(otpVerifications)
      .where(and(eq(otpVerifications.phone, phone), eq(otpVerifications.purpose, "DELIVERY_CONFIRM"), eq(otpVerifications.used, false)))
      .orderBy(desc(otpVerifications.createdAt))
      .limit(1);

    if (otpRecord) {
      if (otpRecord.expiresAt < new Date()) {
        throw new AppError(400, "OTP expired", "OTP_EXPIRED");
      }
      if (await verifyOTP(otp, otpRecord.otpHash)) {
        verified = true;
        await db.update(otpVerifications).set({ used: true }).where(eq(otpVerifications.id, otpRecord.id));
        await clearOtpRedis("delivery:" + orderId);
      }
    }
  }

  if (!verified) {
    throw new AppError(400, "Invalid delivery OTP", "INVALID_OTP");
  }

  await db.update(riderAssignments).set({ status: "COMPLETED", completedAt: new Date() }).where(and(eq(riderAssignments.orderId, orderId), eq(riderAssignments.riderId, rider.id)));
  await recordOrderStatus(orderId, "DELIVERED", "Order Delivered", userId);
  await db.insert(riderEarnings).values({ riderId: rider.id, orderId, earningAmount: "50.00" });

  // Emit socket events
  const io = getIo();
  if (io) {
    io.to(`order:${orderId}`).emit("delivery_confirmed", {
      orderId,
      status: "DELIVERED",
      message: "Delivery confirmed successfully",
    });
    io.to(`order:${orderId}`).emit("order_status_changed", {
      orderId,
      status: "DELIVERED",
      message: "Order delivered successfully",
    });
  }

  return { message: "Delivery confirmed" };
};

/** GET /earnings */
export const listEarnings = async (userId: number) => {
  const rider = await getRiderByUserId(userId);
  return db.select().from(riderEarnings).where(eq(riderEarnings.riderId, rider.id)).orderBy(desc(riderEarnings.createdAt));
};

/** GET /earnings/summary */
export const earningsSummary = async (userId: number) => {
  const rider = await getRiderByUserId(userId);
  const rows = await db.select().from(riderEarnings).where(eq(riderEarnings.riderId, rider.id));
  const total = rows.reduce((s, r) => s + Number(r.earningAmount), 0);
  const today = rows.filter((r) => r.createdAt && new Date(r.createdAt).toDateString() === new Date().toDateString());
  const [avail] = await db.select().from(riderAvailability).where(eq(riderAvailability.riderId, rider.id));
  const isOnline = avail ? avail.isOnline : false;
  return { total, today: today.reduce((s, r) => s + Number(r.earningAmount), 0), count: rows.length, isOnline };
};

export const listShifts = async (userId: number) => {
  const rider = await getRiderByUserId(userId);
  return db.select().from(riderShiftLogs).where(eq(riderShiftLogs.riderId, rider.id)).orderBy(desc(riderShiftLogs.loginTime));
};

export const listSettlements = async (userId: number) => {
  const rider = await getRiderByUserId(userId);
  return db.select().from(riderSettlements).where(eq(riderSettlements.riderId, rider.id));
};

export const listPayouts = async (userId: number) => {
  const rider = await getRiderByUserId(userId);
  return db.select().from(riderPayoutTransactions).where(eq(riderPayoutTransactions.riderId, rider.id));
};

export const listNotifications = async (userId: number) =>
  db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt));

/** Create delivery OTP for order (called when rider arrives at customer) */
export const createDeliveryOtp = async (phone: string) => {
  const otp = generateOTP();
  const otpHash = await hashOTP(otp);
  await db.insert(otpVerifications).values({
    phone,
    otpHash,
    purpose: "DELIVERY_CONFIRM",
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });
  return otp;
};

/** Assign a rider to an order (simple nearest-available strategy) */
export const assignRiderToOrder = async (orderId: number, tx?: any) => {
  // find an online rider (most recently seen)
  const runner = tx || db;
  const rows = await runner
    .select()
    .from(riderAvailability)
    .where(eq(riderAvailability.isOnline, true))
    .orderBy(desc(riderAvailability.lastSeen));
  if (!rows.length) return null;
  const riderAvail = rows[0];
  const [riderRow] = await runner.select().from(riders).where(eq(riders.id, riderAvail.riderId));
  if (!riderRow) return null;

  const [userRow] = await runner.select().from(users).where(eq(users.id, riderRow.userId));

  const [assignment] = await runner
    .insert(riderAssignments)
    .values({ orderId, riderId: riderRow.id, status: "ASSIGNED", assignedAt: new Date() })
    .returning();

  // create notification record (in same tx if provided)
  if (userRow) {
    await runner.insert(notifications).values({ userId: userRow.id, title: "New delivery", message: `You have a new delivery (order ${orderId})`, type: "DELIVERY" });
  }

  // return assignment and rider info; caller should emit socket events after commit
  return { assignment, rider: riderRow, user: userRow };
};
