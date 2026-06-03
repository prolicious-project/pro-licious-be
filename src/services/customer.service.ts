import { eq, and, desc, isNull, or, ilike } from "drizzle-orm";
import { db } from "../db";
import {
  customerProfiles,
  customerAddresses,
  customerFavorites,
  vendors,
  categories,
  menuItems,
  carts,
  cartItems,
  orders,
  orderItems,
  orderTrackingTimeline,
  payments,
  complaints,
  supportTickets,
  notifications,
  users,
} from "../db/schema";
import { AppError } from "../lib/errors";
import { getCustomerByUserId, generateOrderNumber, recordOrderStatus } from "../lib/helpers";
import { createRazorpayOrder, verifyRazorpaySignature } from "../config/razorpay";
import { env } from "../config/env";

const customer = (userId: number) => getCustomerByUserId(userId);

export const getProfile = async (userId: number) => {
  const c = await customer(userId);
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  return { ...c, name: user.name, phone: user.phone, email: user.email };
};

export const updateProfile = async (userId: number, data: Record<string, unknown>) => {
  const c = await customer(userId);
  if (data.name) await db.update(users).set({ name: String(data.name) }).where(eq(users.id, userId));
  const [updated] = await db
    .update(customerProfiles)
    .set({ profileImage: data.profileImage as string, gender: data.gender as string })
    .where(eq(customerProfiles.id, c.id))
    .returning();
  return updated;
};

export const listAddresses = async (userId: number) => {
  const c = await customer(userId);
  return db
    .select()
    .from(customerAddresses)
    .where(and(eq(customerAddresses.customerId, c.id), isNull(customerAddresses.deletedAt)));
};

export const addAddress = async (userId: number, body: Record<string, unknown>) => {
  const c = await customer(userId);
  const [addr] = await db
    .insert(customerAddresses)
    .values({
      customerId: c.id,
      addressType: (body.addressType as string) || "HOME",
      houseNumber: body.houseNumber as string,
      street: body.street as string,
      landmark: body.landmark as string,
      city: body.city as string,
      state: body.state as string,
      pincode: body.pincode as string,
      latitude: body.latitude as string,
      longitude: body.longitude as string,
      isDefault: Boolean(body.isDefault),
    })
    .returning();
  return addr;
};

export const updateAddress = async (userId: number, id: number, body: Record<string, unknown>) => {
  const c = await customer(userId);
  const [addr] = await db
    .update(customerAddresses)
    .set(body as Partial<typeof customerAddresses.$inferInsert>)
    .where(and(eq(customerAddresses.id, id), eq(customerAddresses.customerId, c.id)))
    .returning();
  if (!addr) throw new AppError(404, "Address not found", "NOT_FOUND");
  return addr;
};

export const deleteAddress = async (userId: number, id: number) => {
  const c = await customer(userId);
  await db
    .update(customerAddresses)
    .set({ deletedAt: new Date() })
    .where(and(eq(customerAddresses.id, id), eq(customerAddresses.customerId, c.id)));
  return { message: "Address deleted" };
};

export const listVendors = async (_zoneId?: number) =>
  db.select().from(vendors).where(eq(vendors.status, "ACTIVE"));

export const getVendor = async (id: number) => {
  const [v] = await db.select().from(vendors).where(eq(vendors.id, id));
  if (!v) throw new AppError(404, "Vendor not found", "VENDOR_NOT_FOUND");
  return v;
};

export const getVendorMenu = async (vendorId: number) => {
  const cats = await db
    .select()
    .from(categories)
    .where(and(eq(categories.vendorId, vendorId), eq(categories.status, "ACTIVE")));
  const items = await db
    .select()
    .from(menuItems)
    .where(and(eq(menuItems.vendorId, vendorId), eq(menuItems.status, "ACTIVE")));
  return { categories: cats, items };
};

export const search = async (query: string) => {
  const pattern = `%${query}%`;
  const vendorResults = await db
    .select()
    .from(vendors)
    .where(and(eq(vendors.status, "ACTIVE"), or(ilike(vendors.name, pattern), ilike(vendors.description, pattern))));
  const itemResults = await db
    .select()
    .from(menuItems)
    .where(and(eq(menuItems.status, "ACTIVE"), or(ilike(menuItems.name, pattern), ilike(menuItems.description, pattern))));
  return { vendors: vendorResults, items: itemResults };
};

export const listCategories = async () =>
  db.select().from(categories).where(eq(categories.status, "ACTIVE"));

const getActiveCart = async (customerId: number, vendorId: number) => {
  let [cart] = await db
    .select()
    .from(carts)
    .where(and(eq(carts.customerId, customerId), eq(carts.vendorId, vendorId), eq(carts.status, "ACTIVE")));
  if (!cart) {
    [cart] = await db.insert(carts).values({ customerId, vendorId, status: "ACTIVE" }).returning();
  }
  return cart;
};

export const getCart = async (userId: number) => {
  const c = await customer(userId);
  const activeCarts = await db
    .select()
    .from(carts)
    .where(and(eq(carts.customerId, c.id), eq(carts.status, "ACTIVE")));
  const result = [];
  for (const cart of activeCarts) {
    const items = await db.select().from(cartItems).where(eq(cartItems.cartId, cart.id));
    result.push({ ...cart, items });
  }
  return result;
};

export const addCartItem = async (
  userId: number,
  body: { vendorId: number; menuItemId: number; quantity?: number; customizations?: unknown },
) => {
  const c = await customer(userId);
  const [item] = await db.select().from(menuItems).where(eq(menuItems.id, body.menuItemId));
  if (!item) throw new AppError(404, "Menu item not found", "NOT_FOUND");
  const cart = await getActiveCart(c.id, body.vendorId);
  const [ci] = await db
    .insert(cartItems)
    .values({
      cartId: cart.id,
      menuItemId: body.menuItemId,
      quantity: body.quantity || 1,
      price: item.price,
      customizations: body.customizations,
    })
    .returning();
  return ci;
};

export const updateCartItem = async (userId: number, itemId: number, quantity: number) => {
  const c = await customer(userId);
  const [ci] = await db.select().from(cartItems).where(eq(cartItems.id, itemId));
  if (!ci) throw new AppError(404, "Cart item not found", "NOT_FOUND");
  const [cart] = await db
    .select()
    .from(carts)
    .where(and(eq(carts.id, ci.cartId), eq(carts.customerId, c.id)));
  if (!cart) throw new AppError(403, "Not your cart", "PERMISSION_DENIED");
  const [updated] = await db.update(cartItems).set({ quantity }).where(eq(cartItems.id, itemId)).returning();
  return updated;
};

export const removeCartItem = async (userId: number, itemId: number) => {
  await db.delete(cartItems).where(eq(cartItems.id, itemId));
  return { message: "Item removed" };
};

export const clearCart = async (userId: number, vendorId?: number) => {
  const c = await customer(userId);
  const cond = vendorId
    ? and(eq(carts.customerId, c.id), eq(carts.status, "ACTIVE"), eq(carts.vendorId, vendorId))
    : and(eq(carts.customerId, c.id), eq(carts.status, "ACTIVE"));
  const active = await db.select().from(carts).where(cond);
  for (const cart of active) {
    await db.delete(cartItems).where(eq(cartItems.cartId, cart.id));
    await db.update(carts).set({ status: "ABANDONED" }).where(eq(carts.id, cart.id));
  }
  return { message: "Cart cleared" };
};

export const placeOrder = async (
  userId: number,
  body: { vendorId: number; addressId: number; paymentMethod?: string },
) => {
  const c = await customer(userId);
  const cart = await getActiveCart(c.id, body.vendorId);
  const items = await db.select().from(cartItems).where(eq(cartItems.cartId, cart.id));
  if (!items.length) throw new AppError(400, "Cart is empty", "MISSING_FIELDS");

  let subtotal = 0;
  for (const i of items) subtotal += Number(i.price) * i.quantity;
  const taxAmount = subtotal * 0.05;
  const deliveryFee = 40;
  const platformFee = 10;
  const totalAmount = subtotal + taxAmount + deliveryFee + platformFee;

  let [order] = await db
    .insert(orders)
    .values({
      orderNumber: "TEMP",
      customerId: c.id,
      vendorId: body.vendorId,
      addressId: body.addressId,
      subtotal: String(subtotal),
      taxAmount: String(taxAmount),
      deliveryFee: String(deliveryFee),
      platformFee: String(platformFee),
      totalAmount: String(totalAmount),
      status: "PLACED",
      paymentMethod: body.paymentMethod || "UPI",
    })
    .returning();

  const orderNumber = generateOrderNumber(order.id);
  [order] = await db.update(orders).set({ orderNumber }).where(eq(orders.id, order.id)).returning();

  for (const i of items) {
    const [mi] = await db.select().from(menuItems).where(eq(menuItems.id, i.menuItemId));
    await db.insert(orderItems).values({
      orderId: order.id,
      menuItemId: i.menuItemId,
      itemName: mi?.name || "Item",
      price: i.price,
      quantity: i.quantity,
      total: String(Number(i.price) * i.quantity),
      customizations: i.customizations,
    });
  }

  await recordOrderStatus(order.id, "PLACED", "Order Placed", userId);
  await db.update(carts).set({ status: "CONVERTED" }).where(eq(carts.id, cart.id));
  return order;
};

export const listOrders = async (userId: number) => {
  const c = await customer(userId);
  return db.select().from(orders).where(eq(orders.customerId, c.id)).orderBy(desc(orders.createdAt));
};

export const getOrder = async (userId: number, orderId: number) => {
  const c = await customer(userId);
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.customerId, c.id)));
  if (!order) throw new AppError(404, "Order not found", "ORDER_NOT_FOUND");
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  return { ...order, items };
};

export const getOrderTracking = async (userId: number, orderId: number) => {
  await getOrder(userId, orderId);
  return db
    .select()
    .from(orderTrackingTimeline)
    .where(eq(orderTrackingTimeline.orderId, orderId))
    .orderBy(desc(orderTrackingTimeline.createdAt));
};

export const cancelOrder = async (userId: number, orderId: number) => {
  const order = await getOrder(userId, orderId);
  if (["DELIVERED", "CANCELLED"].includes(order.status))
    throw new AppError(400, "Cannot cancel", "BAD_REQUEST");
  await recordOrderStatus(orderId, "CANCELLED", "Order Cancelled", userId);
  return { message: "Order cancelled" };
};

export const initiatePayment = async (userId: number, orderId: number) => {
  const order = await getOrder(userId, orderId);
  const rzOrder = await createRazorpayOrder(Number(order.totalAmount), order.orderNumber);
  const [payment] = await db
    .insert(payments)
    .values({ orderId, amount: order.totalAmount, paymentReference: rzOrder.id, status: "PENDING" })
    .returning();
  return { paymentId: payment.id, razorpayOrderId: rzOrder.id, amount: order.totalAmount, key: env.RAZORPAY_KEY_ID };
};

export const verifyPayment = async (
  userId: number,
  body: { orderId: number; razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string },
) => {
  await getOrder(userId, body.orderId);
  if (!verifyRazorpaySignature(body.razorpayOrderId, body.razorpayPaymentId, body.razorpaySignature)) {
    throw new AppError(400, "Invalid payment signature", "BAD_REQUEST");
  }
  await db
    .update(payments)
    .set({ status: "SUCCESS", paymentReference: body.razorpayPaymentId })
    .where(eq(payments.orderId, body.orderId));
  await recordOrderStatus(body.orderId, "PAID", "Payment Successful", userId);
  return { message: "Payment verified" };
};

export const createComplaint = async (
  userId: number,
  body: { orderId?: number; category: string; description: string },
) => {
  const c = await customer(userId);
  const [row] = await db
    .insert(complaints)
    .values({ customerId: c.id, orderId: body.orderId, category: body.category, description: body.description })
    .returning();
  return row;
};

export const listComplaints = async (userId: number) => {
  const c = await customer(userId);
  return db.select().from(complaints).where(eq(complaints.customerId, c.id)).orderBy(desc(complaints.createdAt));
};

export const createTicket = async (userId: number, body: { subject: string; priority?: string }) => {
  const c = await customer(userId);
  const [row] = await db
    .insert(supportTickets)
    .values({ customerId: c.id, subject: body.subject, priority: body.priority || "MEDIUM" })
    .returning();
  return row;
};

export const listNotifications = async (userId: number) =>
  db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt));

export const markNotificationRead = async (userId: number, id: number) => {
  await db
    .update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
  return { message: "Marked read" };
};

export const addFavorite = async (userId: number, vendorId: number) => {
  const c = await customer(userId);
  const [row] = await db.insert(customerFavorites).values({ customerId: c.id, vendorId }).returning();
  return row;
};

export const removeFavorite = async (userId: number, vendorId: number) => {
  const c = await customer(userId);
  await db
    .delete(customerFavorites)
    .where(and(eq(customerFavorites.customerId, c.id), eq(customerFavorites.vendorId, vendorId)));
  return { message: "Removed from favorites" };
};
