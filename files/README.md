# Prolious Food Delivery Platform — Backend API Documentation

**Version:** 2.0  
**Database:** PostgreSQL (48 tables)  
**Real-time:** Socket.IO with Redis Adapter  
**Auth:** JWT + OTP (4hr access token, 30-day refresh)  
**Payment:** Razorpay Integration  

---

## 🛠 Recent Fixes (2026-06-11)

Summary of backend fixes applied during troubleshooting:

- **Cart / Order Placement:** Fixed unique-constraint failure when placing orders by cleaning up old `ABANDONED` carts before updating statuses. (Changed: `src/services/customer.service.ts`)
- **Rider Location Route:** Added `POST /api/rider/location/update` to match frontend calls. (Changed: `src/routes/rider.routes.ts`)
- **Socket.IO handlers:** Repaired Socket.IO issues: replaced an absolute import path with a relative import and fixed an incorrectly nested `assign_rider_to_order` handler so events are emitted correctly. (Changed: `src/socket/handlers.ts`, `src/socket/index.ts`)

Files modified during debugging are listed above; test the flow by placing an order, marking it READY as a vendor, and ensuring a connected rider receives `pending_assignments` / `new_order_assigned` socket events.

---

## 📋 Table of Contents

1. [Quick Start](#quick-start)
2. [Project Structure](#project-structure)
3. [Environment Setup](#environment-setup)
4. [Database Setup](#database-setup)
5. [API Reference](#api-reference)
6. [Socket.IO Events](#socketio-events)
7. [Authentication Flow](#authentication-flow)
8. [Error Handling](#error-handling)
9. [Deployment](#deployment)

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Copy `.env` template and fill with your credentials (see [Environment Setup](#environment-setup))

### 3. Setup Database
Run the PostgreSQL migration file to create all 48 tables:
```bash
psql -U postgres -d prolicious -f prolious_migration.sql
```

### 4. Start Redis
```bash
redis-cli  # or use Redis Cloud
```

### 5. Run Server
```bash
npm run dev    # development (with nodemon)
npm start      # production
```

Server runs on `http://localhost:5000`  
Health check: `GET http://localhost:5000/health`

---

## 📁 Project Structure

```
src/
├── config/
│   ├── database.js         # PostgreSQL connection pool
│   ├── redis.js            # Redis client configuration
│   └── razorpay.js         # Payment gateway setup
├── middleware/
│   ├── auth.js             # JWT verification
│   ├── roleGuard.js        # Role-based access control
│   └── errorHandler.js     # Global error handling
├── routes/
│   ├── auth.routes.js      # 6 auth endpoints
│   ├── customer.routes.js  # 22 customer endpoints
│   ├── vendor.routes.js    # 24 vendor endpoints
│   ├── rider.routes.js     # 18 rider endpoints
│   └── admin.routes.js     # 17 admin endpoints
├── controllers/
│   ├── authController.js   # Auth logic
│   ├── customerController.js # Customer business logic
│   ├── vendorController.js # Vendor business logic
│   ├── riderController.js  # Rider business logic
│   └── adminController.js  # Admin operations
├── utils/
│   ├── jwt.js              # Token generation
│   ├── otp.js              # OTP hashing
│   ├── passwordHash.js     # Password utilities
│   └── responses.js        # Standard response formatting
├── socket/
│   └── handlers.js         # Socket.IO event handlers (12 events)
├── app.js                  # Express app config
└── index.js                # Server entry point
```

---

## 🔐 Environment Setup

Create `.env` file in project root:

```dotenv
# Database
DATABASE_URL=postgresql://postgres:9803@localhost:5432/prolicious

# JWT Tokens
JWT_SECRET=22acf41ebb7d622101279e4e543489c60b05e591878a87398ab225b20d343e8a62c222abe976f737613e4c297e9b6a0b58969223b8f863b5d154d086011f3139
JWT_REFRESH_SECRET=your-refresh-secret-min-32-chars-change-this

# Payment Gateway
RAZORPAY_KEY_ID=rzp_test_SRrKIfsKje5uNq
RAZORPAY_KEY_SECRET=KfntU4VVvNMAX64AvdhClFNd
RAZORPAY_WEBHOOK_SECRET=BALAJI

# Redis
REDIS_URL=redis://default:AUjZWqjdnaBIzMWFcldhgSVMOhsoWiu7@copper-weatherproof-zippy-23102.db.redis.io:15830

# Server
NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:3000
```

---

## 📊 Database Setup

### Run Migration
The migration file creates all 48 tables with proper indexes, constraints, and triggers:

```bash
psql -U postgres -d prolicious -f prolious_migration.sql
```

### Tables Overview
- **Auth & Users** (4): users, roles, user_sessions, otp_verifications
- **Customer** (3): customer_profiles, customer_addresses, customer_favorites
- **Vendor** (5): vendors, vendor_branches, vendor_operating_hours, vendor_documents, vendor_performance_metrics
- **Menu** (4): categories, menu_items, menu_item_images, menu_item_customizations
- **Cart** (2): carts, cart_items
- **Orders** (4): orders, order_items, order_status_history, order_tracking_timeline
- **Delivery** (5): rider_assignments, delivery_tracking_events, rider_availability, rider_shift_logs, eta_history
- **Payments** (4): payments, refunds, vendor_settlements, payout_transactions
- **Riders** (3): riders, rider_documents, rider_earnings + **2 NEW**: rider_settlements, rider_payout_transactions
- **Support** (3): complaints, complaint_responses, support_tickets
- **Notifications** (2): notifications, notification_logs
- **Admin** (3): admin_actions, incidents, fraud_flags
- **Analytics** (3): daily_metrics, demand_supply_metrics, zones

---

## 🔌 API Reference

### Authentication (6 APIs)

#### 1. Send OTP
```
POST /api/auth/send-otp
Body: { "phone": "9876543210" }
Response: { message: "OTP sent to phone", phone, expiresIn: "10 minutes" }
```

#### 2. Verify OTP & Signup
```
POST /api/auth/verify-otp
Body: { 
  "phone": "9876543210", 
  "otp": "123456", 
  "name": "John Doe",           // Required for new signup
  "role": "CUSTOMER"            // CUSTOMER, VENDOR, or RIDER
}
Response: { userId, accessToken, refreshToken, role, expiresIn: "4 hours" }
```

#### 3. Login (Email + Password)
```
POST /api/auth/login
Body: { "email": "user@example.com", "password": "secure_password" }
Response: { userId, accessToken, refreshToken, role, expiresIn: "4 hours" }
```

#### 4. Refresh Token
```
POST /api/auth/refresh-token
Body: { "refreshToken": "eyJhbGc..." }
Response: { accessToken, expiresIn: "4 hours" }
```

#### 5. Logout
```
POST /api/auth/logout
Headers: Authorization: Bearer <accessToken>
Response: { message: "Logged out successfully" }
```

#### 6. Get Current User
```
GET /api/auth/me
Headers: Authorization: Bearer <accessToken>
Response: { id, name, phone, email, role, status, last_login, created_at }
```

---

### Customer APIs (22 endpoints)

#### Profile Management
```
GET    /api/customer/profile                    - Get customer profile
PATCH  /api/customer/profile                    - Update profile
GET    /api/customer/addresses                  - List addresses
POST   /api/customer/addresses                  - Add address
PATCH  /api/customer/addresses/:id              - Edit address
DELETE /api/customer/addresses/:id              - Delete address (soft)
```

#### Browse & Search
```
GET    /api/customer/vendors                    - List vendors by zone
GET    /api/customer/vendors/:id                - Vendor details
GET    /api/customer/vendors/:id/menu           - Full vendor menu
GET    /api/customer/search?query=biryani       - Search vendors + items
GET    /api/customer/categories                 - All food categories
```

#### Cart Management
```
GET    /api/customer/cart                       - Get active cart
POST   /api/customer/cart/items                 - Add to cart
PATCH  /api/customer/cart/items/:id             - Update quantity
DELETE /api/customer/cart/items/:id             - Remove item
DELETE /api/customer/cart                       - Clear cart
```

#### Orders
```
POST   /api/customer/orders                     - Place order from cart
GET    /api/customer/orders                     - List my orders
GET    /api/customer/orders/:id                 - Order details
GET    /api/customer/orders/:id/tracking        - Live tracking timeline
POST   /api/customer/orders/:id/cancel          - Cancel order
```

#### Payments
```
POST   /api/customer/payments/initiate          - Create Razorpay order
POST   /api/customer/payments/verify            - Verify payment signature
```

#### Support & Notifications
```
POST   /api/customer/complaints                 - Raise complaint
GET    /api/customer/complaints                 - My complaints
POST   /api/customer/support/tickets            - Create support ticket
GET    /api/customer/notifications              - My notifications
PATCH  /api/customer/notifications/:id/read     - Mark read
POST   /api/customer/favorites/:vendorId        - Add favorite
DELETE /api/customer/favorites/:vendorId        - Remove favorite
```

---

### Vendor APIs (24 endpoints)

#### Profile & Branch
```
GET    /api/vendor/profile                      - Vendor profile
PATCH  /api/vendor/profile                      - Update profile
GET    /api/vendor/branches                     - List branches
PATCH  /api/vendor/branches/:id/status          - Toggle active/inactive
GET    /api/vendor/operating-hours              - Get hours
PUT    /api/vendor/operating-hours              - Set hours
```

#### Menu Management
```
GET    /api/vendor/categories                   - List categories
POST   /api/vendor/categories                   - Add category
PATCH  /api/vendor/categories/:id               - Edit category
DELETE /api/vendor/categories/:id               - Delete category
GET    /api/vendor/menu                         - All menu items
POST   /api/vendor/menu                         - Add item
PATCH  /api/vendor/menu/:id                     - Edit item
DELETE /api/vendor/menu/:id                     - Delete item
PATCH  /api/vendor/menu/:id/availability        - Toggle availability
```

#### Order Management
```
GET    /api/vendor/orders?status=PLACED         - Orders with filters
GET    /api/vendor/orders/:id                   - Order details
PATCH  /api/vendor/orders/:id/accept            - Accept order
PATCH  /api/vendor/orders/:id/reject            - Reject order
PATCH  /api/vendor/orders/:id/preparing         - Mark preparing
PATCH  /api/vendor/orders/:id/ready             - Mark ready
```

#### Analytics & Payouts
```
GET    /api/vendor/analytics/summary            - Total sales, orders, revenue
GET    /api/vendor/analytics/daily              - Daily breakdown (30 days)
GET    /api/vendor/transactions                 - Payment history
GET    /api/vendor/settlements                  - Payout settlements
GET    /api/vendor/performance                  - SLA score, acceptance rate
```

---

### Rider APIs (18 endpoints)

#### Availability & Location
```
PATCH  /api/rider/availability                  - Toggle online/offline
POST   /api/rider/location                      - Push GPS coordinates
```

#### Order Management
```
GET    /api/rider/orders                        - Assigned deliveries
GET    /api/rider/orders/:id                    - Order + address details
PATCH  /api/rider/orders/:id/accept             - Accept assignment
PATCH  /api/rider/orders/:id/reject             - Reject assignment
PATCH  /api/rider/orders/:id/arrived-vendor     - Arrived at vendor
PATCH  /api/rider/orders/:id/picked-up          - Picked up food
PATCH  /api/rider/orders/:id/arrived-customer   - Arrived at customer
POST   /api/rider/orders/:id/deliver            - Verify OTP + deliver
```

#### Earnings & Payouts
```
GET    /api/rider/earnings                      - All earnings
GET    /api/rider/earnings/summary              - Daily/weekly totals
GET    /api/rider/shifts                        - Shift history
GET    /api/rider/settlements                   - Settlement records
GET    /api/rider/payouts                       - Payout transactions
GET    /api/rider/notifications                 - Rider notifications
```

---

### Admin APIs (17 endpoints)

#### Dashboard & Analytics
```
GET    /api/admin/dashboard/live                - Live stats (orders, riders, vendors, customers)
GET    /api/admin/analytics/daily               - Daily metrics (30 days)
GET    /api/admin/analytics/demand-supply       - Zone-wise surge data
```

#### Order Management
```
GET    /api/admin/orders?status=PENDING         - All orders with filters
GET    /api/admin/orders/:id                    - Order details
PATCH  /api/admin/orders/:id/cancel             - Force cancel order
POST   /api/admin/refunds                       - Approve refund
```

#### Vendor Management
```
GET    /api/admin/vendors                       - List all vendors
POST   /api/admin/vendors                       - Add vendor (with KYC docs)
PATCH  /api/admin/vendors/:id/status            - Suspend/activate
GET    /api/admin/vendors/:id/documents         - KYC document list
PATCH  /api/admin/vendors/:id/documents/:docId  - Verify/reject doc
```

#### Rider Management
```
GET    /api/admin/riders                        - List all riders
POST   /api/admin/riders                        - Add rider (with KYC docs)
PATCH  /api/admin/riders/:id/status             - Suspend/activate
GET    /api/admin/riders/:id/documents          - KYC document list
PATCH  /api/admin/riders/:id/documents/:docId   - Verify/reject doc
```

#### Support & Fraud
```
GET    /api/admin/tickets                       - Customer support tickets
POST   /api/admin/tickets/:id/respond           - Respond to ticket
GET    /api/admin/complaints                    - All complaints
POST   /api/admin/complaints/:id/respond        - Respond to complaint
GET    /api/admin/audit-logs                    - Admin action audit trail
GET    /api/admin/fraud-flags                   - Fraud flag list
PATCH  /api/admin/fraud-flags/:id               - Review/dismiss flag
```

---

## 🔌 Socket.IO Events

### Client → Server Events

#### Order & Delivery
```javascript
socket.emit('join_order_room', { orderId, userId, role });
socket.emit('rider_location_update', { orderId, riderId, latitude, longitude });
socket.emit('rider_go_online', { riderId });
socket.emit('rider_go_offline', { riderId });
socket.emit('verify_delivery_otp', { orderId, otp });
```

### Server → Client Events

#### Order Status
```javascript
// Broadcasted to all parties in order room
socket.on('order_status_changed', { orderId, status, message });
socket.on('order_accepted', { orderId, vendorName, message });
socket.on('food_preparation_started', { orderId, message });
socket.on('food_ready', { orderId, message });
socket.on('order_picked_up', { orderId, riderName });
socket.on('delivery_arrived_customer', { orderId, riderName });
socket.on('order_delivered', { orderId, message });
```

#### Rider Events
```javascript
socket.on('rider_assigned', { orderId, riderId, riderName, riderPhone, riderLocation });
socket.on('rider_location', { riderId, latitude, longitude, timestamp });
socket.on('rider_online', { riderId, isOnline: true });
socket.on('rider_offline', { riderId, isOnline: false });
```

#### Notifications
```javascript
socket.on('new_order_received', { orderId, orderNumber, totalAmount, message });
socket.on('delivery_otp', { orderId, message });
socket.on('delivery_confirmed', { orderId, message });
```

---

## 🔐 Authentication Flow

### OTP-Based Login (Mobile)
```
1. User enters phone number
2. POST /api/auth/send-otp → OTP sent to phone (SMS)
3. User enters OTP
4. POST /api/auth/verify-otp → 
   - If new user: Create account (CUSTOMER/VENDOR/RIDER)
   - Return: accessToken (4hr), refreshToken (30 days)
5. Store tokens in flutter_secure_storage (iOS Keychain / Android Keystore)
```

### Email + Password Login (Web)
```
1. User enters email + password
2. POST /api/auth/login →
   - Hash password with bcrypt
   - If valid: Return accessToken, refreshToken
3. Browser stores in httpOnly secure cookie
```

### Token Refresh
```
1. Access token expires after 4 hours
2. App auto-calls POST /api/auth/refresh-token with refreshToken
3. Backend validates refreshToken (30-day expiry in DB)
4. Return new accessToken (4 hours)
5. No logout needed for user
```

### Protected Endpoints
```
All protected routes require:
Headers: Authorization: Bearer <accessToken>

authMiddleware verifies JWT:
- Decodes token using JWT_SECRET
- Checks expiration
- Attaches req.user = { id, role }

roleGuard('VENDOR') checks role:
- If role ≠ VENDOR, return 403 Forbidden
- Otherwise, allow request
```

---

## ⚠️ Error Handling

### Standard Error Response
```json
{
  "success": false,
  "error": "Error message here",
  "code": "ERROR_CODE",
  "timestamp": "2024-06-01T10:30:00Z"
}
```

### HTTP Status Codes
- **200** - OK
- **201** - Created
- **400** - Bad Request (validation error)
- **401** - Unauthorized (no token / invalid token)
- **403** - Forbidden (insufficient permissions)
- **404** - Not Found (resource doesn't exist)
- **429** - Too Many Requests (OTP limit exceeded)
- **500** - Internal Server Error

### Common Error Codes
```
MISSING_FIELDS         - Required field not provided
INVALID_CREDENTIALS    - Email/password mismatch
OTP_EXPIRED            - OTP not found or expired
INVALID_OTP            - OTP does not match
INVALID_ROLE           - Role not in allowed set
USER_NOT_FOUND         - User doesn't exist
VENDOR_NOT_FOUND       - Vendor doesn't exist
ORDER_NOT_FOUND        - Order doesn't exist
TOKEN_EXPIRED          - Access token expired
INVALID_REFRESH_TOKEN  - Refresh token invalid
PERMISSION_DENIED      - Not allowed to access resource
INTERNAL_ERROR         - Server error
```

---

## 🚀 Deployment

### Heroku / Railway
```bash
# Set environment variables in platform dashboard
git push heroku main
```

### AWS / Google Cloud
```bash
# Build Docker image
docker build -t prolious-backend .

# Push to container registry
docker push ...

# Deploy to ECS / Cloud Run / App Engine
```

### Production Checklist
- [ ] Set `NODE_ENV=production`
- [ ] Use strong JWT_SECRET (min 32 chars, random)
- [ ] Enable HTTPS only (requireHttps middleware)
- [ ] Set up CORS whitelist (only frontend domains)
- [ ] Configure REDIS with password + TLS
- [ ] Enable PostgreSQL backups
- [ ] Set up monitoring (Sentry, DataDog)
- [ ] Configure email service (SendGrid) for notifications
- [ ] Set up SMS gateway (Twilio) for OTP
- [ ] Enable API rate limiting
- [ ] Setup CI/CD pipeline (GitHub Actions)

### Environment Variables for Production
```dotenv
NODE_ENV=production
DATABASE_URL=postgresql://prod_user:strong_password@prod-db-host:5432/prolicious
REDIS_URL=rediss://default:strong_password@prod-redis-host:19879
JWT_SECRET=generate_strong_random_32_char_secret
JWT_REFRESH_SECRET=generate_another_strong_random_secret
RAZORPAY_KEY_ID=rzp_live_xxxxx
RAZORPAY_KEY_SECRET=xxxxx
RAZORPAY_WEBHOOK_SECRET=xxxxx
PORT=8080
FRONTEND_URL=https://app.prolious.com
SENDGRID_API_KEY=xxxxx
TWILIO_ACCOUNT_SID=xxxxx
TWILIO_AUTH_TOKEN=xxxxx
```

---

## 🐛 Troubleshooting

### Redis Connection Failed
```
Error: Redis max retries exceeded
→ Check REDIS_URL format
→ Verify Redis Cloud credentials
→ Test: redis-cli -u <REDIS_URL> ping
```

### JWT Verification Failed
```
Error: Invalid token
→ Check JWT_SECRET is set
→ Verify token is in Authorization header
→ Check token hasn't expired (4 hours)
```

### OTP Not Received
```
→ OTP is logged to console in dev mode
→ Check SMS gateway is configured (Twilio/AWS SNS)
→ Verify phone number format (+91xxxxxxxxxx)
```

### Payment Verification Failed
```
→ Verify Razorpay credentials in .env
→ Check webhook secret matches
→ Verify signature generation using crypto.createHmac
```

---

## 📞 Support

For issues, refer to:
- **Docs**: https://docs.prolious.com
- **API Reference**: `/api/docs` (Swagger UI - to be added)
- **GitHub**: https://github.com/prolious/backend
- **Email**: dev@prolious.com

---

**Last Updated:** June 1, 2024  
**Status:** Production Ready v2.0
