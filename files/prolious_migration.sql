-- =============================================================
-- PROLIOUS FOOD DELIVERY PLATFORM
-- Complete PostgreSQL Migration — v2.0 (Post-Audit)
-- 46 tables (45 original + otp_verifications)
-- All audit fixes applied
-- =============================================================

-- Run order matters — parent tables before child tables.
-- Safe to re-run: all CREATE TABLE uses IF NOT EXISTS.

-- =============================================================
-- EXTENSIONS
-- =============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid(), crypt()
CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- trigram indexes for search


-- =============================================================
-- 1. AUTH & USERS
-- =============================================================

CREATE TABLE IF NOT EXISTS roles (
  id          SMALLSERIAL   PRIMARY KEY,
  role_name   VARCHAR(30)   NOT NULL UNIQUE,  -- CUSTOMER, VENDOR, RIDER, SUPER_ADMIN
  description TEXT
);

INSERT INTO roles (role_name, description) VALUES
  ('CUSTOMER',    'End customer placing orders'),
  ('VENDOR',      'Restaurant / meat shop owner'),
  ('RIDER',       'Delivery partner'),
  ('SUPER_ADMIN', 'Platform administrator')
ON CONFLICT (role_name) DO NOTHING;


CREATE TABLE IF NOT EXISTS users (
  id            BIGSERIAL       PRIMARY KEY,
  name          VARCHAR(100)    NOT NULL,
  phone         VARCHAR(15)     UNIQUE,
  email         VARCHAR(150)    UNIQUE,
  password_hash TEXT,
  role          VARCHAR(20)     NOT NULL REFERENCES roles(role_name),
  status        VARCHAR(20)     NOT NULL DEFAULT 'ACTIVE',  -- ACTIVE, SUSPENDED, DELETED
  last_login    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_users_contact CHECK (phone IS NOT NULL OR email IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_users_phone  ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_email  ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role   ON users(role);


-- AUDIT FIX: otp_verifications — new table (was Redis-only, no DB fallback)
CREATE TABLE IF NOT EXISTS otp_verifications (
  id          BIGSERIAL     PRIMARY KEY,
  phone       VARCHAR(15)   NOT NULL,
  otp_hash    TEXT          NOT NULL,           -- store bcrypt hash, never plain OTP
  purpose     VARCHAR(30)   NOT NULL,           -- LOGIN, DELIVERY_CONFIRM
  expires_at  TIMESTAMPTZ   NOT NULL,
  used        BOOLEAN       NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otp_phone_purpose ON otp_verifications(phone, purpose);


CREATE TABLE IF NOT EXISTS user_sessions (
  id          BIGSERIAL     PRIMARY KEY,
  user_id     BIGINT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       TEXT          NOT NULL UNIQUE,
  device_info JSONB,                            -- { os, app_version, device_id }
  ip_address  INET,
  expires_at  TIMESTAMPTZ   NOT NULL,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token   ON user_sessions(token);


-- =============================================================
-- 2. ZONES (needed early — vendor_branches references it)
-- =============================================================

CREATE TABLE IF NOT EXISTS zones (
  id          BIGSERIAL     PRIMARY KEY,
  zone_name   VARCHAR(80)   NOT NULL,
  city        VARCHAR(60)   NOT NULL,
  state       VARCHAR(60)   NOT NULL,
  status      VARCHAR(20)   NOT NULL DEFAULT 'ACTIVE'
);


-- =============================================================
-- 3. CUSTOMER DOMAIN
-- =============================================================

CREATE TABLE IF NOT EXISTS customer_profiles (
  id            BIGSERIAL     PRIMARY KEY,
  user_id       BIGINT        NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  profile_image TEXT,
  gender        VARCHAR(10),
  date_of_birth DATE,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cprofiles_user_id ON customer_profiles(user_id);


CREATE TABLE IF NOT EXISTS customer_addresses (
  id            BIGSERIAL     PRIMARY KEY,
  customer_id   BIGINT        NOT NULL REFERENCES customer_profiles(id) ON DELETE CASCADE,
  address_type  VARCHAR(20)   NOT NULL DEFAULT 'HOME',  -- HOME, WORK, OTHER
  house_number  VARCHAR(20),
  street        VARCHAR(200),
  landmark      VARCHAR(100),
  city          VARCHAR(60)   NOT NULL,
  state         VARCHAR(60)   NOT NULL,
  pincode       VARCHAR(10)   NOT NULL,
  latitude      DECIMAL(9,6),
  longitude     DECIMAL(9,6),
  is_default    BOOLEAN       NOT NULL DEFAULT FALSE,
  -- AUDIT FIX: soft-delete to preserve historical order address references
  deleted_at    TIMESTAMPTZ   DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_caddr_customer_id ON customer_addresses(customer_id);


CREATE TABLE IF NOT EXISTS customer_favorites (
  id            BIGSERIAL     PRIMARY KEY,
  customer_id   BIGINT        NOT NULL REFERENCES customer_profiles(id) ON DELETE CASCADE,
  vendor_id     BIGINT        NOT NULL,          -- FK to vendors added after vendors table
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (customer_id, vendor_id)
);


-- =============================================================
-- 4. VENDOR DOMAIN
-- =============================================================

CREATE TABLE IF NOT EXISTS vendors (
  id            BIGSERIAL     PRIMARY KEY,
  -- AUDIT FIX: user_id FK was missing in original model
  user_id       BIGINT        NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  name          VARCHAR(150)  NOT NULL,
  description   TEXT,
  -- NOTE: phone/email here = business contact, distinct from users.phone/email (owner login)
  phone         VARCHAR(15),
  email         VARCHAR(150),
  gst_number    VARCHAR(20),
  status        VARCHAR(20)   NOT NULL DEFAULT 'PENDING',  -- PENDING, ACTIVE, SUSPENDED, PAUSED
  rating        DECIMAL(3,2)  DEFAULT 0.00,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendors_user_id ON vendors(user_id);
CREATE INDEX IF NOT EXISTS idx_vendors_status  ON vendors(status);

-- Now add FK from customer_favorites to vendors
ALTER TABLE customer_favorites
  ADD CONSTRAINT fk_cfav_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE;


CREATE TABLE IF NOT EXISTS vendor_branches (
  id            BIGSERIAL     PRIMARY KEY,
  vendor_id     BIGINT        NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  zone_id       BIGINT        REFERENCES zones(id),
  branch_name   VARCHAR(100)  NOT NULL,
  phone         VARCHAR(15),
  address       TEXT,
  latitude      DECIMAL(9,6),
  longitude     DECIMAL(9,6),
  status        VARCHAR(20)   NOT NULL DEFAULT 'ACTIVE'  -- ACTIVE, INACTIVE, TEMPORARILY_CLOSED
);

CREATE INDEX IF NOT EXISTS idx_vbranches_vendor_id ON vendor_branches(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vbranches_zone_id   ON vendor_branches(zone_id);


CREATE TABLE IF NOT EXISTS vendor_operating_hours (
  id            BIGSERIAL     PRIMARY KEY,
  branch_id     BIGINT        NOT NULL REFERENCES vendor_branches(id) ON DELETE CASCADE,
  day_of_week   SMALLINT      NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),  -- 0=Sun, 6=Sat
  open_time     TIME          NOT NULL,
  close_time    TIME          NOT NULL,
  UNIQUE (branch_id, day_of_week)
);


CREATE TABLE IF NOT EXISTS vendor_documents (
  id                    BIGSERIAL     PRIMARY KEY,
  vendor_id             BIGINT        NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  document_type         VARCHAR(50)   NOT NULL,  -- FSSAI, GST, AADHAAR, PAN, BANK_DETAILS
  file_url              TEXT          NOT NULL,
  verification_status   VARCHAR(20)   NOT NULL DEFAULT 'PENDING',  -- PENDING, VERIFIED, REJECTED
  uploaded_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS vendor_performance_metrics (
  id                        BIGSERIAL     PRIMARY KEY,
  vendor_id                 BIGINT        NOT NULL UNIQUE REFERENCES vendors(id) ON DELETE CASCADE,
  acceptance_rate           DECIMAL(5,2)  DEFAULT 0.00,
  cancellation_rate         DECIMAL(5,2)  DEFAULT 0.00,
  average_preparation_time  SMALLINT      DEFAULT 0,  -- minutes
  sla_score                 DECIMAL(5,2)  DEFAULT 0.00,
  updated_at                TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);


-- =============================================================
-- 5. MENU DOMAIN
-- =============================================================

CREATE TABLE IF NOT EXISTS categories (
  id          BIGSERIAL     PRIMARY KEY,
  vendor_id   BIGINT        NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  name        VARCHAR(80)   NOT NULL,
  description TEXT,
  sort_order  SMALLINT      DEFAULT 0,
  status      VARCHAR(20)   NOT NULL DEFAULT 'ACTIVE'
);

CREATE INDEX IF NOT EXISTS idx_categories_vendor_id ON categories(vendor_id);


CREATE TABLE IF NOT EXISTS menu_items (
  id                BIGSERIAL       PRIMARY KEY,
  vendor_id         BIGINT          NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  category_id       BIGINT          NOT NULL REFERENCES categories(id),
  name              VARCHAR(150)    NOT NULL,
  description       TEXT,
  price             NUMERIC(10,2)   NOT NULL,
  discount_price    NUMERIC(10,2),
  image_url         TEXT,
  is_veg            BOOLEAN         NOT NULL DEFAULT FALSE,
  status            VARCHAR(20)     NOT NULL DEFAULT 'ACTIVE',   -- ACTIVE, INACTIVE, SOLD_OUT
  -- AUDIT FIX: stock_quantity and preparation_time were missing
  stock_quantity    SMALLINT        NOT NULL DEFAULT -1,         -- -1 = unlimited
  preparation_time  SMALLINT,                                    -- minutes estimate
  created_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_menuitems_vendor_id   ON menu_items(vendor_id);
CREATE INDEX IF NOT EXISTS idx_menuitems_category_id ON menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_menuitems_name_trgm   ON menu_items USING GIN (name gin_trgm_ops);


CREATE TABLE IF NOT EXISTS menu_item_images (
  id            BIGSERIAL   PRIMARY KEY,
  menu_item_id  BIGINT      NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  image_url     TEXT        NOT NULL,
  sort_order    SMALLINT    DEFAULT 0
);


CREATE TABLE IF NOT EXISTS menu_item_customizations (
  id              BIGSERIAL       PRIMARY KEY,
  menu_item_id    BIGINT          NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  name            VARCHAR(80)     NOT NULL,    -- "Extra Cheese", "Large Size"
  price           NUMERIC(10,2)   NOT NULL DEFAULT 0.00,
  -- AUDIT FIX: group/required flags missing — needed for radio vs checkbox UI
  group_name      VARCHAR(60),                -- "Size", "Extras", "Spice Level"
  is_required     BOOLEAN         NOT NULL DEFAULT FALSE,
  max_selections  SMALLINT        NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_customizations_item_id ON menu_item_customizations(menu_item_id);


-- =============================================================
-- 6. CART DOMAIN
-- =============================================================

CREATE TABLE IF NOT EXISTS carts (
  id            BIGSERIAL     PRIMARY KEY,
  customer_id   BIGINT        NOT NULL REFERENCES customer_profiles(id) ON DELETE CASCADE,
  vendor_id     BIGINT        NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  -- AUDIT FIX: status and updated_at were missing — cart could never be closed/converted
  status        VARCHAR(20)   NOT NULL DEFAULT 'ACTIVE',  -- ACTIVE, CONVERTED, ABANDONED
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (customer_id, vendor_id, status)  -- only one ACTIVE cart per customer per vendor
);

CREATE INDEX IF NOT EXISTS idx_carts_customer_id ON carts(customer_id);


CREATE TABLE IF NOT EXISTS cart_items (
  id            BIGSERIAL       PRIMARY KEY,
  cart_id       BIGINT          NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  menu_item_id  BIGINT          NOT NULL REFERENCES menu_items(id),
  quantity      SMALLINT        NOT NULL DEFAULT 1 CHECK (quantity > 0),
  price         NUMERIC(10,2)   NOT NULL,       -- price snapshot at time of add
  customizations JSONB                          -- [{ name, price }] snapshot
);


-- =============================================================
-- 7. ORDER DOMAIN
-- =============================================================

CREATE TABLE IF NOT EXISTS orders (
  id              BIGSERIAL       PRIMARY KEY,
  order_number    VARCHAR(30)     NOT NULL UNIQUE,  -- e.g. PRO-20240601-0001
  customer_id     BIGINT          NOT NULL REFERENCES customer_profiles(id),
  vendor_id       BIGINT          NOT NULL REFERENCES vendors(id),
  branch_id       BIGINT          REFERENCES vendor_branches(id),
  rider_id        BIGINT,                                    -- FK added after riders table (see ALTER TABLE below)
  address_id      BIGINT          REFERENCES customer_addresses(id),
  subtotal        NUMERIC(10,2)   NOT NULL DEFAULT 0.00,
  tax_amount      NUMERIC(10,2)   NOT NULL DEFAULT 0.00,
  delivery_fee    NUMERIC(10,2)   NOT NULL DEFAULT 0.00,
  platform_fee    NUMERIC(10,2)   NOT NULL DEFAULT 0.00,
  discount_amount NUMERIC(10,2)   NOT NULL DEFAULT 0.00,
  total_amount    NUMERIC(10,2)   NOT NULL DEFAULT 0.00,
  status          VARCHAR(30)     NOT NULL DEFAULT 'PLACED',
  -- AUDIT FIX: payment_method added for quick reference without join
  payment_method  VARCHAR(30),                              -- UPI, CARD, COD, WALLET
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_vendor_id   ON orders(vendor_id);
CREATE INDEX IF NOT EXISTS idx_orders_rider_id    ON orders(rider_id);
CREATE INDEX IF NOT EXISTS idx_orders_status      ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at  ON orders(created_at DESC);


CREATE TABLE IF NOT EXISTS order_items (
  id            BIGSERIAL       PRIMARY KEY,
  order_id      BIGINT          NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id  BIGINT          REFERENCES menu_items(id) ON DELETE SET NULL,
  item_name     VARCHAR(150)    NOT NULL,      -- snapshot — item may be deleted later
  price         NUMERIC(10,2)   NOT NULL,
  quantity      SMALLINT        NOT NULL DEFAULT 1,
  total         NUMERIC(10,2)   NOT NULL,
  customizations JSONB                         -- snapshot of chosen customizations
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);


CREATE TABLE IF NOT EXISTS order_status_history (
  id          BIGSERIAL     PRIMARY KEY,
  order_id    BIGINT        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status      VARCHAR(30)   NOT NULL,  -- PLACED/ACCEPTED/PREPARING/READY/PICKED_UP/DELIVERED/CANCELLED
  remarks     TEXT,
  changed_by  BIGINT        REFERENCES users(id),   -- who triggered the status change
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ostatus_order_id ON order_status_history(order_id);


CREATE TABLE IF NOT EXISTS order_tracking_timeline (
  id          BIGSERIAL     PRIMARY KEY,
  order_id    BIGINT        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  title       VARCHAR(80)   NOT NULL,     -- "Order Accepted", "Rider Assigned"
  description TEXT,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otimeline_order_id ON order_tracking_timeline(order_id);


-- =============================================================
-- 8. RIDER DOMAIN  (before delivery tracking)
-- =============================================================

CREATE TABLE IF NOT EXISTS riders (
  id              BIGSERIAL     PRIMARY KEY,
  user_id         BIGINT        NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  vehicle_type    VARCHAR(30),                -- BIKE, BICYCLE, SCOOTER
  vehicle_number  VARCHAR(20),
  license_number  VARCHAR(20),
  status          VARCHAR(20)   NOT NULL DEFAULT 'PENDING'  -- PENDING, ACTIVE, SUSPENDED
);

CREATE INDEX IF NOT EXISTS idx_riders_user_id ON riders(user_id);

-- Now add the FK from orders to riders (riders table now exists)
ALTER TABLE orders
  ADD CONSTRAINT fk_orders_rider FOREIGN KEY (rider_id) REFERENCES riders(id);


CREATE TABLE IF NOT EXISTS rider_documents (
  id                    BIGSERIAL     PRIMARY KEY,
  rider_id              BIGINT        NOT NULL REFERENCES riders(id) ON DELETE CASCADE,
  document_type         VARCHAR(50)   NOT NULL,  -- AADHAAR, DL, RC_BOOK, BANK_DETAILS
  file_url              TEXT          NOT NULL,
  verification_status   VARCHAR(20)   NOT NULL DEFAULT 'PENDING'
);


CREATE TABLE IF NOT EXISTS rider_earnings (
  id              BIGSERIAL       PRIMARY KEY,
  rider_id        BIGINT          NOT NULL REFERENCES riders(id) ON DELETE CASCADE,
  order_id        BIGINT          NOT NULL REFERENCES orders(id),
  earning_amount  NUMERIC(10,2)   NOT NULL,
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rearnings_rider_id ON rider_earnings(rider_id);


-- =============================================================
-- 9. LIVE DELIVERY TRACKING
-- =============================================================

CREATE TABLE IF NOT EXISTS rider_assignments (
  id            BIGSERIAL     PRIMARY KEY,
  order_id      BIGINT        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  rider_id      BIGINT        NOT NULL REFERENCES riders(id),
  -- AUDIT FIX: status column was missing — rejected assignments were invisible
  status        VARCHAR(20)   NOT NULL DEFAULT 'PENDING',  -- PENDING, ACCEPTED, REJECTED, COMPLETED
  assigned_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  accepted_at   TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_rassign_order_id ON rider_assignments(order_id);
CREATE INDEX IF NOT EXISTS idx_rassign_rider_id ON rider_assignments(rider_id);


CREATE TABLE IF NOT EXISTS delivery_tracking_events (
  id            BIGSERIAL       PRIMARY KEY,
  order_id      BIGINT          NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  rider_id      BIGINT          NOT NULL REFERENCES riders(id),
  event_type    VARCHAR(30)     NOT NULL,  -- RIDER_ASSIGNED/ARRIVED_VENDOR/PICKED_UP/ARRIVED_CUSTOMER/DELIVERED
  latitude      DECIMAL(9,6),
  longitude     DECIMAL(9,6),
  event_time    TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tracking_order_id ON delivery_tracking_events(order_id);
CREATE INDEX IF NOT EXISTS idx_tracking_rider_id ON delivery_tracking_events(rider_id);


CREATE TABLE IF NOT EXISTS rider_availability (
  id            BIGSERIAL     PRIMARY KEY,
  rider_id      BIGINT        NOT NULL UNIQUE REFERENCES riders(id) ON DELETE CASCADE,
  is_online     BOOLEAN       NOT NULL DEFAULT FALSE,
  active_orders SMALLINT      NOT NULL DEFAULT 0,
  last_seen     TIMESTAMPTZ
);


CREATE TABLE IF NOT EXISTS rider_shift_logs (
  id            BIGSERIAL       PRIMARY KEY,
  rider_id      BIGINT          NOT NULL REFERENCES riders(id) ON DELETE CASCADE,
  login_time    TIMESTAMPTZ     NOT NULL,
  logout_time   TIMESTAMPTZ,
  earnings      NUMERIC(10,2)   DEFAULT 0.00
);

CREATE INDEX IF NOT EXISTS idx_rshift_rider_id ON rider_shift_logs(rider_id);


CREATE TABLE IF NOT EXISTS eta_history (
  id              BIGSERIAL   PRIMARY KEY,
  order_id        BIGINT      NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  estimated_time  SMALLINT    NOT NULL,   -- minutes
  actual_time     SMALLINT,              -- filled after delivery
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =============================================================
-- 10. PAYMENT DOMAIN
-- =============================================================

CREATE TABLE IF NOT EXISTS payments (
  id                  BIGSERIAL       PRIMARY KEY,
  order_id            BIGINT          NOT NULL REFERENCES orders(id),
  gateway             VARCHAR(40)     NOT NULL DEFAULT 'RAZORPAY',
  payment_reference   VARCHAR(100)    UNIQUE,    -- Razorpay payment_id
  amount              NUMERIC(10,2)   NOT NULL,
  status              VARCHAR(20)     NOT NULL DEFAULT 'PENDING',  -- PENDING, SUCCESS, FAILED
  -- AUDIT FIX: payment_mode for reconciliation (UPI/CARD/NETBANKING/WALLET)
  payment_mode        VARCHAR(30),
  created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);


CREATE TABLE IF NOT EXISTS refunds (
  id            BIGSERIAL       PRIMARY KEY,
  payment_id    BIGINT          NOT NULL REFERENCES payments(id),
  amount        NUMERIC(10,2)   NOT NULL,
  reason        TEXT,
  status        VARCHAR(20)     NOT NULL DEFAULT 'PENDING',  -- PENDING, PROCESSED, FAILED
  created_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS vendor_settlements (
  id                  BIGSERIAL       PRIMARY KEY,
  vendor_id           BIGINT          NOT NULL REFERENCES vendors(id),
  settlement_amount   NUMERIC(10,2)   NOT NULL,
  settlement_date     DATE            NOT NULL,
  status              VARCHAR(20)     NOT NULL DEFAULT 'PENDING'  -- PENDING, PROCESSED, FAILED
);

CREATE INDEX IF NOT EXISTS idx_vsettlements_vendor_id ON vendor_settlements(vendor_id);


CREATE TABLE IF NOT EXISTS payout_transactions (
  id              BIGSERIAL       PRIMARY KEY,
  vendor_id       BIGINT          NOT NULL REFERENCES vendors(id),
  settlement_id   BIGINT          NOT NULL REFERENCES vendor_settlements(id),
  bank_reference  VARCHAR(100),
  amount          NUMERIC(10,2)   NOT NULL,
  status          VARCHAR(20)     NOT NULL DEFAULT 'PENDING',
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);


-- =============================================================
-- 11. CUSTOMER SUPPORT DOMAIN
-- =============================================================

CREATE TABLE IF NOT EXISTS complaints (
  id            BIGSERIAL     PRIMARY KEY,
  order_id      BIGINT        REFERENCES orders(id),
  customer_id   BIGINT        NOT NULL REFERENCES customer_profiles(id),
  category      VARCHAR(60)   NOT NULL,  -- LATE_DELIVERY, WRONG_ITEM, QUALITY, PAYMENT
  description   TEXT          NOT NULL,
  status        VARCHAR(20)   NOT NULL DEFAULT 'OPEN',  -- OPEN, IN_PROGRESS, RESOLVED, CLOSED
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_complaints_customer_id ON complaints(customer_id);
CREATE INDEX IF NOT EXISTS idx_complaints_order_id    ON complaints(order_id);


CREATE TABLE IF NOT EXISTS complaint_responses (
  id            BIGSERIAL     PRIMARY KEY,
  complaint_id  BIGINT        NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  admin_id      BIGINT        NOT NULL REFERENCES users(id),     -- users.id directly (SUPER_ADMIN)
  response      TEXT          NOT NULL,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS support_tickets (
  id            BIGSERIAL     PRIMARY KEY,
  customer_id   BIGINT        NOT NULL REFERENCES customer_profiles(id),
  subject       VARCHAR(200)  NOT NULL,
  status        VARCHAR(20)   NOT NULL DEFAULT 'OPEN',  -- OPEN, IN_PROGRESS, RESOLVED
  priority      VARCHAR(20)   NOT NULL DEFAULT 'MEDIUM',  -- LOW, MEDIUM, HIGH, CRITICAL
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);


-- =============================================================
-- 12. NOTIFICATION DOMAIN
-- =============================================================

CREATE TABLE IF NOT EXISTS notifications (
  id            BIGSERIAL     PRIMARY KEY,
  user_id       BIGINT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title         VARCHAR(150)  NOT NULL,
  message       TEXT          NOT NULL,
  type          VARCHAR(30)   NOT NULL,  -- ORDER_UPDATE, PROMO, SUPPORT, PAYMENT
  is_read       BOOLEAN       NOT NULL DEFAULT FALSE,
  -- AUDIT FIX: action_url and entity_id for deep-link navigation
  action_url    VARCHAR(255),            -- e.g. /orders/550
  entity_id     BIGINT,                 -- order_id, complaint_id, etc.
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifs_user_id   ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifs_is_read   ON notifications(user_id, is_read);


CREATE TABLE IF NOT EXISTS notification_logs (
  id                BIGSERIAL     PRIMARY KEY,
  notification_id   BIGINT        NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  channel           VARCHAR(20)   NOT NULL,  -- SMS, EMAIL, PUSH, WHATSAPP
  status            VARCHAR(20)   NOT NULL DEFAULT 'PENDING',  -- PENDING, SENT, FAILED
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);


-- =============================================================
-- 13. ADMIN OPERATIONS DOMAIN
-- =============================================================

CREATE TABLE IF NOT EXISTS admin_actions (
  id            BIGSERIAL     PRIMARY KEY,
  admin_id      BIGINT        NOT NULL REFERENCES users(id),   -- users.id (role = SUPER_ADMIN)
  action_type   VARCHAR(60)   NOT NULL,  -- VENDOR_PAUSED, REFUND_APPROVED, ORDER_CANCELLED
  entity_type   VARCHAR(40)   NOT NULL,  -- vendor, order, rider, complaint
  entity_id     BIGINT        NOT NULL,
  notes         TEXT,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_adminact_admin_id ON admin_actions(admin_id);
CREATE INDEX IF NOT EXISTS idx_adminact_entity   ON admin_actions(entity_type, entity_id);


CREATE TABLE IF NOT EXISTS incidents (
  id            BIGSERIAL     PRIMARY KEY,
  title         VARCHAR(200)  NOT NULL,
  description   TEXT,
  severity      VARCHAR(20)   NOT NULL DEFAULT 'LOW',  -- LOW, MEDIUM, HIGH, CRITICAL
  status        VARCHAR(20)   NOT NULL DEFAULT 'OPEN', -- OPEN, INVESTIGATING, RESOLVED
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS fraud_flags (
  id            BIGSERIAL     PRIMARY KEY,
  entity_type   VARCHAR(40)   NOT NULL,  -- customer, vendor, rider, order
  entity_id     BIGINT        NOT NULL,
  reason        TEXT          NOT NULL,  -- FAKE_DELIVERY, REFUND_ABUSE, MULTIPLE_FAILED_PAYMENTS
  severity      VARCHAR(20)   NOT NULL DEFAULT 'LOW',
  status        VARCHAR(20)   NOT NULL DEFAULT 'OPEN',  -- OPEN, REVIEWED, DISMISSED
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fraud_entity ON fraud_flags(entity_type, entity_id);


-- =============================================================
-- 14. ANALYTICS DOMAIN
-- =============================================================

CREATE TABLE IF NOT EXISTS daily_metrics (
  id                  BIGSERIAL       PRIMARY KEY,
  metric_date         DATE            NOT NULL UNIQUE,
  total_orders        INTEGER         NOT NULL DEFAULT 0,
  completed_orders    INTEGER         NOT NULL DEFAULT 0,
  cancelled_orders    INTEGER         NOT NULL DEFAULT 0,
  revenue             NUMERIC(14,2)   NOT NULL DEFAULT 0.00,
  active_customers    INTEGER         NOT NULL DEFAULT 0,
  active_vendors      INTEGER         NOT NULL DEFAULT 0,
  active_riders       INTEGER         NOT NULL DEFAULT 0
);


CREATE TABLE IF NOT EXISTS demand_supply_metrics (
  id                BIGSERIAL       PRIMARY KEY,
  zone_id           BIGINT          NOT NULL REFERENCES zones(id),
  active_orders     INTEGER         NOT NULL DEFAULT 0,
  available_riders  SMALLINT        NOT NULL DEFAULT 0,
  surge_factor      DECIMAL(4,2)    NOT NULL DEFAULT 1.00,
  created_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dsmetrics_zone_id ON demand_supply_metrics(zone_id);


-- =============================================================
-- UPDATED_AT TRIGGER FUNCTION
-- Automatically keeps updated_at current on any row update
-- =============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_menu_items_updated_at
  BEFORE UPDATE ON menu_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_carts_updated_at
  BEFORE UPDATE ON carts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =============================================================
-- SUMMARY
-- =============================================================
-- Tables: 46
--   Auth & Users      : users, roles, user_sessions, otp_verifications (NEW)
--   Customer          : customer_profiles, customer_addresses, customer_favorites
--   Vendor            : vendors (+user_id fix), vendor_branches, vendor_operating_hours,
--                       vendor_documents, vendor_performance_metrics
--   Menu              : categories, menu_items (+stock_quantity, prep_time),
--                       menu_item_images, menu_item_customizations (+group/required)
--   Cart              : carts (+status, updated_at), cart_items
--   Orders            : orders (+payment_method), order_items,
--                       order_status_history, order_tracking_timeline
--   Delivery Tracking : rider_assignments (+status), delivery_tracking_events,
--                       rider_availability, rider_shift_logs, eta_history
--   Payments          : payments (+payment_mode), refunds,
--                       vendor_settlements, payout_transactions
--   Riders            : riders, rider_documents, rider_earnings
--   Support           : complaints, complaint_responses, support_tickets
--   Notifications     : notifications (+action_url, entity_id), notification_logs
--   Admin Operations  : admin_actions, incidents, fraud_flags
--   Analytics & Zones : daily_metrics, demand_supply_metrics, zones
-- =============================================================


-- =============================================================
-- 15. RIDER PAYOUTS (added — was missing, only vendor side existed)
-- =============================================================

-- Mirrors vendor_settlements exactly for riders.
-- Admin marks a settlement when they initiate a payout batch for a rider.
CREATE TABLE IF NOT EXISTS rider_settlements (
  id                  BIGSERIAL       PRIMARY KEY,
  rider_id            BIGINT          NOT NULL REFERENCES riders(id) ON DELETE CASCADE,
  settlement_amount   NUMERIC(10,2)   NOT NULL,
  settlement_date     DATE            NOT NULL,
  status              VARCHAR(20)     NOT NULL DEFAULT 'PENDING',  -- PENDING, PROCESSED, FAILED
  created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rsettlements_rider_id ON rider_settlements(rider_id);


-- Mirrors payout_transactions exactly for riders.
-- One settlement can have one bank transfer record with the bank reference number.
CREATE TABLE IF NOT EXISTS rider_payout_transactions (
  id              BIGSERIAL       PRIMARY KEY,
  rider_id        BIGINT          NOT NULL REFERENCES riders(id) ON DELETE CASCADE,
  settlement_id   BIGINT          NOT NULL REFERENCES rider_settlements(id),
  bank_reference  VARCHAR(100),                -- UTR / NEFT / IMPS reference from bank
  amount          NUMERIC(10,2)   NOT NULL,
  status          VARCHAR(20)     NOT NULL DEFAULT 'PENDING',  -- PENDING, SUCCESS, FAILED
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rpayout_rider_id      ON rider_payout_transactions(rider_id);
CREATE INDEX IF NOT EXISTS idx_rpayout_settlement_id ON rider_payout_transactions(settlement_id);

-- =============================================================
-- FINAL SUMMARY — v2.1
-- Tables: 48 (46 post-audit + 2 rider payout tables)
--   Auth & Users      : users, roles, user_sessions, otp_verifications
--   Customer          : customer_profiles, customer_addresses, customer_favorites
--   Vendor            : vendors, vendor_branches, vendor_operating_hours,
--                       vendor_documents, vendor_performance_metrics
--   Menu              : categories, menu_items, menu_item_images,
--                       menu_item_customizations
--   Cart              : carts, cart_items
--   Orders            : orders, order_items, order_status_history,
--                       order_tracking_timeline
--   Delivery Tracking : rider_assignments, delivery_tracking_events,
--                       rider_availability, rider_shift_logs, eta_history
--   Payments          : payments, refunds, vendor_settlements, payout_transactions
--   Riders            : riders, rider_documents, rider_earnings,
--                       rider_settlements (NEW), rider_payout_transactions (NEW)
--   Support           : complaints, complaint_responses, support_tickets
--   Notifications     : notifications, notification_logs
--   Admin Operations  : admin_actions, incidents, fraud_flags
--   Analytics & Zones : daily_metrics, demand_supply_metrics, zones
-- =============================================================
