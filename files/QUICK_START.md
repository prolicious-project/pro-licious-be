# 🚀 Prolious Backend — Quick Start Guide

## Step 1: Download & Extract
All backend files are ready. Extract the generated files to your project folder.

## Step 2: Copy Environment Template
```bash
cp .env.example .env
```

## Step 3: Fill `.env` with Your Credentials
Open `.env` and update:

```dotenv
DATABASE_URL=postgresql://postgres:9803@localhost:5432/prolicious

JWT_SECRET=22acf41ebb7d622101279e4e543489c60b05e591878a87398ab225b20d343e8a62c222abe976f737613e4c297e9b6a0b58969223b8f863b5d154d086011f3139
JWT_REFRESH_SECRET=your-refresh-secret-min-32-chars-change-this

RAZORPAY_KEY_ID=rzp_test_SRrKIfsKje5uNq
RAZORPAY_KEY_SECRET=KfntU4VVvNMAX64AvdhClFNd
RAZORPAY_WEBHOOK_SECRET=BALAJI

REDIS_URL=redis://default:AUjZWqjdnaBIzMWFcldhgSVMOhsoWiu7@copper-weatherproof-zippy-23102.db.redis.io:15830

NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:3000
```

## Step 4: Install Node Dependencies
```bash
npm install
```

This installs all required packages:
- express, socket.io, pg, redis, jsonwebtoken, bcryptjs, razorpay, etc.

## Step 5: Setup PostgreSQL Database

### 5a. Create Database (if not exists)
```bash
createdb prolicious
```

### 5b. Run Migration
The migration file (`prolious_migration.sql`) creates all 48 tables with indexes and triggers:

```bash
psql -U postgres -d prolicious -f prolious_migration.sql
```

Verify tables created:
```bash
psql -U postgres -d prolicious -c "\dt"
```

You should see 48 tables listed.

## Step 6: Verify Redis Connection
```bash
redis-cli -u "redis://default:AUjZWqjdnaBIzMWFcldhgSVMOhsoWiu7@copper-weatherproof-zippy-23102.db.redis.io:15830" ping
```

Should return: `PONG`

## Step 7: Start Server
```bash
npm run dev
```

You should see:
```
✅ Redis connected
✅ Server running on port 5000
📡 Socket.IO ready for connections
```

## Step 8: Test API

### Health Check
```bash
curl http://localhost:5000/health
```

Response:
```json
{
  "status": "OK",
  "timestamp": "2024-06-01T10:30:00Z"
}
```

### Send OTP
```bash
curl -X POST http://localhost:5000/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "9876543210"}'
```

Response:
```json
{
  "success": true,
  "message": "OTP sent successfully",
  "data": {
    "message": "OTP sent to phone",
    "phone": "9876543210",
    "expiresIn": "10 minutes"
  }
}
```

### Verify OTP & Signup (Check console for OTP in dev mode)
```bash
curl -X POST http://localhost:5000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "9876543210",
    "otp": "123456",
    "name": "John Doe",
    "role": "CUSTOMER"
  }'
```

Response:
```json
{
  "success": true,
  "message": "OTP verified successfully",
  "data": {
    "userId": 1,
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc...",
    "role": "CUSTOMER",
    "expiresIn": "4 hours"
  }
}
```

---

## 📁 Folder Structure After Setup

```
pro-licious-be/
├── src/
│   ├── config/
│   │   ├── database.js
│   │   ├── redis.js
│   │   └── razorpay.js
│   ├── middleware/
│   │   ├── auth.js
│   │   ├── roleGuard.js
│   │   └── errorHandler.js
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── customer.routes.js
│   │   ├── vendor.routes.js
│   │   ├── rider.routes.js
│   │   └── admin.routes.js
│   ├── controllers/
│   │   ├── authController.js (Complete implementation)
│   │   ├── customerController.js (Complete implementation)
│   │   ├── vendorController.js (Stub - ready for implementation)
│   │   ├── riderController.js (Stub - ready for implementation)
│   │   └── adminController.js (Stub - ready for implementation)
│   ├── utils/
│   │   ├── jwt.js
│   │   ├── otp.js
│   │   ├── passwordHash.js
│   │   └── responses.js
│   ├── socket/
│   │   └── handlers.js
│   └── app.js
├── package.json ✅
├── index.js ✅
├── .env ✅ (Create from .env.example)
├── .env.example ✅
├── README.md ✅ (Full documentation)
├── prolious_migration.sql ✅ (Database setup)
└── node_modules/
```

---

## 🔌 Testing APIs with Postman

### 1. Import in Postman
Create requests for each endpoint group:

**Auth**
```
POST http://localhost:5000/api/auth/send-otp
POST http://localhost:5000/api/auth/verify-otp
GET  http://localhost:5000/api/auth/me
```

**Customer** (with Authorization header)
```
GET http://localhost:5000/api/customer/profile
POST http://localhost:5000/api/customer/addresses
GET http://localhost:5000/api/customer/vendors
```

### 2. Add Authorization Header
After getting `accessToken` from login/verify-otp:
```
Headers:
Authorization: Bearer <accessToken>
```

---

## 🐛 Common Issues & Fixes

### Issue: "ECONNREFUSED - Cannot connect to Redis"
```
✅ Fix: Check REDIS_URL in .env
✅ Fix: Verify Redis Cloud is running
✅ Fix: Test: redis-cli -u <URL> ping
```

### Issue: "database does not exist"
```
✅ Fix: createdb prolicious
✅ Fix: Run migration: psql -U postgres -d prolicious -f prolious_migration.sql
```

### Issue: "relation 'users' does not exist"
```
✅ Fix: Migration wasn't applied
✅ Fix: Rerun migration file
```

### Issue: "Invalid JWT token"
```
✅ Fix: Check token is in Authorization header (with "Bearer " prefix)
✅ Fix: Verify JWT_SECRET matches .env
✅ Fix: Check token hasn't expired (4 hours)
```

### Issue: "OTP not received"
```
✅ In dev mode: OTP is printed to console
✅ In production: Setup SendGrid/Twilio SMS gateway
```

---

## 📚 What's Implemented vs What's Stubbed

### ✅ Fully Implemented (Ready to use)
- Authentication (6 APIs) — OTP, email/password, token refresh, logout
- Customer APIs (22 APIs) — All business logic complete
- Profile, Cart, Orders, Payments, Tracking, Support
- Error handling, validation, standard responses
- Socket.IO setup with 12 event handlers
- JWT auth middleware, role guards
- Database connection pool with PostgreSQL

### 📝 Stubbed (Need implementation)
- Vendor controller (24 APIs) — Boilerplate ready, add business logic
- Rider controller (18 APIs) — Boilerplate ready, add business logic
- Admin controller (17 APIs) — Boilerplate ready, add business logic
- File upload to S3 (currently local storage)
- SMS/Email notifications (console logging only)
- OTP delivery via Twilio/SendGrid
- Razorpay webhook handler
- Rate limiting on APIs
- Request logging & monitoring

Each stubbed controller follows the exact same pattern as `customerController.js` — just copy the pattern for the remaining ones.

---

## 🚀 Next Steps

### Development
1. **Test auth flow** — OTP → Verify → Login
2. **Test customer APIs** — Browse vendors → Search → Add to cart → Place order
3. **Implement vendor controller** — Follow pattern from customerController
4. **Implement rider controller** — Follow pattern
5. **Implement admin controller** — Follow pattern
6. **Setup file uploads** — Configure AWS S3
7. **Setup notifications** — Integrate SendGrid + Twilio

### Before Going to Production
1. **Setup CI/CD** — GitHub Actions to auto-test and deploy
2. **Enable HTTPS** — SSL certificates for all endpoints
3. **Configure monitoring** — Sentry for error tracking, DataDog for logs
4. **Setup backups** — PostgreSQL daily backups
5. **Load testing** — Verify API can handle 1000+ concurrent users
6. **Security audit** — Check for SQL injection, XSS, CSRF vulnerabilities

---

## 📖 Full Documentation

Detailed API reference, Socket.IO guide, deployment instructions → see `README.md`

## 🆘 Need Help?

- Check `README.md` for complete API reference
- Review `src/controllers/customerController.js` for implementation patterns
- Test endpoints using Postman/Insomnia
- Check server logs for error messages

---

**You're all set!** 🎉

Next step: Run `npm run dev` and start testing the APIs.
