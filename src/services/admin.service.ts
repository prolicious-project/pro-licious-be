import { eq, and, desc, gte } from "drizzle-orm";
import { db } from "../db";
import {
  orders,
  orderItems,
  users,
  vendors,
  riders,
  vendorDocuments,
  riderDocuments,
  supportTickets,
  complaints,
  complaintResponses,
  adminActions,
  fraudFlags,
  dailyMetrics,
  demandSupplyMetrics,
  customerProfiles,
  riderAvailability,
  payments,
  refunds,
} from "../db/schema";
import { AppError } from "../lib/errors";
import { recordOrderStatus } from "../lib/helpers";
import { hashPassword } from "../utils/passwordHash";

/** GET /dashboard/live — live platform stats */
export const liveDashboard = async () => {
  const allOrders = await db.select().from(orders);
  const activeOrders = allOrders.filter((o) => !["DELIVERED", "CANCELLED"].includes(o.status));
  const [vendorCount] = await db.select().from(vendors);
  const [riderCount] = await db.select().from(riders);
  const [customerCount] = await db.select().from(customerProfiles);
  const onlineRiders = await db.select().from(riderAvailability).where(eq(riderAvailability.isOnline, true));
  return {
    totalOrders: allOrders.length,
    activeOrders: activeOrders.length,
    vendors: vendorCount ? (await db.select().from(vendors)).length : 0,
    riders: riderCount ? (await db.select().from(riders)).length : 0,
    customers: customerCount ? (await db.select().from(customerProfiles)).length : 0,
    onlineRiders: onlineRiders.length,
  };
};

/** GET /analytics/daily */
export const dailyAnalytics = async () => {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  return db.select().from(dailyMetrics).where(gte(dailyMetrics.metricDate, since.toISOString().slice(0, 10))).orderBy(desc(dailyMetrics.metricDate));
};

/** GET /analytics/demand-supply */
export const demandSupply = async () =>
  db.select().from(demandSupplyMetrics).orderBy(desc(demandSupplyMetrics.createdAt)).limit(100);

/** GET /orders */
export const listOrders = async (status?: string) => {
  const cond = status ? eq(orders.status, status) : undefined;
  return cond ? db.select().from(orders).where(cond).orderBy(desc(orders.createdAt)) : db.select().from(orders).orderBy(desc(orders.createdAt));
};

/** GET /orders/:id */
export const getOrder = async (orderId: number) => {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order) throw new AppError(404, "Order not found", "ORDER_NOT_FOUND");
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  return { ...order, items };
};

/** PATCH /orders/:id/cancel — admin force cancel */
export const cancelOrder = async (adminId: number, orderId: number, notes?: string) => {
  await getOrder(orderId);
  await recordOrderStatus(orderId, "CANCELLED", "Admin Cancelled", adminId, notes);
  await logAdminAction(adminId, "ORDER_CANCELLED", "order", orderId, notes);
  return { message: "Order cancelled" };
};

/** POST /refunds */
export const createRefund = async (adminId: number, body: { paymentId: number; amount: number; reason?: string }) => {
  const [payment] = await db.select().from(payments).where(eq(payments.id, body.paymentId));
  if (!payment) throw new AppError(404, "Payment not found", "NOT_FOUND");
  const [refund] = await db
    .insert(refunds)
    .values({ paymentId: body.paymentId, amount: String(body.amount), reason: body.reason, status: "PROCESSED" })
    .returning();
  await logAdminAction(adminId, "REFUND_APPROVED", "payment", body.paymentId, body.reason);
  return refund;
};

/** GET /vendors */
export const listVendors = async () => db.select().from(vendors).orderBy(desc(vendors.createdAt));

/** POST /vendors — onboard vendor with user account */
export const createVendor = async (adminId: number, body: { name: string; phone: string; email?: string; password?: string }) => {
  const [user] = await db
    .insert(users)
    .values({
      name: body.name,
      phone: body.phone,
      email: body.email,
      role: "VENDOR",
      passwordHash: body.password ? await hashPassword(body.password) : undefined,
      status: "ACTIVE",
    })
    .returning();
  const [vendor] = await db.insert(vendors).values({ userId: user.id, name: body.name, phone: body.phone, email: body.email, status: "ACTIVE" }).returning();
  await logAdminAction(adminId, "VENDOR_CREATED", "vendor", vendor.id);
  return vendor;
};

/** PATCH /vendors/:id/status */
export const updateVendorStatus = async (adminId: number, vendorId: number, status: string) => {
  const [v] = await db.update(vendors).set({ status }).where(eq(vendors.id, vendorId)).returning();
  if (!v) throw new AppError(404, "Vendor not found", "VENDOR_NOT_FOUND");
  await logAdminAction(adminId, "VENDOR_STATUS_UPDATED", "vendor", vendorId, status);
  return v;
};

/** GET /vendors/:id/documents */
export const listVendorDocuments = async (vendorId: number) =>
  db.select().from(vendorDocuments).where(eq(vendorDocuments.vendorId, vendorId));

/** PATCH /vendors/:id/documents/:docId */
export const verifyVendorDocument = async (adminId: number, vendorId: number, docId: number, status: string) => {
  const [doc] = await db
    .update(vendorDocuments)
    .set({ verificationStatus: status })
    .where(and(eq(vendorDocuments.id, docId), eq(vendorDocuments.vendorId, vendorId)))
    .returning();
  if (!doc) throw new AppError(404, "Document not found", "NOT_FOUND");
  await logAdminAction(adminId, "VENDOR_DOC_VERIFIED", "vendor", vendorId, status);
  return doc;
};

/** GET /riders */
export const listRiders = async () => db.select().from(riders);

/** POST /riders */
export const createRider = async (adminId: number, body: { name: string; phone: string; email?: string }) => {
  const [user] = await db.insert(users).values({ name: body.name, phone: body.phone, email: body.email, role: "RIDER", status: "ACTIVE" }).returning();
  const [rider] = await db.insert(riders).values({ userId: user.id, status: "ACTIVE" }).returning();
  await logAdminAction(adminId, "RIDER_CREATED", "rider", rider.id);
  return rider;
};

/** PATCH /riders/:id/status */
export const updateRiderStatus = async (adminId: number, riderId: number, status: string) => {
  const [r] = await db.update(riders).set({ status }).where(eq(riders.id, riderId)).returning();
  if (!r) throw new AppError(404, "Rider not found", "NOT_FOUND");
  await logAdminAction(adminId, "RIDER_STATUS_UPDATED", "rider", riderId, status);
  return r;
};

/** GET /riders/:id/documents */
export const listRiderDocuments = async (riderId: number) =>
  db.select().from(riderDocuments).where(eq(riderDocuments.riderId, riderId));

/** PATCH /riders/:id/documents/:docId */
export const verifyRiderDocument = async (adminId: number, riderId: number, docId: number, status: string) => {
  const [doc] = await db
    .update(riderDocuments)
    .set({ verificationStatus: status })
    .where(and(eq(riderDocuments.id, docId), eq(riderDocuments.riderId, riderId)))
    .returning();
  if (!doc) throw new AppError(404, "Document not found", "NOT_FOUND");
  await logAdminAction(adminId, "RIDER_DOC_VERIFIED", "rider", riderId, status);
  return doc;
};

/** GET /tickets */
export const listTickets = async () => db.select().from(supportTickets).orderBy(desc(supportTickets.createdAt));

/** POST /tickets/:id/respond */
export const respondTicket = async (adminId: number, ticketId: number, response: string) => {
  const [ticket] = await db.update(supportTickets).set({ status: "IN_PROGRESS" }).where(eq(supportTickets.id, ticketId)).returning();
  if (!ticket) throw new AppError(404, "Ticket not found", "NOT_FOUND");
  await logAdminAction(adminId, "TICKET_RESPONDED", "ticket", ticketId, response);
  return { ticket, response };
};

/** GET /complaints */
export const listComplaints = async () => db.select().from(complaints).orderBy(desc(complaints.createdAt));

/** POST /complaints/:id/respond */
export const respondComplaint = async (adminId: number, complaintId: number, response: string) => {
  const [complaint] = await db.select().from(complaints).where(eq(complaints.id, complaintId));
  if (!complaint) throw new AppError(404, "Complaint not found", "NOT_FOUND");
  const [row] = await db.insert(complaintResponses).values({ complaintId, adminId, response }).returning();
  await db.update(complaints).set({ status: "RESOLVED" }).where(eq(complaints.id, complaintId));
  await logAdminAction(adminId, "COMPLAINT_RESPONDED", "complaint", complaintId);
  return row;
};

/** GET /audit-logs */
export const auditLogs = async () => db.select().from(adminActions).orderBy(desc(adminActions.createdAt)).limit(200);

/** GET /fraud-flags */
export const listFraudFlags = async () => db.select().from(fraudFlags).orderBy(desc(fraudFlags.createdAt));

/** PATCH /fraud-flags/:id */
export const reviewFraudFlag = async (adminId: number, id: number, status: string) => {
  const [flag] = await db.update(fraudFlags).set({ status }).where(eq(fraudFlags.id, id)).returning();
  if (!flag) throw new AppError(404, "Flag not found", "NOT_FOUND");
  await logAdminAction(adminId, "FRAUD_REVIEWED", "fraud_flag", id, status);
  return flag;
};

/** Log admin action to audit trail */
async function logAdminAction(adminId: number, actionType: string, entityType: string, entityId: number, notes?: string) {
  await db.insert(adminActions).values({ adminId, actionType, entityType, entityId, notes });
}
