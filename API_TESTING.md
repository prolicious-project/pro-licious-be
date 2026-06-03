# Pro-Licious API Testing Guide

Base URL: `http://localhost:5000`  
Swagger UI: **http://localhost:5000/api/docs**

---

## Authentication method (for client demo)

Pro-Licious uses **JWT Bearer Token** authentication — not cookie sessions.

| What | Details |
|------|---------|
| **Type** | JWT (JSON Web Token) |
| **Header** | `Authorization: Bearer <accessToken>` |
| **Access token TTL** | 4 hours |
| **Refresh token TTL** | 30 days (stored in `user_sessions` table) |
| **Roles** | `CUSTOMER`, `VENDOR`, `RIDER`, `SUPER_ADMIN` |

### Two login methods

**1. Mobile OTP (Flutter / Customer / Vendor / Rider apps)**
```
POST /api/auth/send-otp     → OTP sent to phone
POST /api/auth/verify-otp   → Returns accessToken + refreshToken
```
- OTP expires in **10 minutes**
- In development, OTP is printed in the **server terminal**: `[DEV OTP] 9876543210: 123456`
- New users must send `name` + `role` in verify-otp

**2. Email + Password (Web / Admin dashboard)**
```
POST /api/auth/login        → Returns accessToken + refreshToken
```
- Requires `email` + `password` (password must be set in DB)

**Token refresh (when access token expires)**
```
POST /api/auth/refresh-token   → Body: { "refreshToken": "..." }
```

**Logout**
```
POST /api/auth/logout          → Requires Bearer token + optional refreshToken in body
```

---

## Test Auth APIs — Step by Step

### Option A: Swagger UI (best for client demo)

1. Start server: `npm run dev`
2. Open **http://localhost:5000/api/docs**
3. Expand **Auth** section
4. **Send OTP** — click `POST /api/auth/send-otp` → Try it out:
   ```json
   { "phone": "9876543210" }
   ```
5. Check terminal for OTP: `[DEV OTP] 9876543210: 654321`
6. **Verify OTP** — `POST /api/auth/verify-otp`:
   ```json
   {
     "phone": "9876543210",
     "otp": "654321",
     "name": "Demo Customer",
     "role": "CUSTOMER"
   }
   ```
7. Copy `data.accessToken` from response
8. Click **Authorize** button (top right, lock icon)
9. Enter: `Bearer eyJhbGciOiJIUzI1NiIs...` (paste your token)
10. Now test `GET /api/auth/me` or any Customer/Vendor/Rider/Admin endpoint

### Option B: Postman / curl

```bash
# 1. Send OTP
curl -X POST http://localhost:5000/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone":"9876543210"}'

# 2. Verify OTP (check terminal for OTP)
curl -X POST http://localhost:5000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"phone":"9876543210","otp":"123456","name":"Test User","role":"CUSTOMER"}'

# 3. Use token
curl http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# 4. Refresh token
curl -X POST http://localhost:5000/api/auth/refresh-token \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"YOUR_REFRESH_TOKEN"}'
```

### Test all 4 roles

Repeat verify-otp with different roles for client demo:

| Role | `"role"` value | Test endpoint after login |
|------|----------------|---------------------------|
| Customer | `"CUSTOMER"` | `GET /api/customer/profile` |
| Vendor | `"VENDOR"` | `GET /api/vendor/profile` |
| Rider | `"RIDER"` | `GET /api/rider/orders` |
| Admin | Use email login | `GET /api/admin/dashboard/live` |

> Admin requires a user with role `SUPER_ADMIN` in DB (see Prerequisites below).

---

## Prerequisites

```bash
# 1. Install deps
npm install

# 2. Copy env
cp .env.example .env
# Fill DATABASE_URL, REDIS_URL, JWT secrets, Razorpay keys

# 3. Apply DB migration
npm run db:migrate
# OR: npm run db:push

# 4. Seed roles (run once in psql)
INSERT INTO roles (role_name, description) VALUES
  ('CUSTOMER','End customer'), ('VENDOR','Shop owner'),
  ('RIDER','Delivery partner'), ('SUPER_ADMIN','Admin')
ON CONFLICT (role_name) DO NOTHING;

# 5. Start server
npm run dev
```

Health: `GET http://localhost:5000/health`  
Swagger: `http://localhost:5000/api/docs` ← **all 87 APIs documented here**

---

## Auth flow (detailed reference)

### 1. Send OTP
```http
POST /api/auth/send-otp
Content-Type: application/json

{ "phone": "9876543210" }
```
Dev OTP prints in terminal: `[DEV OTP] 9876543210: 123456`

### 2. Verify OTP (signup/login)
```http
POST /api/auth/verify-otp
Content-Type: application/json

{
  "phone": "9876543210",
  "otp": "123456",
  "name": "Test Customer",
  "role": "CUSTOMER"
}
```
Save `accessToken` and `refreshToken` from response.

### 3. Email login (optional — set password via DB first)
```http
POST /api/auth/login
{ "email": "admin@prolicious.com", "password": "password123" }
```

### 4. Use token on all protected routes
```
Authorization: Bearer <accessToken>
```

### 5. Refresh token
```http
POST /api/auth/refresh-token
{ "refreshToken": "<refreshToken>" }
```

### 6. Get current user
```http
GET /api/auth/me
Authorization: Bearer <token>
```

### 7. Logout
```http
POST /api/auth/logout
Authorization: Bearer <token>
{ "refreshToken": "<refreshToken>" }
```

---

## Customer APIs (22) — role: CUSTOMER

| # | Method | Endpoint | Body / Query |
|---|--------|----------|--------------|
| 1 | GET | `/api/customer/profile` | — |
| 2 | PATCH | `/api/customer/profile` | `{ "name", "gender", "profileImage" }` |
| 3 | GET | `/api/customer/addresses` | — |
| 4 | POST | `/api/customer/addresses` | `{ "city", "state", "pincode", "street", "addressType" }` |
| 5 | PATCH | `/api/customer/addresses/:id` | address fields |
| 6 | DELETE | `/api/customer/addresses/:id` | — |
| 7 | GET | `/api/customer/vendors` | `?zoneId=1` |
| 8 | GET | `/api/customer/vendors/:id` | — |
| 9 | GET | `/api/customer/vendors/:id/menu` | — |
| 10 | GET | `/api/customer/search` | `?query=chicken` |
| 11 | GET | `/api/customer/categories` | — |
| 12 | GET | `/api/customer/cart` | — |
| 13 | POST | `/api/customer/cart/items` | `{ "vendorId", "menuItemId", "quantity" }` |
| 14 | PATCH | `/api/customer/cart/items/:id` | `{ "quantity": 2 }` |
| 15 | DELETE | `/api/customer/cart/items/:id` | — |
| 16 | DELETE | `/api/customer/cart` | `?vendorId=1` |
| 17 | POST | `/api/customer/orders` | `{ "vendorId", "addressId", "paymentMethod": "UPI" }` |
| 18 | GET | `/api/customer/orders` | — |
| 19 | GET | `/api/customer/orders/:id` | — |
| 20 | GET | `/api/customer/orders/:id/tracking` | — |
| 21 | POST | `/api/customer/orders/:id/cancel` | — |
| 22 | POST | `/api/customer/payments/initiate` | `{ "orderId": 1 }` |
| 23 | POST | `/api/customer/payments/verify` | `{ "orderId", "razorpayOrderId", "razorpayPaymentId", "razorpaySignature" }` |
| 24 | POST | `/api/customer/complaints` | `{ "category", "description", "orderId" }` |
| 25 | GET | `/api/customer/complaints` | — |
| 26 | POST | `/api/customer/support/tickets` | `{ "subject", "priority" }` |
| 27 | GET | `/api/customer/notifications` | — |
| 28 | PATCH | `/api/customer/notifications/:id/read` | — |
| 29 | POST | `/api/customer/favorites/:vendorId` | — |
| 30 | DELETE | `/api/customer/favorites/:vendorId` | — |

---

## Vendor APIs (24) — role: VENDOR

Signup with `"role": "VENDOR"` in verify-otp, then:

| # | Method | Endpoint |
|---|--------|----------|
| 1 | GET | `/api/vendor/profile` |
| 2 | PATCH | `/api/vendor/profile` |
| 3 | GET | `/api/vendor/branches` |
| 4 | PATCH | `/api/vendor/branches/:id/status` `{ "status": "ACTIVE" }` |
| 5 | GET | `/api/vendor/operating-hours` |
| 6 | PUT | `/api/vendor/operating-hours` `{ "branchId", "hours": [{ "dayOfWeek", "openTime", "closeTime" }] }` |
| 7-10 | CRUD | `/api/vendor/categories` |
| 11-15 | CRUD | `/api/vendor/menu`, `/api/vendor/menu/:id/availability` |
| 16 | GET | `/api/vendor/orders?status=PLACED` |
| 17 | GET | `/api/vendor/orders/:id` |
| 18-21 | PATCH | `/api/vendor/orders/:id/accept|reject|preparing|ready` |
| 22 | GET | `/api/vendor/analytics/summary` |
| 23 | GET | `/api/vendor/analytics/daily` |
| 24 | GET | `/api/vendor/transactions`, `/settlements`, `/performance` |

---

## Rider APIs (18) — role: RIDER

| # | Method | Endpoint |
|---|--------|----------|
| 1 | PATCH | `/api/rider/availability` `{ "isOnline": true }` |
| 2 | POST | `/api/rider/location` `{ "latitude", "longitude", "orderId" }` |
| 3 | GET | `/api/rider/orders` |
| 4 | GET | `/api/rider/orders/:id` |
| 5-9 | PATCH | `accept`, `reject`, `arrived-vendor`, `picked-up`, `arrived-customer` |
| 10 | POST | `/api/rider/orders/:id/deliver` `{ "otp": "123456" }` |
| 11-16 | GET | `/earnings`, `/earnings/summary`, `/shifts`, `/settlements`, `/payouts`, `/notifications` |

---

## Admin APIs (17+) — role: SUPER_ADMIN

Create admin user in DB:
```sql
INSERT INTO users (name, phone, email, role, status)
VALUES ('Admin', '9999999999', 'admin@prolicious.com', 'SUPER_ADMIN', 'ACTIVE');
-- Set password hash via auth or bcrypt
```

| # | Method | Endpoint |
|---|--------|----------|
| 1 | GET | `/api/admin/dashboard/live` |
| 2 | GET | `/api/admin/analytics/daily` |
| 3 | GET | `/api/admin/analytics/demand-supply` |
| 4-6 | GET/PATCH | `/api/admin/orders`, `/orders/:id`, `/orders/:id/cancel` |
| 7 | POST | `/api/admin/refunds` `{ "paymentId", "amount", "reason" }` |
| 8-12 | Vendor mgmt | `/vendors`, POST, status, documents |
| 13-17 | Rider mgmt | `/riders`, POST, status, documents |
| 18-21 | Support | `/tickets`, `/complaints`, respond endpoints |
| 22-23 | Audit | `/audit-logs`, `/fraud-flags`, PATCH `/fraud-flags/:id` |

---

## Socket.IO testing

Connect client:
```javascript
import { io } from "socket.io-client";
const socket = io("http://localhost:5000");

socket.emit("join_order_room", { orderId: 1, userId: 1, role: "CUSTOMER" });
socket.on("order_status_changed", console.log);
socket.on("rider_location", console.log);

// Rider events
socket.emit("rider_go_online", { riderId: 1 });
socket.emit("rider_location_update", { orderId: 1, riderId: 1, latitude: 12.97, longitude: 77.59 });
socket.emit("verify_delivery_otp", { orderId: 1, otp: "123456" });
```

---

## Postman collection tip

1. Create environment variable `baseUrl` = `http://localhost:5000`
2. Create `accessToken` variable — set from verify-otp response via Tests tab:
   ```js
   pm.environment.set("accessToken", pm.response.json().data.accessToken);
   ```
3. Collection auth: Bearer `{{accessToken}}`

---

## Quick test sequence (happy path)

1. `POST /api/auth/send-otp` → copy OTP from terminal  
2. `POST /api/auth/verify-otp` (CUSTOMER) → save token  
3. `POST /api/customer/addresses` → save addressId  
4. Vendor signs up, adds menu item (vendor token)  
5. `POST /api/customer/cart/items`  
6. `POST /api/customer/orders`  
7. Vendor: `PATCH /api/vendor/orders/:id/accept` → `preparing` → `ready`  
8. Rider: accept → pickup → deliver  
9. `POST /api/customer/payments/initiate` + verify  

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| `TOKEN_EXPIRED` | Call `/api/auth/refresh-token` |
| `PERMISSION_DENIED` | Wrong role token — re-login with correct role |
| `Customer profile not found` | Verify OTP with role CUSTOMER first |
| Redis connection failed | Check REDIS_URL in `.env` |
| DB relation does not exist | Run `npm run db:migrate` |
