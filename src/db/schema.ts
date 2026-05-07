import {
    pgTable,
    serial,
    text,
    integer,
    timestamp,
    boolean,
    decimal,
    pgEnum,
} from "drizzle-orm/pg-core";

/* =========================
   ENUMS
========================= */

export const userRoleEnum = pgEnum("user_role", [
    "USER",
    "VENDOR",
    "DELIVERY",
    "ADMIN",
]);

export const orderStatusEnum = pgEnum("order_status", [
    "PENDING",
    "ACCEPTED",
    "PREPARING",
    "READY",
    "PICKED",
    "DELIVERED",
    "CANCELLED",
]);

export const paymentMethodEnum = pgEnum("payment_method", [
    "ONLINE",
    "COD",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
    "PENDING",
    "PAID",
    "FAILED",
]);

/* =========================
   USERS
========================= */

export const users = pgTable("users", {
    id: serial("id").primaryKey(),

    name: text("name").notNull(),

    email: text("email").notNull().unique(),

    phone: text("phone").notNull(),

    password: text("password").notNull(),

    role: userRoleEnum("role").default("USER"),

    createdAt: timestamp("created_at").defaultNow(),
});

/* =========================
   ADDRESSES
========================= */

export const addresses = pgTable("addresses", {
    id: serial("id").primaryKey(),

    userId: integer("user_id")
        .references(() => users.id)
        .notNull(),

    addressLine: text("address_line").notNull(),

    city: text("city").notNull(),

    state: text("state").notNull(),

    pincode: text("pincode").notNull(),

    latitude: decimal("latitude"),

    longitude: decimal("longitude"),
});

/* =========================
   VENDORS
========================= */

export const vendors = pgTable("vendors", {
    id: serial("id").primaryKey(),

    userId: integer("user_id")
        .references(() => users.id)
        .notNull(),

    shopName: text("shop_name").notNull(),

    description: text("description"),

    image: text("image"),

    isOpen: boolean("is_open").default(true),

    rating: decimal("rating").default("0"),

    createdAt: timestamp("created_at").defaultNow(),
});

/* =========================
   PRODUCTS
========================= */

export const products = pgTable("products", {
    id: serial("id").primaryKey(),

    vendorId: integer("vendor_id")
        .references(() => vendors.id)
        .notNull(),

    name: text("name").notNull(),

    description: text("description"),

    image: text("image"),

    price: decimal("price").notNull(),

    isAvailable: boolean("is_available").default(true),

    createdAt: timestamp("created_at").defaultNow(),
});

/* =========================
   CART
========================= */

export const cartItems = pgTable("cart_items", {
    id: serial("id").primaryKey(),

    userId: integer("user_id")
        .references(() => users.id)
        .notNull(),

    productId: integer("product_id")
        .references(() => products.id)
        .notNull(),

    quantity: integer("quantity").default(1),
});

/* =========================
   ORDERS
========================= */

export const orders = pgTable("orders", {
    id: serial("id").primaryKey(),

    userId: integer("user_id")
        .references(() => users.id)
        .notNull(),

    vendorId: integer("vendor_id")
        .references(() => vendors.id)
        .notNull(),

    deliveryPartnerId: integer("delivery_partner_id")
        .references(() => users.id),

    addressId: integer("address_id")
        .references(() => addresses.id)
        .notNull(),

    totalAmount: decimal("total_amount").notNull(),

    deliveryFee: decimal("delivery_fee").default("0"),

    platformFee: decimal("platform_fee").default("0"),

    status: orderStatusEnum("status").default("PENDING"),

    paymentMethod: paymentMethodEnum("payment_method").notNull(),

    paymentStatus: paymentStatusEnum("payment_status").default(
        "PENDING"
    ),

    otp: text("otp"),

    createdAt: timestamp("created_at").defaultNow(),
});

/* =========================
   ORDER ITEMS
========================= */

export const orderItems = pgTable("order_items", {
    id: serial("id").primaryKey(),

    orderId: integer("order_id")
        .references(() => orders.id)
        .notNull(),

    productId: integer("product_id")
        .references(() => products.id)
        .notNull(),

    quantity: integer("quantity").default(1),

    price: decimal("price").notNull(),
});

/* =========================
   PAYMENTS
========================= */

export const payments = pgTable("payments", {
    id: serial("id").primaryKey(),

    orderId: integer("order_id")
        .references(() => orders.id)
        .notNull(),

    transactionId: text("transaction_id"),

    amount: decimal("amount").notNull(),

    method: paymentMethodEnum("method").notNull(),

    status: paymentStatusEnum("status").default("PENDING"),

    createdAt: timestamp("created_at").defaultNow(),
});

/* =========================
   VENDOR WALLET
========================= */

export const vendorWallets = pgTable("vendor_wallets", {
    id: serial("id").primaryKey(),

    vendorId: integer("vendor_id")
        .references(() => vendors.id)
        .notNull(),

    balance: decimal("balance").default("0"),
});

/* =========================
   WITHDRAWALS
========================= */

export const withdrawals = pgTable("withdrawals", {
    id: serial("id").primaryKey(),

    vendorId: integer("vendor_id")
        .references(() => vendors.id)
        .notNull(),

    amount: decimal("amount").notNull(),

    status: text("status").default("PENDING"),

    createdAt: timestamp("created_at").defaultNow(),
});