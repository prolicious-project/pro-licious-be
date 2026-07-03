import { eq, and, or, desc, gte, sql } from "drizzle-orm";
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
} from "../db/schema";
import { AppError } from "../lib/errors";
import { getRiderByUserId, recordOrderStatus } from "../lib/helpers";
import { generateOTP, hashOTP, verifyOTP } from "../utils/otp";
import { users } from "../db/schema";


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
  if (body.orderId) {
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

/** GET /orders */


/** Return enriched assignments (assignment + order + items + address) for a rider id */
export const getAssignmentsForRider = async (riderId: number) => {
  const assigns = await db.select().from(riderAssignments).where(eq(riderAssignments.riderId, riderId)).orderBy(desc(riderAssignments.assignedAt));
  const results: any[] = [];
  for (const a of assigns) {
    const [order] = await db.select().from(orders).where(eq(orders.id, a.orderId));
    const items = order ? await db.select().from(orderItems).where(eq(orderItems.orderId, a.orderId)) : [];
    const address = order?.addressId ? (await db.select().from(customerAddresses).where(eq(customerAddresses.id, order.addressId)))[0] : null;
    
    // Flatten the response to include all assignment and order details
    const result: any = {
      // Assignment details
      assignmentId: a.id,
      riderId: a.riderId,
      assignmentStatus: a.status,
      assignedAt: a.assignedAt,
      acceptedAt: a.acceptedAt,
      completedAt: a.completedAt,
      
      // Order details
      orderId: a.orderId,
      orderNumber: order?.orderNumber,
      customerId: order?.customerId,
      vendorId: order?.vendorId,
      branchId: order?.branchId,
      orderRiderId: order?.riderId,
      addressId: order?.addressId,
      subtotal: order?.subtotal,
      taxAmount: order?.taxAmount,
      deliveryFee: order?.deliveryFee,
      platformFee: order?.platformFee,
      discountAmount: order?.discountAmount,
      totalAmount: order?.totalAmount,
      orderStatus: order?.status,
      paymentMethod: order?.paymentMethod,
      orderCreatedAt: order?.createdAt,
      orderUpdatedAt: order?.updatedAt,
      
      // Related data
      items,
      address
    };
    results.push(result);
  }
  return results;
};
export const listOrders = async (userId: number) => {
  const rider = await getRiderByUserId(userId);
  return getAssignmentsForRider(rider.id);
};
/** GET /orders/:id */
export const getOrder = async (userId: number, orderId: number) => {
  const rider = await getRiderByUserId(userId);
  const [assignment] = await db.select().from(riderAssignments).where(and(eq(riderAssignments.orderId, orderId), eq(riderAssignments.riderId, rider.id)));
  if (!assignment) throw new AppError(404, "Order not found", "ORDER_NOT_FOUND");
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  const address = order?.addressId
    ? (await db.select().from(customerAddresses).where(eq(customerAddresses.id, order.addressId)))[0]
    : null;
  
  // Return flattened structure with all details
  return {
    // Assignment details
    assignmentId: assignment.id,
    riderId: assignment.riderId,
    assignmentStatus: assignment.status,
    assignedAt: assignment.assignedAt,
    acceptedAt: assignment.acceptedAt,
    completedAt: assignment.completedAt,
    
    // Order details
    orderId: assignment.orderId,
    orderNumber: order?.orderNumber,
    customerId: order?.customerId,
    vendorId: order?.vendorId,
    branchId: order?.branchId,
    orderRiderId: order?.riderId,
    addressId: order?.addressId,
    subtotal: order?.subtotal,
    taxAmount: order?.taxAmount,
    deliveryFee: order?.deliveryFee,
    platformFee: order?.platformFee,
    discountAmount: order?.discountAmount,
    totalAmount: order?.totalAmount,
    orderStatus: order?.status,
    paymentMethod: order?.paymentMethod,
    orderCreatedAt: order?.createdAt,
    orderUpdatedAt: order?.updatedAt,
    
    // Related data
    items,
    address
  };
};

const assignmentAction = async (userId: number, orderId: number, status: string, orderStatus: string, title: string) => {
  const rider = await getRiderByUserId(userId);
  const [a] = await db
    .update(riderAssignments)
    .set({ status, acceptedAt: status === "ACCEPTED" ? new Date() : undefined })
    .where(and(eq(riderAssignments.orderId, orderId), eq(riderAssignments.riderId, rider.id)))
    .returning();
  if (!a) throw new AppError(404, "Assignment not found", "NOT_FOUND");
  await db.update(orders).set({ riderId: rider.id }).where(eq(orders.id, orderId));
  await recordOrderStatus(orderId, orderStatus, title, userId);
  return a;
};

export const acceptOrder = (userId: number, orderId: number) => assignmentAction(userId, orderId, "ACCEPTED", "RIDER_ASSIGNED", "Rider Assigned");
export const rejectOrder = (userId: number, orderId: number) => assignmentAction(userId, orderId, "REJECTED", "RIDER_REJECTED", "Rider Rejected");
export const arrivedVendor = (userId: number, orderId: number) => assignmentAction(userId, orderId, "ACCEPTED", "ARRIVED_VENDOR", "Arrived at Vendor");
export const pickedUp = (userId: number, orderId: number) => assignmentAction(userId, orderId, "ACCEPTED", "PICKED_UP", "Order Picked Up");
export const arrivedCustomer = (userId: number, orderId: number) => assignmentAction(userId, orderId, "ACCEPTED", "ARRIVED_CUSTOMER", "Arrived at Customer");

/** POST /orders/:id/deliver — OTP verify */
export const deliverOrder = async (userId: number, orderId: number, otp: string) => {
  const rider = await getRiderByUserId(userId);
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order) throw new AppError(404, "Order not found", "ORDER_NOT_FOUND");

  const [otpRecord] = await db
    .select()
    .from(otpVerifications)
    .where(and(eq(otpVerifications.purpose, "DELIVERY_CONFIRM"), eq(otpVerifications.used, false)))
    .orderBy(desc(otpVerifications.createdAt))
    .limit(1);

  if (otpRecord && !(await verifyOTP(otp, otpRecord.otpHash))) {
    throw new AppError(400, "Invalid delivery OTP", "INVALID_OTP");
  }

  await db.update(riderAssignments).set({ status: "COMPLETED", completedAt: new Date() }).where(and(eq(riderAssignments.orderId, orderId), eq(riderAssignments.riderId, rider.id)));
  await recordOrderStatus(orderId, "DELIVERED", "Order Delivered", userId);
  await db.insert(riderEarnings).values({ riderId: rider.id, orderId, earningAmount: "50.00" });
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
  return { total, today: today.reduce((s, r) => s + Number(r.earningAmount), 0), count: rows.length };
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
  // if an assignment already exists (ASSIGNED or ACCEPTED), return it instead of creating a duplicate
  const existing = await runner
    .select()
    .from(riderAssignments)
    .where(and(eq(riderAssignments.orderId, orderId), or(eq(riderAssignments.status, "ASSIGNED"), eq(riderAssignments.status, "ACCEPTED"))));
  if (existing && existing.length) {
    const exist = existing[0];
    const [riderRow] = await runner.select().from(riders).where(eq(riders.id, exist.riderId));
    const [userRow] = riderRow ? await runner.select().from(users).where(eq(users.id, riderRow.userId)) : [undefined];
    return { assignment: exist, rider: riderRow, user: userRow };
  }
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
export function listDocuments(arg0: number): unknown {
  throw new Error("Function not implemented.");
}

export function uploadDocument(arg0: number, documentType: any, fileUrl: any): unknown {
  throw new Error("Function not implemented.");
}

