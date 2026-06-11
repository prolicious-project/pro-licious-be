import { eq } from "drizzle-orm"; 
import { db } from "../db";
import {
  users,
  customerProfiles,
  vendors,
  riders,
  orderStatusHistory,
  orderTrackingTimeline,
  orders,
} from "../db/schema";
import { AppError } from "./errors";
import { emitOrderStatus } from "../socket";

/** Fetch user row or 404 */
export const getUserById = async (id: number) => {
  const [user] = await db.select().from(users).where(eq(users.id, id));
  if (!user) throw new AppError(404, "User not found", "USER_NOT_FOUND");
  return user;
};

/** Customer profile for logged-in user */
export const getCustomerByUserId = async (userId: number) => {
  const [profile] = await db
    .select()
    .from(customerProfiles)
    .where(eq(customerProfiles.userId, userId));
  if (!profile) throw new AppError(404, "Customer profile not found", "USER_NOT_FOUND");
  return profile;
};

/** Vendor row for logged-in user */
export const getVendorByUserId = async (userId: number) => {
  const [vendor] = await db.select().from(vendors).where(eq(vendors.userId, userId));
  if (!vendor) throw new AppError(404, "Vendor not found", "VENDOR_NOT_FOUND");
  return vendor;
};

/** Rider row for logged-in user */
export const getRiderByUserId = async (userId: number) => {
  const [rider] = await db.select().from(riders).where(eq(riders.userId, userId));
  if (!rider) throw new AppError(404, "Rider not found", "RIDER_NOT_FOUND");
  return rider;
};

/** Generate unique order number PRO-YYYYMMDD-XXXX */
export const generateOrderNumber = (orderId: number) => {
  const d = new Date();
  const date = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `PRO-${date}-${String(orderId).padStart(4, "0")}`;
};

/** Record order status change in history + timeline */
export const recordOrderStatus = async (
  orderId: number,
  status: string,
  title: string,
  changedBy?: number,
  remarks?: string,
) => {
  await db.update(orders).set({ status, updatedAt: new Date() }).where(eq(orders.id, orderId));
  await db.insert(orderStatusHistory).values({ orderId, status, changedBy, remarks });
  await db.insert(orderTrackingTimeline).values({ orderId, title, description: remarks });
  try {
    emitOrderStatus(orderId, status, title);
  } catch (err) {
    // Non-fatal: emitting should not break business flow
    console.error("Failed to emit order status via socket:", err);
  }
};
