import { eq, and, desc, sql, gte, inArray } from "drizzle-orm";
import { db } from "../db";
import {
  vendors,
  vendorBranches,
  vendorOperatingHours,
  categories,
  menuItems,
  orders,
  orderItems,
  payments,
  vendorSettlements,
  vendorPerformanceMetrics,
  users,
  orderStatusHistory,
  orderTrackingTimeline,
} from "../db/schema";
import { AppError } from "../lib/errors";
import { getVendorByUserId, recordOrderStatus } from "../lib/helpers";
import { assignRiderToOrder } from "./rider.service";
import { emitRiderAssigned, emitOrderStatus } from "../socket";

/** GET /profile */
export const getProfile = async (userId: number) => {
  const vendor = await getVendorByUserId(userId);
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  return { ...vendor, ownerName: user.name, ownerEmail: user.email, ownerPhone: user.phone };
};

/** PATCH /profile */
export const updateProfile = async (userId: number, body: Record<string, unknown>) => {
  const vendor = await getVendorByUserId(userId);
  const [updated] = await db
    .update(vendors)
    .set({
      name: body.name as string,
      description: body.description as string,
      phone: body.phone as string,
      email: body.email as string,
      gstNumber: body.gstNumber as string,
    })
    .where(eq(vendors.id, vendor.id))
    .returning();
  return updated;
};

/** GET /branches */
export const listBranches = async (userId: number) => {
  const vendor = await getVendorByUserId(userId);
  return db.select().from(vendorBranches).where(eq(vendorBranches.vendorId, vendor.id));
};

/** PATCH /branches/:id/status */
export const updateBranchStatus = async (userId: number, branchId: number, status: string) => {
  const vendor = await getVendorByUserId(userId);
  const [b] = await db
    .update(vendorBranches)
    .set({ status })
    .where(and(eq(vendorBranches.id, branchId), eq(vendorBranches.vendorId, vendor.id)))
    .returning();
  if (!b) throw new AppError(404, "Branch not found", "NOT_FOUND");
  return b;
};

/** GET /operating-hours */
export const getOperatingHours = async (userId: number) => {
  const vendor = await getVendorByUserId(userId);
  const branches = await db.select().from(vendorBranches).where(eq(vendorBranches.vendorId, vendor.id));
  const hours = [];
  for (const b of branches) {
    const h = await db.select().from(vendorOperatingHours).where(eq(vendorOperatingHours.branchId, b.id));
    hours.push({ branchId: b.id, hours: h });
  }
  return hours;
};

/** PUT /operating-hours */
export const setOperatingHours = async (userId: number, body: { branchId: number; hours: Array<{ dayOfWeek: number; openTime: string; closeTime: string }> }) => {
  const vendor = await getVendorByUserId(userId);
  const [branch] = await db
    .select()
    .from(vendorBranches)
    .where(and(eq(vendorBranches.id, body.branchId), eq(vendorBranches.vendorId, vendor.id)));
  if (!branch) throw new AppError(404, "Branch not found", "NOT_FOUND");
  await db.delete(vendorOperatingHours).where(eq(vendorOperatingHours.branchId, body.branchId));
  for (const h of body.hours) {
    await db.insert(vendorOperatingHours).values({ branchId: body.branchId, ...h });
  }
  return { message: "Operating hours updated" };
};

/** Category CRUD */
export const listCategories = async (userId: number) => {
  const vendor = await getVendorByUserId(userId);
  return db.select().from(categories).where(eq(categories.vendorId, vendor.id));
};

export const createCategory = async (userId: number, body: { name: string; description?: string }) => {
  const vendor = await getVendorByUserId(userId);
  const [c] = await db.insert(categories).values({ vendorId: vendor.id, name: body.name, description: body.description }).returning();
  return c;
};

export const updateCategory = async (userId: number, id: number, body: Record<string, unknown>) => {
  const vendor = await getVendorByUserId(userId);
  const [c] = await db.update(categories).set(body as any).where(and(eq(categories.id, id), eq(categories.vendorId, vendor.id))).returning();
  if (!c) throw new AppError(404, "Category not found", "NOT_FOUND");
  return c;
};

export const deleteCategory = async (userId: number, id: number) => {
  const vendor = await getVendorByUserId(userId);
  await db.update(categories).set({ status: "INACTIVE" }).where(and(eq(categories.id, id), eq(categories.vendorId, vendor.id)));
  return { message: "Category deleted" };
};

/** Menu CRUD */
export const listMenu = async (userId: number) => {
  const vendor = await getVendorByUserId(userId);
  return db.select().from(menuItems).where(eq(menuItems.vendorId, vendor.id));
};

export const createMenuItem = async (userId: number, body: Record<string, unknown>) => {
  const vendor = await getVendorByUserId(userId);
  const [item] = await db.insert(menuItems).values({
    vendorId: vendor.id,
    categoryId: body.categoryId as number,
    name: body.name as string,
    description: body.description as string,
    price: String(body.price),
    discountPrice: body.discountPrice ? String(body.discountPrice) : undefined,
    imageUrl: body.imageUrl as string,
    isVeg: Boolean(body.isVeg),
    stockQuantity: (body.stockQuantity as number) ?? -1,
    preparationTime: body.preparationTime as number,
  }).returning();
  return item;
};

export const updateMenuItem = async (userId: number, id: number, body: Record<string, unknown>) => {
  const vendor = await getVendorByUserId(userId);
  const [item] = await db.update(menuItems).set(body as any).where(and(eq(menuItems.id, id), eq(menuItems.vendorId, vendor.id))).returning();
  if (!item) throw new AppError(404, "Menu item not found", "NOT_FOUND");
  return item;
};

export const deleteMenuItem = async (userId: number, id: number) => {
  const vendor = await getVendorByUserId(userId);
  await db.update(menuItems).set({ status: "INACTIVE" }).where(and(eq(menuItems.id, id), eq(menuItems.vendorId, vendor.id)));
  return { message: "Menu item deleted" };
};

export const toggleMenuAvailability = async (userId: number, id: number, status: string) => {
  const vendor = await getVendorByUserId(userId);
  const [item] = await db.update(menuItems).set({ status }).where(and(eq(menuItems.id, id), eq(menuItems.vendorId, vendor.id))).returning();
  if (!item) throw new AppError(404, "Menu item not found", "NOT_FOUND");
  return item;
};

/** Orders */
export const listOrders = async (userId: number, status?: string) => {
  const vendor = await getVendorByUserId(userId);
  const cond = status
    ? and(eq(orders.vendorId, vendor.id), eq(orders.status, status))
    : eq(orders.vendorId, vendor.id);
  return db.select().from(orders).where(cond).orderBy(desc(orders.createdAt));
};

export const getOrder = async (userId: number, orderId: number) => {
  const vendor = await getVendorByUserId(userId);
  const [order] = await db.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.vendorId, vendor.id)));
  if (!order) throw new AppError(404, "Order not found", "ORDER_NOT_FOUND");
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  return { ...order, items };
};

const vendorOrderAction = async (userId: number, orderId: number, status: string, title: string) => {
  const order = await getOrder(userId, orderId);
  await recordOrderStatus(orderId, status, title, userId);
  return order;
};

export const acceptOrder = (userId: number, orderId: number) => vendorOrderAction(userId, orderId, "ACCEPTED", "Order Accepted");
export const rejectOrder = (userId: number, orderId: number) => vendorOrderAction(userId, orderId, "REJECTED", "Order Rejected");
export const markPreparing = (userId: number, orderId: number) => vendorOrderAction(userId, orderId, "PREPARING", "Preparing Food");
export const markReady = async (userId: number, orderId: number) => {
  // perform status update and rider assignment transactionally
  let assignmentResult: any = null;
  await db.transaction(async (tx) => {
    // update order status/history
    await tx.update(orders).set({ status: "READY", updatedAt: new Date() }).where(eq(orders.id, orderId));
    await tx.insert(orderStatusHistory).values({ orderId, status: "READY", changedBy: userId, remarks: "Food Ready" });
    await tx.insert(orderTrackingTimeline).values({ orderId, title: "Ready", description: "Order is ready for pickup" });

    // assign rider within transaction
    assignmentResult = await assignRiderToOrder(orderId, tx);
  });

  // emit events after transaction commit
  try {
    if (assignmentResult && assignmentResult.rider) {
      emitRiderAssigned(orderId, { riderId: assignmentResult.rider.id, riderName: assignmentResult.user?.name, riderPhone: assignmentResult.user?.phone });
    }
    emitOrderStatus(orderId, "READY", "Food Ready");
  } catch (err) {
    console.error("Failed to emit post-transaction events:", err);
  }

  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  return order;
};

/** Analytics */
export const analyticsSummary = async (userId: number) => {
  const vendor = await getVendorByUserId(userId);
  const allOrders = await db.select().from(orders).where(eq(orders.vendorId, vendor.id));
  const completed = allOrders.filter((o) => o.status === "DELIVERED");
  const revenue = completed.reduce((s, o) => s + Number(o.totalAmount), 0);
  return { totalOrders: allOrders.length, completedOrders: completed.length, revenue };
};

export const analyticsDaily = async (userId: number) => {
  const vendor = await getVendorByUserId(userId);
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  return db.select().from(orders).where(and(eq(orders.vendorId, vendor.id), gte(orders.createdAt, since))).orderBy(desc(orders.createdAt));
};

export const listTransactions = async (userId: number) => {
  const vendor = await getVendorByUserId(userId);
  const vendorOrders = await db.select({ id: orders.id }).from(orders).where(eq(orders.vendorId, vendor.id));
  const ids = vendorOrders.map((o) => o.id);
  if (!ids.length) return [];
  return db.select().from(payments).where(inArray(payments.orderId, ids));
};

export const listSettlements = async (userId: number) => {
  const vendor = await getVendorByUserId(userId);
  return db.select().from(vendorSettlements).where(eq(vendorSettlements.vendorId, vendor.id));
};

export const getPerformance = async (userId: number) => {
  const vendor = await getVendorByUserId(userId);
  const [metrics] = await db.select().from(vendorPerformanceMetrics).where(eq(vendorPerformanceMetrics.vendorId, vendor.id));
  return metrics || { acceptanceRate: "0", cancellationRate: "0", slaScore: "0" };
};
