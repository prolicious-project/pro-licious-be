import {
  bigint,
  bigserial,
  boolean,
  date,
  inet,
  integer,
  jsonb,
  numeric,
  pgTable,
  smallint,
  smallserial,
  text,
  time,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true });
const tsNow = (name: string) => ts(name).notNull().defaultNow();

export const roles = pgTable("roles", {
  id: smallserial("id").primaryKey(),
  roleName: varchar("role_name", { length: 30 }).notNull().unique(),
  description: text(),
});

export const users = pgTable("users", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  name: varchar({ length: 100 }).notNull(),
  phone: varchar({ length: 15 }).unique(),
  email: varchar({ length: 150 }).unique(),
  passwordHash: text("password_hash"),
  role: varchar({ length: 20 })
    .notNull()
    .references(() => roles.roleName),
  status: varchar({ length: 20 }).notNull().default("ACTIVE"),
  lastLogin: ts("last_login"),
  createdAt: tsNow("created_at"),
  updatedAt: tsNow("updated_at"),
});

export const otpVerifications = pgTable("otp_verifications", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  phone: varchar({ length: 15 }).notNull(),
  otpHash: text("otp_hash").notNull(),
  purpose: varchar({ length: 30 }).notNull(),
  expiresAt: ts("expires_at").notNull(),
  used: boolean().notNull().default(false),
  createdAt: tsNow("created_at"),
});

export const userSessions = pgTable("user_sessions", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  userId: bigint("user_id", { mode: "number" })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text().notNull().unique(),
  deviceInfo: jsonb("device_info"),
  ipAddress: inet("ip_address"),
  expiresAt: ts("expires_at").notNull(),
  createdAt: tsNow("created_at"),
});

export const zones = pgTable("zones", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  zoneName: varchar("zone_name", { length: 80 }).notNull(),
  city: varchar({ length: 60 }).notNull(),
  state: varchar({ length: 60 }).notNull(),
  status: varchar({ length: 20 }).notNull().default("ACTIVE"),
});

export const customerProfiles = pgTable("customer_profiles", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  userId: bigint("user_id", { mode: "number" })
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  profileImage: text("profile_image"),
  gender: varchar({ length: 10 }),
  dateOfBirth: date("date_of_birth"),
  createdAt: tsNow("created_at"),
});

export const customerAddresses = pgTable("customer_addresses", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  customerId: bigint("customer_id", { mode: "number" })
    .notNull()
    .references(() => customerProfiles.id, { onDelete: "cascade" }),
  addressType: varchar("address_type", { length: 20 }).notNull().default("HOME"),
  houseNumber: varchar("house_number", { length: 20 }),
  street: varchar({ length: 200 }),
  landmark: varchar({ length: 100 }),
  city: varchar({ length: 60 }).notNull(),
  state: varchar({ length: 60 }).notNull(),
  pincode: varchar({ length: 10 }).notNull(),
  latitude: numeric({ precision: 9, scale: 6 }),
  longitude: numeric({ precision: 9, scale: 6 }),
  isDefault: boolean("is_default").notNull().default(false),
  deletedAt: ts("deleted_at"),
});

export const vendors = pgTable("vendors", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  userId: bigint("user_id", { mode: "number" })
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  name: varchar({ length: 150 }).notNull(),
  description: text(),
  phone: varchar({ length: 15 }),
  email: varchar({ length: 150 }),
  gstNumber: varchar("gst_number", { length: 20 }),
  status: varchar({ length: 20 }).notNull().default("PENDING"),
  rating: numeric({ precision: 3, scale: 2 }).default("0.00"),
  createdAt: tsNow("created_at"),
});

export const customerFavorites = pgTable(
  "customer_favorites",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    customerId: bigint("customer_id", { mode: "number" })
      .notNull()
      .references(() => customerProfiles.id, { onDelete: "cascade" }),
    vendorId: bigint("vendor_id", { mode: "number" })
      .notNull()
      .references(() => vendors.id, { onDelete: "cascade" }),
    createdAt: tsNow("created_at"),
  },
  (t) => [unique().on(t.customerId, t.vendorId)],
);

export const vendorBranches = pgTable("vendor_branches", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  vendorId: bigint("vendor_id", { mode: "number" })
    .notNull()
    .references(() => vendors.id, { onDelete: "cascade" }),
  zoneId: bigint("zone_id", { mode: "number" }).references(() => zones.id),
  branchName: varchar("branch_name", { length: 100 }).notNull(),
  phone: varchar({ length: 15 }),
  address: text(),
  latitude: numeric({ precision: 9, scale: 6 }),
  longitude: numeric({ precision: 9, scale: 6 }),
  status: varchar({ length: 20 }).notNull().default("ACTIVE"),
});

export const vendorOperatingHours = pgTable(
  "vendor_operating_hours",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    branchId: bigint("branch_id", { mode: "number" })
      .notNull()
      .references(() => vendorBranches.id, { onDelete: "cascade" }),
    dayOfWeek: smallint("day_of_week").notNull(),
    openTime: time("open_time").notNull(),
    closeTime: time("close_time").notNull(),
  },
  (t) => [unique().on(t.branchId, t.dayOfWeek)],
);

export const vendorDocuments = pgTable("vendor_documents", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  vendorId: bigint("vendor_id", { mode: "number" })
    .notNull()
    .references(() => vendors.id, { onDelete: "cascade" }),
  documentType: varchar("document_type", { length: 50 }).notNull(),
  fileUrl: text("file_url").notNull(),
  verificationStatus: varchar("verification_status", { length: 20 })
    .notNull()
    .default("PENDING"),
  uploadedAt: tsNow("uploaded_at"),
});

export const vendorPerformanceMetrics = pgTable("vendor_performance_metrics", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  vendorId: bigint("vendor_id", { mode: "number" })
    .notNull()
    .unique()
    .references(() => vendors.id, { onDelete: "cascade" }),
  acceptanceRate: numeric("acceptance_rate", { precision: 5, scale: 2 }).default("0.00"),
  cancellationRate: numeric("cancellation_rate", { precision: 5, scale: 2 }).default("0.00"),
  averagePreparationTime: smallint("average_preparation_time").default(0),
  slaScore: numeric("sla_score", { precision: 5, scale: 2 }).default("0.00"),
  updatedAt: tsNow("updated_at"),
});

export const categories = pgTable("categories", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  vendorId: bigint("vendor_id", { mode: "number" })
    .notNull()
    .references(() => vendors.id, { onDelete: "cascade" }),
  name: varchar({ length: 80 }).notNull(),
  description: text(),
  sortOrder: smallint("sort_order").default(0),
  status: varchar({ length: 20 }).notNull().default("ACTIVE"),
});

export const menuItems = pgTable("menu_items", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  vendorId: bigint("vendor_id", { mode: "number" })
    .notNull()
    .references(() => vendors.id, { onDelete: "cascade" }),
  categoryId: bigint("category_id", { mode: "number" })
    .notNull()
    .references(() => categories.id),
  name: varchar({ length: 150 }).notNull(),
  description: text(),
  price: numeric({ precision: 10, scale: 2 }).notNull(),
  discountPrice: numeric("discount_price", { precision: 10, scale: 2 }),
  imageUrl: text("image_url"),
  isVeg: boolean("is_veg").notNull().default(false),
  status: varchar({ length: 20 }).notNull().default("ACTIVE"),
  stockQuantity: smallint("stock_quantity").notNull().default(-1),
  preparationTime: smallint("preparation_time"),
  createdAt: tsNow("created_at"),
  updatedAt: tsNow("updated_at"),
});

export const menuItemImages = pgTable("menu_item_images", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  menuItemId: bigint("menu_item_id", { mode: "number" })
    .notNull()
    .references(() => menuItems.id, { onDelete: "cascade" }),
  imageUrl: text("image_url").notNull(),
  sortOrder: smallint("sort_order").default(0),
});

export const menuItemCustomizations = pgTable("menu_item_customizations", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  menuItemId: bigint("menu_item_id", { mode: "number" })
    .notNull()
    .references(() => menuItems.id, { onDelete: "cascade" }),
  name: varchar({ length: 80 }).notNull(),
  price: numeric({ precision: 10, scale: 2 }).notNull().default("0.00"),
  groupName: varchar("group_name", { length: 60 }),
  isRequired: boolean("is_required").notNull().default(false),
  maxSelections: smallint("max_selections").notNull().default(1),
});

export const carts = pgTable(
  "carts",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    customerId: bigint("customer_id", { mode: "number" })
      .notNull()
      .references(() => customerProfiles.id, { onDelete: "cascade" }),
    vendorId: bigint("vendor_id", { mode: "number" })
      .notNull()
      .references(() => vendors.id, { onDelete: "cascade" }),
    status: varchar({ length: 20 }).notNull().default("ACTIVE"),
    createdAt: tsNow("created_at"),
    updatedAt: tsNow("updated_at"),
  },
  (t) => [unique().on(t.customerId, t.vendorId, t.status)],
);

export const cartItems = pgTable("cart_items", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  cartId: bigint("cart_id", { mode: "number" })
    .notNull()
    .references(() => carts.id, { onDelete: "cascade" }),
  menuItemId: bigint("menu_item_id", { mode: "number" })
    .notNull()
    .references(() => menuItems.id),
  quantity: smallint().notNull().default(1),
  price: numeric({ precision: 10, scale: 2 }).notNull(),
  customizations: jsonb(),
});

export const riders = pgTable("riders", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  userId: bigint("user_id", { mode: "number" })
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  vehicleType: varchar("vehicle_type", { length: 30 }),
  vehicleNumber: varchar("vehicle_number", { length: 20 }),
  licenseNumber: varchar("license_number", { length: 20 }),
  status: varchar({ length: 20 }).notNull().default("PENDING"),
});

export const orders = pgTable("orders", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  orderNumber: varchar("order_number", { length: 30 }).notNull().unique(),
  customerId: bigint("customer_id", { mode: "number" })
    .notNull()
    .references(() => customerProfiles.id),
  vendorId: bigint("vendor_id", { mode: "number" })
    .notNull()
    .references(() => vendors.id),
  branchId: bigint("branch_id", { mode: "number" }).references(() => vendorBranches.id),
  riderId: bigint("rider_id", { mode: "number" }).references(() => riders.id),
  addressId: bigint("address_id", { mode: "number" }).references(() => customerAddresses.id),
  subtotal: numeric({ precision: 10, scale: 2 }).notNull().default("0.00"),
  taxAmount: numeric("tax_amount", { precision: 10, scale: 2 }).notNull().default("0.00"),
  deliveryFee: numeric("delivery_fee", { precision: 10, scale: 2 }).notNull().default("0.00"),
  platformFee: numeric("platform_fee", { precision: 10, scale: 2 }).notNull().default("0.00"),
  discountAmount: numeric("discount_amount", { precision: 10, scale: 2 }).notNull().default("0.00"),
  totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).notNull().default("0.00"),
  status: varchar({ length: 30 }).notNull().default("PLACED"),
  paymentMethod: varchar("payment_method", { length: 30 }),
  createdAt: tsNow("created_at"),
  updatedAt: tsNow("updated_at"),
});

export const orderItems = pgTable("order_items", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  orderId: bigint("order_id", { mode: "number" })
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  menuItemId: bigint("menu_item_id", { mode: "number" }).references(() => menuItems.id, {
    onDelete: "set null",
  }),
  itemName: varchar("item_name", { length: 150 }).notNull(),
  price: numeric({ precision: 10, scale: 2 }).notNull(),
  quantity: smallint().notNull().default(1),
  total: numeric({ precision: 10, scale: 2 }).notNull(),
  customizations: jsonb(),
});

export const orderStatusHistory = pgTable("order_status_history", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  orderId: bigint("order_id", { mode: "number" })
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  status: varchar({ length: 30 }).notNull(),
  remarks: text(),
  changedBy: bigint("changed_by", { mode: "number" }).references(() => users.id),
  createdAt: tsNow("created_at"),
});

export const orderTrackingTimeline = pgTable("order_tracking_timeline", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  orderId: bigint("order_id", { mode: "number" })
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  title: varchar({ length: 80 }).notNull(),
  description: text(),
  createdAt: tsNow("created_at"),
});

export const riderDocuments = pgTable("rider_documents", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  riderId: bigint("rider_id", { mode: "number" })
    .notNull()
    .references(() => riders.id, { onDelete: "cascade" }),
  documentType: varchar("document_type", { length: 50 }).notNull(),
  fileUrl: text("file_url").notNull(),
  verificationStatus: varchar("verification_status", { length: 20 })
    .notNull()
    .default("PENDING"),
});

export const riderEarnings = pgTable("rider_earnings", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  riderId: bigint("rider_id", { mode: "number" })
    .notNull()
    .references(() => riders.id, { onDelete: "cascade" }),
  orderId: bigint("order_id", { mode: "number" })
    .notNull()
    .references(() => orders.id),
  earningAmount: numeric("earning_amount", { precision: 10, scale: 2 }).notNull(),
  createdAt: tsNow("created_at"),
});

export const riderAssignments = pgTable("rider_assignments", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  orderId: bigint("order_id", { mode: "number" })
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  riderId: bigint("rider_id", { mode: "number" })
    .notNull()
    .references(() => riders.id),
  status: varchar({ length: 20 }).notNull().default("PENDING"),
  assignedAt: tsNow("assigned_at"),
  acceptedAt: ts("accepted_at"),
  completedAt: ts("completed_at"),
});

export const deliveryTrackingEvents = pgTable("delivery_tracking_events", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  orderId: bigint("order_id", { mode: "number" })
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  riderId: bigint("rider_id", { mode: "number" })
    .notNull()
    .references(() => riders.id),
  eventType: varchar("event_type", { length: 30 }).notNull(),
  latitude: numeric({ precision: 9, scale: 6 }),
  longitude: numeric({ precision: 9, scale: 6 }),
  eventTime: tsNow("event_time"),
});

export const riderAvailability = pgTable("rider_availability", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  riderId: bigint("rider_id", { mode: "number" })
    .notNull()
    .unique()
    .references(() => riders.id, { onDelete: "cascade" }),
  isOnline: boolean("is_online").notNull().default(false),
  activeOrders: smallint("active_orders").notNull().default(0),
  lastSeen: ts("last_seen"),
});

export const riderShiftLogs = pgTable("rider_shift_logs", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  riderId: bigint("rider_id", { mode: "number" })
    .notNull()
    .references(() => riders.id, { onDelete: "cascade" }),
  loginTime: ts("login_time").notNull(),
  logoutTime: ts("logout_time"),
  earnings: numeric({ precision: 10, scale: 2 }).default("0.00"),
});

export const etaHistory = pgTable("eta_history", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  orderId: bigint("order_id", { mode: "number" })
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  estimatedTime: smallint("estimated_time").notNull(),
  actualTime: smallint("actual_time"),
  createdAt: tsNow("created_at"),
});

export const payments = pgTable("payments", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  orderId: bigint("order_id", { mode: "number" })
    .notNull()
    .references(() => orders.id),
  gateway: varchar({ length: 40 }).notNull().default("RAZORPAY"),
  paymentReference: varchar("payment_reference", { length: 100 }).unique(),
  amount: numeric({ precision: 10, scale: 2 }).notNull(),
  status: varchar({ length: 20 }).notNull().default("PENDING"),
  paymentMode: varchar("payment_mode", { length: 30 }),
  createdAt: tsNow("created_at"),
});

export const refunds = pgTable("refunds", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  paymentId: bigint("payment_id", { mode: "number" })
    .notNull()
    .references(() => payments.id),
  amount: numeric({ precision: 10, scale: 2 }).notNull(),
  reason: text(),
  status: varchar({ length: 20 }).notNull().default("PENDING"),
  createdAt: tsNow("created_at"),
});

export const vendorSettlements = pgTable("vendor_settlements", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  vendorId: bigint("vendor_id", { mode: "number" })
    .notNull()
    .references(() => vendors.id),
  settlementAmount: numeric("settlement_amount", { precision: 10, scale: 2 }).notNull(),
  settlementDate: date("settlement_date").notNull(),
  status: varchar({ length: 20 }).notNull().default("PENDING"),
});

export const payoutTransactions = pgTable("payout_transactions", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  vendorId: bigint("vendor_id", { mode: "number" })
    .notNull()
    .references(() => vendors.id),
  settlementId: bigint("settlement_id", { mode: "number" })
    .notNull()
    .references(() => vendorSettlements.id),
  bankReference: varchar("bank_reference", { length: 100 }),
  amount: numeric({ precision: 10, scale: 2 }).notNull(),
  status: varchar({ length: 20 }).notNull().default("PENDING"),
  createdAt: tsNow("created_at"),
});

export const complaints = pgTable("complaints", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  orderId: bigint("order_id", { mode: "number" }).references(() => orders.id),
  customerId: bigint("customer_id", { mode: "number" })
    .notNull()
    .references(() => customerProfiles.id),
  category: varchar({ length: 60 }).notNull(),
  description: text().notNull(),
  status: varchar({ length: 20 }).notNull().default("OPEN"),
  createdAt: tsNow("created_at"),
});

export const complaintResponses = pgTable("complaint_responses", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  complaintId: bigint("complaint_id", { mode: "number" })
    .notNull()
    .references(() => complaints.id, { onDelete: "cascade" }),
  adminId: bigint("admin_id", { mode: "number" })
    .notNull()
    .references(() => users.id),
  response: text().notNull(),
  createdAt: tsNow("created_at"),
});

export const supportTickets = pgTable("support_tickets", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  customerId: bigint("customer_id", { mode: "number" })
    .notNull()
    .references(() => customerProfiles.id),
  subject: varchar({ length: 200 }).notNull(),
  status: varchar({ length: 20 }).notNull().default("OPEN"),
  priority: varchar({ length: 20 }).notNull().default("MEDIUM"),
  createdAt: tsNow("created_at"),
});

export const notifications = pgTable("notifications", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  userId: bigint("user_id", { mode: "number" })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: varchar({ length: 150 }).notNull(),
  message: text().notNull(),
  type: varchar({ length: 30 }).notNull(),
  isRead: boolean("is_read").notNull().default(false),
  actionUrl: varchar("action_url", { length: 255 }),
  entityId: bigint("entity_id", { mode: "number" }),
  createdAt: tsNow("created_at"),
});

export const notificationLogs = pgTable("notification_logs", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  notificationId: bigint("notification_id", { mode: "number" })
    .notNull()
    .references(() => notifications.id, { onDelete: "cascade" }),
  channel: varchar({ length: 20 }).notNull(),
  status: varchar({ length: 20 }).notNull().default("PENDING"),
  createdAt: tsNow("created_at"),
});

export const adminActions = pgTable("admin_actions", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  adminId: bigint("admin_id", { mode: "number" })
    .notNull()
    .references(() => users.id),
  actionType: varchar("action_type", { length: 60 }).notNull(),
  entityType: varchar("entity_type", { length: 40 }).notNull(),
  entityId: bigint("entity_id", { mode: "number" }).notNull(),
  notes: text(),
  createdAt: tsNow("created_at"),
});

export const incidents = pgTable("incidents", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  title: varchar({ length: 200 }).notNull(),
  description: text(),
  severity: varchar({ length: 20 }).notNull().default("LOW"),
  status: varchar({ length: 20 }).notNull().default("OPEN"),
  createdAt: tsNow("created_at"),
});

export const fraudFlags = pgTable("fraud_flags", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  entityType: varchar("entity_type", { length: 40 }).notNull(),
  entityId: bigint("entity_id", { mode: "number" }).notNull(),
  reason: text().notNull(),
  severity: varchar({ length: 20 }).notNull().default("LOW"),
  status: varchar({ length: 20 }).notNull().default("OPEN"),
  createdAt: tsNow("created_at"),
});

export const dailyMetrics = pgTable("daily_metrics", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  metricDate: date("metric_date").notNull().unique(),
  totalOrders: integer("total_orders").notNull().default(0),
  completedOrders: integer("completed_orders").notNull().default(0),
  cancelledOrders: integer("cancelled_orders").notNull().default(0),
  revenue: numeric({ precision: 14, scale: 2 }).notNull().default("0.00"),
  activeCustomers: integer("active_customers").notNull().default(0),
  activeVendors: integer("active_vendors").notNull().default(0),
  activeRiders: integer("active_riders").notNull().default(0),
});

export const demandSupplyMetrics = pgTable("demand_supply_metrics", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  zoneId: bigint("zone_id", { mode: "number" })
    .notNull()
    .references(() => zones.id),
  activeOrders: integer("active_orders").notNull().default(0),
  availableRiders: smallint("available_riders").notNull().default(0),
  surgeFactor: numeric("surge_factor", { precision: 4, scale: 2 }).notNull().default("1.00"),
  createdAt: tsNow("created_at"),
});

export const riderSettlements = pgTable("rider_settlements", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  riderId: bigint("rider_id", { mode: "number" })
    .notNull()
    .references(() => riders.id, { onDelete: "cascade" }),
  settlementAmount: numeric("settlement_amount", { precision: 10, scale: 2 }).notNull(),
  settlementDate: date("settlement_date").notNull(),
  status: varchar({ length: 20 }).notNull().default("PENDING"),
  createdAt: tsNow("created_at"),
});

export const riderPayoutTransactions = pgTable("rider_payout_transactions", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  riderId: bigint("rider_id", { mode: "number" })
    .notNull()
    .references(() => riders.id, { onDelete: "cascade" }),
  settlementId: bigint("settlement_id", { mode: "number" })
    .notNull()
    .references(() => riderSettlements.id),
  bankReference: varchar("bank_reference", { length: 100 }),
  amount: numeric({ precision: 10, scale: 2 }).notNull(),
  status: varchar({ length: 20 }).notNull().default("PENDING"),
  createdAt: tsNow("created_at"),
});
