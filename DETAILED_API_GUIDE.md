# Pro-Licious API Reference & Usage Guide

Welcome to the detailed **Pro-Licious API Usage Document**. This guide covers all API categories (Authentication, Customer, Vendor, Rider, Admin), detailing how to use them, what input they expect (or don't expect), and where they fit in your client apps (Flutter apps, Web Admin Dashboard).

---

## 1. How Authentication Works

All protected APIs require a **JWT Bearer Token** passed in the headers.

*   **Header Name**: `Authorization`
*   **Header Value Format**: `Bearer <accessToken>`
*   **Example**: `Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

---

## 2. What are the "No-Input" / "Header-Only" APIs?

### Why do some APIs require no input body?
You asked: *"some apis' we dont ahve to give any input only wha is that??"*

In modern web development, many endpoints do **not require you to send any request body (`{}`)**. This is because:
1.  **Context from Authorization Header**: When you send `Authorization: Bearer <token>`, the backend decodes the token, knows exactly who the user is (`userId`, `role`), and queries their specific data (like their profile, cart, notifications, or orders). Sending their ID in a body is unnecessary and insecure.
2.  **GET Requests**: Standard REST convention dictates that `GET` requests retrieve data and should not contain a request body. Any filters are passed via the URL path (e.g., `/orders/12`) or query parameters (e.g., `?status=PLACED`).
3.  **DELETE Requests**: Standard `DELETE` requests remove a resource identified by a URL parameter (e.g., `/cart/items/5`) and do not require a request body.
4.  **State Toggles / Simple Triggers**: Some actions just trigger a simple transition (like accept, reject, preparing, or readying an order). The endpoint itself (`POST /orders/:id/cancel` or `PATCH /orders/:id/accept`) tells the backend what to do, requiring only the ID in the URL.

### List of "No-Input" (No Body) APIs:

| Category | Method | Endpoint | How Parameters are Sent | Usage Context |
| :--- | :--- | :--- | :--- | :--- |
| **Auth** | `GET` | `/api/auth/me` | None (Bearer Header Only) | Fetch current user details on app launch. |
| **Customer** | `GET` | `/api/customer/profile` | None (Bearer Header Only) | Load user details on Profile Screen. |
| **Customer** | `GET` | `/api/customer/addresses` | None (Bearer Header Only) | Load saved addresses on Checkout Screen. |
| **Customer** | `DELETE` | `/api/customer/addresses/:id` | Path parameter `:id` | Triggered when user deletes an address. |
| **Customer** | `GET` | `/api/customer/vendors` | Optional query `?zoneId=X` | Display active shops on the home feed. |
| **Customer** | `GET` | `/api/customer/vendors/:id` | Path parameter `:id` | Open detailed vendor/restaurant page. |
| **Customer** | `GET` | `/api/customer/vendors/:id/menu` | Path parameter `:id` | Load menu items grouped by categories. |
| **Customer** | `GET` | `/api/customer/categories` | None (Bearer Header Only) | View global categories list. |
| **Customer** | `GET` | `/api/customer/cart` | None (Bearer Header Only) | Fetch items currently in the cart. |
| **Customer** | `DELETE` | `/api/customer/cart/items/:id` | Path parameter `:id` | Click the trash icon to remove item. |
| **Customer** | `DELETE` | `/api/customer/cart` | Optional query `?vendorId=X` | Empty/clear the entire cart. |
| **Customer** | `GET` | `/api/customer/orders` | None (Bearer Header Only) | Render "My Orders" history list. |
| **Customer** | `GET` | `/api/customer/orders/:id` | Path parameter `:id` | Load details of a specific past order. |
| **Customer** | `GET` | `/api/customer/orders/:id/tracking` | Path parameter `:id` | Live tracking screen timeline updates. |
| **Customer** | `POST` | `/api/customer/orders/:id/cancel` | Path parameter `:id` | Cancel order before prep starts. |
| **Customer** | `GET` | `/api/customer/complaints` | None (Bearer Header Only) | List user complaints status. |
| **Customer** | `GET` | `/api/customer/notifications` | None (Bearer Header Only) | Fetch customer in-app notifications. |
| **Customer** | `PATCH` | `/api/customer/notifications/:id/read`| Path parameter `:id` | Mark notification as read. |
| **Customer** | `POST` | `/api/customer/favorites/:vendorId` | Path parameter `:vendorId` | Bookmark/Heart a vendor. |
| **Customer** | `DELETE`| `/api/customer/favorites/:vendorId` | Path parameter `:vendorId` | Unfavorite a vendor. |
| **Vendor** | `GET` | `/api/vendor/profile` | None (Bearer Header Only) | Show shop information in Vendor App. |
| **Vendor** | `GET` | `/api/vendor/branches` | None (Bearer Header Only) | List all vendor branch locations. |
| **Vendor** | `GET` | `/api/vendor/operating-hours` | None (Bearer Header Only) | Show open/close schedules. |
| **Vendor** | `GET` | `/api/vendor/categories` | None (Bearer Header Only) | List menu categories. |
| **Vendor** | `DELETE` | `/api/vendor/categories/:id` | Path parameter `:id` | Delete a food category. |
| **Vendor** | `GET` | `/api/vendor/menu` | None (Bearer Header Only) | List all menu items. |
| **Vendor** | `DELETE` | `/api/vendor/menu/:id` | Path parameter `:id` | Delete a menu item. |
| **Vendor** | `GET` | `/api/vendor/orders` | Optional query `?status=X` | Real-time incoming order dashboard. |
| **Vendor** | `GET` | `/api/vendor/orders/:id` | Path parameter `:id` | Open order detail modal/screen. |
| **Vendor** | `PATCH` | `/api/vendor/orders/:id/accept` | Path parameter `:id` | Accept new order (moves to preparing). |
| **Vendor** | `PATCH` | `/api/vendor/orders/:id/reject` | Path parameter `:id` | Reject new order. |
| **Vendor** | `PATCH` | `/api/vendor/orders/:id/preparing`| Path parameter `:id` | Mark that chef has started cooking. |
| **Vendor** | `PATCH` | `/api/vendor/orders/:id/ready` | Path parameter `:id` | Mark food ready for Rider pickup. |
| **Vendor** | `GET` | `/api/vendor/analytics/summary` | None (Bearer Header Only) | Display main dashboard metric cards. |
| **Vendor** | `GET` | `/api/vendor/analytics/daily` | None (Bearer Header Only) | Fetch sales data for charts/graphs. |
| **Vendor** | `GET` | `/api/vendor/transactions` | None (Bearer Header Only) | List ledger of payments for orders. |
| **Vendor** | `GET` | `/api/vendor/settlements` | None (Bearer Header Only) | List payouts transferred to bank account. |
| **Vendor** | `GET` | `/api/vendor/performance` | None (Bearer Header Only) | Show Acceptance/SLA Ratings. |
| **Rider** | `GET` | `/api/rider/orders` | None (Bearer Header Only) | Retrieve assigned delivery requests. |
| **Rider** | `GET` | `/api/rider/orders/:id` | Path parameter `:id` | Details on pickup & drop-off locations. |
| **Rider** | `PATCH` | `/api/rider/orders/:id/accept` | Path parameter `:id` | Rider accepts delivery offer. |
| **Rider** | `PATCH` | `/api/rider/orders/:id/reject` | Path parameter `:id` | Rider declines delivery offer. |
| **Rider** | `PATCH` | `/api/rider/orders/:id/arrived-vendor` | Path parameter `:id` | Rider reached vendor location. |
| **Rider** | `PATCH` | `/api/rider/orders/:id/picked-up` | Path parameter `:id` | Rider picked up food packages. |
| **Rider** | `PATCH` | `/api/rider/orders/:id/arrived-customer`| Path parameter `:id` | Rider reached customer doorstep. |
| **Rider** | `GET` | `/api/rider/earnings` | None (Bearer Header Only) | Payouts list per completed order. |
| **Rider** | `GET` | `/api/rider/earnings/summary` | None (Bearer Header Only) | Today's & Lifetime earnings summary. |
| **Rider** | `GET` | `/api/rider/shifts` | None (Bearer Header Only) | Driver online/offline time clock logs. |
| **Rider** | `GET` | `/api/rider/settlements` | None (Bearer Header Only) | Rider weekly banking settlements. |
| **Rider** | `GET` | `/api/rider/payouts` | None (Bearer Header Only) | Direct bank transfer records. |
| **Rider** | `GET` | `/api/rider/notifications` | None (Bearer Header Only) | Push notification logs. |
| **Admin** | `GET` | `/api/admin/dashboard/live` | None (Bearer Header Only) | Live monitor panel for Super Admins. |
| **Admin** | `GET` | `/api/admin/analytics/daily` | None (Bearer Header Only) | Platform-wide transaction graphs. |
| **Admin** | `GET` | `/api/admin/analytics/demand-supply` | None (Bearer Header Only)| Active riders vs active orders ratio charts. |
| **Admin** | `GET` | `/api/admin/orders` | Optional query `?status=X` | View all platform orders. |
| **Admin** | `GET` | `/api/admin/orders/:id` | Path parameter `:id` | Inspect complete order metadata. |
| **Admin** | `GET` | `/api/admin/vendors` | None (Bearer Header Only) | Load list of all registered merchants. |
| **Admin** | `GET` | `/api/admin/vendors/:id/documents` | Path parameter `:id` | View legal uploads (FSSAI, GSTIN). |
| **Admin** | `GET` | `/api/admin/riders` | None (Bearer Header Only) | Load list of all registered drivers. |
| **Admin** | `GET` | `/api/admin/riders/:id/documents` | Path parameter `:id` | View DL/RC/Aadhaar/PAN submissions. |
| **Admin** | `GET` | `/api/admin/tickets` | None (Bearer Header Only) | Load customer support queue. |
| **Admin** | `GET` | `/api/admin/complaints` | None (Bearer Header Only) | Load order issues queue. |
| **Admin** | `GET` | `/api/admin/audit-logs` | None (Bearer Header Only) | System operations history log. |
| **Admin** | `GET` | `/api/admin/fraud-flags` | None (Bearer Header Only) | List accounts tagged with suspicious triggers.|

---

## 3. Comprehensive Endpoint Specifications

Below is the detailed documentation for every API, categorized by role.

---

### Category A: Authentication APIs (Public & Protected)

Used across all platforms (Flutter app, Web portals) to log users in and secure request channels.

#### 1. Send OTP
*   **Method**: `POST`
*   **Endpoint**: `/api/auth/send-otp`
*   **Auth Required**: No (Public)
*   **Request Body**:
    ```json
    {
      "phone": "9876543210"
    }
    ```
*   **Expected Response (200 OK)**:
    ```json
    {
      "success": true,
      "message": "OTP sent successfully"
    }
    ```
*   **How & Where to Use**: Use on the login screen. When the user enters their phone number and clicks "Send OTP", trigger this API. 
    > **Note (Dev Mode)**: The OTP is printed to the terminal console: `[DEV OTP] 9876543210: 123456`.

#### 2. Verify OTP (Register/Login)
*   **Method**: `POST`
*   **Endpoint**: `/api/auth/verify-otp`
*   **Auth Required**: No (Public)
*   **Request Body**:
    ```json
    {
      "phone": "9876543210",
      "otp": "123456",
      "name": "Alex Mercer",     // Required for new signups
      "role": "CUSTOMER"         // Options: CUSTOMER, VENDOR, RIDER (Required for new signups)
    }
    ```
*   **Expected Response (200 OK)**:
    ```json
    {
      "success": true,
      "data": {
        "user": {
          "id": 1,
          "name": "Alex Mercer",
          "phone": "9876543210",
          "role": "CUSTOMER"
        },
        "accessToken": "eyJhbGciOiJIUzI1Ni...",
        "refreshToken": "7c13a005-728b..."
      }
    }
    ```
*   **How & Where to Use**: Called after the user receives the OTP SMS, types the 6-digit code, and submits. Save the returned `accessToken` and `refreshToken` in secure storage (Keychain/SharedPreferences) to authenticate future requests.

#### 3. Email + Password Login
*   **Method**: `POST`
*   **Endpoint**: `/api/auth/login`
*   **Auth Required**: No (Public)
*   **Request Body**:
    ```json
    {
      "email": "admin@prolicious.com",
      "password": "securepassword123"
    }
    ```
*   **Expected Response (200 OK)**:
    ```json
    {
      "success": true,
      "data": {
        "user": { "id": 10, "name": "Super Admin", "role": "SUPER_ADMIN" },
        "accessToken": "eyJ...",
        "refreshToken": "..."
      }
    }
    ```
*   **How & Where to Use**: Used primarily on the Web Admin Dashboard login page.

#### 4. Refresh Token
*   **Method**: `POST`
*   **Endpoint**: `/api/auth/refresh-token`
*   **Auth Required**: No (Uses Refresh Token)
*   **Request Body**:
    ```json
    {
      "refreshToken": "7c13a005-728b-4a5d-b0db-6e6917f8a7e0"
    }
    ```
*   **Expected Response (200 OK)**:
    ```json
    {
      "success": true,
      "data": {
        "accessToken": "new_eyJhbGciOiJIUzI1Ni...",
        "refreshToken": "new_9b38c211-..."
      }
    }
    ```
*   **How & Where to Use**: Use in your HTTP interceptor when an API responds with `401 Unauthorized` due to token expiration. Silently call this endpoint to grab a fresh `accessToken`, retry the failed API call, and update local storage.

#### 5. Get Current User Details
*   **Method**: `GET`
*   **Endpoint**: `/api/auth/me`
*   **Auth Required**: Yes
*   **Request Body**: **NONE** (Header-Only)
*   **Expected Response (200 OK)**:
    ```json
    {
      "success": true,
      "data": {
        "id": 1,
        "name": "Alex Mercer",
        "phone": "9876543210",
        "role": "CUSTOMER"
      }
    }
    ```
*   **How & Where to Use**: Triggered immediately when starting/relaunching the app to confirm if the stored access token is still valid, and to pre-load global application user state.

#### 6. Logout
*   **Method**: `POST`
*   **Endpoint**: `/api/auth/logout`
*   **Auth Required**: Yes
*   **Request Body**:
    ```json
    {
      "refreshToken": "7c13a005-728b-4a5d-b0db-6e6917f8a7e0"
    }
    ```
*   **Expected Response (200 OK)**:
    ```json
    {
      "success": true,
      "message": "Logged out successfully"
    }
    ```
*   **How & Where to Use**: Use when the user clicks the "Logout" button. This invalidates the session inside the database. After calling it, wipe stored tokens from local device storage and route back to the Login Screen.

---

### Category B: Customer APIs

Requires `role` of the authenticated user to be `"CUSTOMER"`.

#### 1. Get Profile
*   **Method**: `GET`
*   **Endpoint**: `/api/customer/profile`
*   **Auth Required**: Yes
*   **Request Body**: **NONE**
*   **Expected Response (200 OK)**:
    ```json
    {
      "success": true,
      "data": {
        "id": 1,
        "name": "Alex Mercer",
        "phone": "9876543210",
        "email": "alex@prolicious.com",
        "gender": "MALE",
        "profileImage": "https://cdn.com/profile.jpg"
      }
    }
    ```
*   **How & Where to Use**: To load info on the Customer Account details page.

#### 2. Update Profile
*   **Method**: `PATCH`
*   **Endpoint**: `/api/customer/profile`
*   **Auth Required**: Yes
*   **Request Body**:
    ```json
    {
      "name": "Alex Mercer Jr",
      "gender": "MALE",
      "profileImage": "https://cdn.com/newprofile.jpg"
    }
    ```
*   **How & Where to Use**: Triggered when saving changes on the edit profile screen.

#### 3. List Saved Addresses
*   **Method**: `GET`
*   **Endpoint**: `/api/customer/addresses`
*   **Auth Required**: Yes
*   **Request Body**: **NONE**
*   **Expected Response (200 OK)**:
    ```json
    {
      "success": true,
      "data": [
        {
          "id": 5,
          "addressType": "HOME",
          "houseNumber": "Flat 402",
          "street": "Green Glen Layout",
          "city": "Bengaluru",
          "state": "Karnataka",
          "pincode": "560103",
          "isDefault": true
        }
      ]
    }
    ```
*   **How & Where to Use**: On checkout page so the user can choose where to deliver their order.

#### 4. Add Address
*   **Method**: `POST`
*   **Endpoint**: `/api/customer/addresses`
*   **Auth Required**: Yes
*   **Request Body**:
    ```json
    {
      "addressType": "HOME",
      "houseNumber": "Flat 402",
      "street": "Green Glen Layout",
      "landmark": "Near Lake Park",
      "city": "Bengaluru",
      "state": "Karnataka",
      "pincode": "560103",
      "latitude": "12.9279",
      "longitude": "77.6801",
      "isDefault": true
    }
    ```
*   **How & Where to Use**: Saved address creation screen.

#### 5. Update Address
*   **Method**: `PATCH`
*   **Endpoint**: `/api/customer/addresses/:id`
*   **Auth Required**: Yes
*   **Path Parameter**: `:id` (e.g., `/api/customer/addresses/5`)
*   **Request Body**: Address fields you want to update (e.g., `{ "houseNumber": "Villa 10" }`).

#### 6. Delete Address
*   **Method**: `DELETE`
*   **Endpoint**: `/api/customer/addresses/:id`
*   **Auth Required**: Yes
*   **Path Parameter**: `:id` (e.g., `/api/customer/addresses/5`)
*   **Request Body**: **NONE**

#### 7. List Active Vendors (Restaurants/Shops)
*   **Method**: `GET`
*   **Endpoint**: `/api/customer/vendors`
*   **Auth Required**: Yes
*   **Query Parameter**: `?zoneId=1` (Optional)
*   **Request Body**: **NONE**
*   **Expected Response (200 OK)**:
    ```json
    {
      "success": true,
      "data": [
        {
          "id": 2,
          "name": "Fresh Bakers",
          "description": "Healthy food & pastries",
          "logoUrl": "...",
          "rating": "4.5"
        }
      ]
    }
    ```
*   **How & Where to Use**: Render restaurant catalog lists on the main home feed.

#### 8. Get Single Vendor Details
*   **Method**: `GET`
*   **Endpoint**: `/api/customer/vendors/:id`
*   **Path Parameter**: `:id` (Vendor ID)
*   **Request Body**: **NONE**

#### 9. Get Vendor Menu
*   **Method**: `GET`
*   **Endpoint**: `/api/customer/vendors/:id/menu`
*   **Path Parameter**: `:id` (Vendor ID)
*   **Request Body**: **NONE**
*   **Expected Response (200 OK)**:
    ```json
    {
      "success": true,
      "data": {
        "categories": [
          { "id": 10, "name": "Desserts", "description": "Sweet treats" }
        ],
        "items": [
          {
            "id": 101,
            "categoryId": 10,
            "name": "Choco Lava Cake",
            "price": "120.00",
            "isVeg": true,
            "status": "ACTIVE"
          }
        ]
      }
    }
    ```
*   **How & Where to Use**: Open restaurant menu screen when a user taps a restaurant listing.

#### 10. Search Vendors & Menu Items
*   **Method**: `GET`
*   **Endpoint**: `/api/customer/search`
*   **Query Parameter**: `?query=cake` (Required)
*   **Request Body**: **NONE**

#### 11. List All Active Categories
*   **Method**: `GET`
*   **Endpoint**: `/api/customer/categories`
*   **Request Body**: **NONE**

#### 12. Get Active Cart
*   **Method**: `GET`
*   **Endpoint**: `/api/customer/cart`
*   **Request Body**: **NONE**
*   **Expected Response (200 OK)**:
    ```json
    {
      "success": true,
      "data": [
        {
          "id": 50,
          "vendorId": 2,
          "status": "ACTIVE",
          "items": [
            {
              "id": 201,
              "menuItemId": 101,
              "quantity": 2,
              "price": "120.00"
            }
          ]
        }
      ]
    }
    ```
*   **How & Where to Use**: Pull items to render inside the Cart Page.

#### 13. Add Item to Cart
*   **Method**: `POST`
*   **Endpoint**: `/api/customer/cart/items`
*   **Request Body**:
    ```json
    {
      "vendorId": 2,
      "menuItemId": 101,
      "quantity": 1,
      "customizations": {}  // Optional
    }
    ```
*   **How & Where to Use**: Tapping the "ADD" button on menu items.

#### 14. Update Cart Item Quantity
*   **Method**: `PATCH`
*   **Endpoint**: `/api/customer/cart/items/:id`
*   **Path Parameter**: `:id` (Cart Item ID - `201` from cart schema, not MenuItemID)
*   **Request Body**:
    ```json
    {
      "quantity": 3
    }
    ```
*   **How & Where to Use**: Changing item quantity in the cart screen (+/- selectors).

#### 15. Remove Item from Cart
*   **Method**: `DELETE`
*   **Endpoint**: `/api/customer/cart/items/:id`
*   **Path Parameter**: `:id` (Cart Item ID)
*   **Request Body**: **NONE**

#### 16. Clear Entire Cart
*   **Method**: `DELETE`
*   **Endpoint**: `/api/customer/cart`
*   **Query Parameter**: `?vendorId=2` (Optional. Clears items for this vendor only; clears all active carts if omitted)
*   **Request Body**: **NONE**

#### 17. Place Order
*   **Method**: `POST`
*   **Endpoint**: `/api/customer/orders`
*   **Request Body**:
    ```json
    {
      "vendorId": 2,
      "addressId": 5,
      "paymentMethod": "UPI" // Options: COD, UPI, CARD
    }
    ```
*   **Expected Response (201 Created)**: Returns the placed Order object including subtotal, tax, fees, and final grand total.
*   **How & Where to Use**: Tapping "Place Order" / "Proceed to Payment" in checkout.

#### 18. List My Orders
*   **Method**: `GET`
*   **Endpoint**: `/api/customer/orders`
*   **Request Body**: **NONE**

#### 19. Get Order Details
*   **Method**: `GET`
*   **Endpoint**: `/api/customer/orders/:id`
*   **Path Parameter**: `:id` (Order ID)
*   **Request Body**: **NONE**

#### 20. Live Order Tracking Timeline
*   **Method**: `GET`
*   **Endpoint**: `/api/customer/orders/:id/tracking`
*   **Path Parameter**: `:id` (Order ID)
*   **Request Body**: **NONE**
*   **Expected Response (200 OK)**:
    ```json
    {
      "success": true,
      "data": [
        { "id": 12, "status": "PREPARING", "title": "Preparing Food", "createdAt": "..." },
        { "id": 11, "status": "ACCEPTED", "title": "Order Accepted", "createdAt": "..." },
        { "id": 10, "status": "PLACED", "title": "Order Placed", "createdAt": "..." }
      ]
    }
    ```
*   **How & Where to Use**: Track page timeline milestones (Ordered -> Accepted -> Out for Delivery -> Delivered).

#### 21. Cancel Order
*   **Method**: `POST`
*   **Endpoint**: `/api/customer/orders/:id/cancel`
*   **Path Parameter**: `:id` (Order ID)
*   **Request Body**: **NONE**
*   **How & Where to Use**: Trigger cancellation from active order details page if order hasn't been prepared yet.

#### 22. Initiate Payment (Razorpay)
*   **Method**: `POST`
*   **Endpoint**: `/api/customer/payments/initiate`
*   **Request Body**:
    ```json
    {
      "orderId": 45
    }
    ```
*   **Expected Response (200 OK)**:
    ```json
    {
      "success": true,
      "data": {
        "paymentId": 8,
        "razorpayOrderId": "order_OkJ8219...",
        "amount": "315.00",
        "key": "rzp_test_..."
      }
    }
    ```
*   **How & Where to Use**: Triggered right before launching Razorpay SDK wrapper on mobile. The SDK needs `razorpayOrderId` and your API `key` to process the payment gateway popup.

#### 23. Verify Payment Signature (Razorpay Verification)
*   **Method**: `POST`
*   **Endpoint**: `/api/customer/payments/verify`
*   **Request Body**:
    ```json
    {
      "orderId": 45,
      "razorpayOrderId": "order_OkJ8219...",
      "razorpayPaymentId": "pay_OlkN23...",
      "razorpaySignature": "92cb...20f"
    }
    ```
*   **How & Where to Use**: Once the Razorpay UI successfully closes, pass these parameters returned by Razorpay back to your server for validation.

#### 24. Create Support Ticket
*   **Method**: `POST`
*   **Endpoint**: `/api/customer/support/tickets`
*   **Request Body**:
    ```json
    {
      "subject": "App crashed during payment check",
      "priority": "HIGH" // LOW, MEDIUM, HIGH
    }
    ```

#### 25. Bookmarks/Favorites (Add & Remove)
*   **Add**: `POST /api/customer/favorites/:vendorId`
*   **Remove**: `DELETE /api/customer/favorites/:vendorId`
*   **Request Body**: **NONE**

---

### Category C: Vendor APIs

Requires `role` of the authenticated user to be `"VENDOR"`.

#### 1. Manage branch status
*   **Method**: `PATCH`
*   **Endpoint**: `/api/vendor/branches/:id/status`
*   **Path Parameter**: `:id` (Branch ID)
*   **Request Body**:
    ```json
    {
      "status": "ACTIVE" // ACTIVE or INACTIVE
    }
    ```
*   **How & Where to Use**: Setting a specific store branch offline temporarily due to rush.

#### 2. Manage operating hours
*   **Method**: `PUT`
*   **Endpoint**: `/api/vendor/operating-hours`
*   **Request Body**:
    ```json
    {
      "branchId": 1,
      "hours": [
        { "dayOfWeek": 1, "openTime": "09:00", "closeTime": "22:00" },
        { "dayOfWeek": 2, "openTime": "09:00", "closeTime": "22:00" }
      ]
    }
    ```

#### 3. Menu Category Management (CRUD)
*   **List Categories**: `GET /api/vendor/categories` (No Input)
*   **Create Category**: `POST /api/vendor/categories`
    *   *Body*: `{ "name": "Beverages", "description": "Cold mocktails" }`
*   **Update Category**: `PATCH /api/vendor/categories/:id`
    *   *Body*: `{ "name": "Premium Drinks" }`
*   **Delete Category**: `DELETE /api/vendor/categories/:id` (No Input)

#### 4. Menu Item Management (CRUD)
*   **List Menu Items**: `GET /api/vendor/menu` (No Input)
*   **Create Menu Item**: `POST /api/vendor/menu`
    *   *Body*:
        ```json
        {
          "categoryId": 10,
          "name": "Vanilla Latte",
          "description": "Double espresso with milk",
          "price": 140,
          "isVeg": true,
          "stockQuantity": 50,
          "preparationTime": 10
        }
        ```
*   **Update Menu Item**: `PATCH /api/vendor/menu/:id`
*   **Delete Menu Item**: `DELETE /api/vendor/menu/:id` (No Input)
*   **Toggle Availability**: `PATCH /api/vendor/menu/:id/availability`
    *   *Body*: `{ "status": "OUT_OF_STOCK" }` (or `ACTIVE`)

#### 5. List Orders (Dashboard Queue)
*   **Method**: `GET`
*   **Endpoint**: `/api/vendor/orders`
*   **Query Parameter**: `?status=PLACED` (Optional filters: `PLACED`, `ACCEPTED`, `PREPARING`, `READY`, `DELIVERED`, `CANCELLED`)
*   **Request Body**: **NONE**
*   **How & Where to Use**: Real-time kitchen order list.

#### 6. Process Orders (State Machine actions)
Triggered sequentially as the kitchen processes an order. No request body is needed, since the backend handles state progression.
*   **Accept Order**: `PATCH /api/vendor/orders/:id/accept` (Changes status to `ACCEPTED`)
*   **Reject Order**: `PATCH /api/vendor/orders/:id/reject` (Changes status to `REJECTED`)
*   **Start Cooking**: `PATCH /api/vendor/orders/:id/preparing` (Changes status to `PREPARING`)
*   **Mark Food Ready**: `PATCH /api/vendor/orders/:id/ready` (Changes status to `READY`, alerts delivery riders)
*   **Request Body**: **NONE** (All endpoints)

#### 7. Analytics and Settlements
*   **Summary Cards**: `GET /api/vendor/analytics/summary` (Returns revenue, total and completed order count)
*   **Daily Analytics**: `GET /api/vendor/analytics/daily` (Monthly transaction data for line graphs)
*   **Settlements Ledger**: `GET /api/vendor/settlements` (Banking status of previous cycles)
*   **Performance rating**: `GET /api/vendor/performance` (SLA/acceptance score)
*   **Request Body**: **NONE** (All endpoints)

---

### Category D: Rider / Delivery APIs

Requires `role` of the authenticated user to be `"RIDER"`.

#### 1. Toggle Online Status
*   **Method**: `PATCH`
*   **Endpoint**: `/api/rider/availability`
*   **Request Body**:
    ```json
    {
      "isOnline": true
    }
    ```
*   **How & Where to Use**: A master switch on the rider homepage to start/stop receiving order assignments.

#### 2. List Assigned Orders (Dashboard Queue)
*   **Method**: `GET`
*   **Endpoint**: `/api/rider/orders`
*   **Auth Required**: Yes
*   **Request Body**: **NONE**
*   **Expected Response (200 OK)**:
    ```json
    {
      "success": true,
      "message": "OK",
      "data": [
        {
          "assignmentId": 34,
          "riderId": 1,
          "assignmentStatus": "REJECTED",
          "assignedAt": "2026-06-11T11:22:23.961Z",
          "acceptedAt": null,
          "completedAt": null,
          "orderId": 31,
          "orderNumber": "ORD-00031",
          "customerId": 5,
          "vendorId": 2,
          "branchId": null,
          "orderRiderId": null,
          "addressId": 10,
          "subtotal": "250.00",
          "taxAmount": "25.00",
          "deliveryFee": "40.00",
          "platformFee": "15.00",
          "discountAmount": "0.00",
          "totalAmount": "330.00",
          "orderStatus": "PLACED",
          "paymentMethod": "UPI",
          "orderCreatedAt": "2026-06-11T10:30:00.000Z",
          "orderUpdatedAt": "2026-06-11T10:30:00.000Z",
          "items": [
            {
              "id": 101,
              "orderId": 31,
              "menuItemId": 5,
              "itemName": "Margherita Pizza",
              "price": "200.00",
              "quantity": 1,
              "total": "200.00",
              "customizations": {}
            }
          ],
          "address": {
            "id": 10,
            "customerId": 5,
            "addressType": "HOME",
            "houseNumber": "Apt 101",
            "street": "Main Street",
            "landmark": "Near Park",
            "city": "Bengaluru",
            "state": "Karnataka",
            "pincode": "560001",
            "latitude": "12.9716",
            "longitude": "77.5946",
            "isDefault": true
          }
        }
      ]
    }
    ```
*   **How & Where to Use**: Render the real-time incoming delivery request dashboard. Shows all active assignment requests with full order & address details.

#### 3. Get Single Order Details
*   **Method**: `GET`
*   **Endpoint**: `/api/rider/orders/:id`
*   **Auth Required**: Yes
*   **Path Parameter**: `:id` (Order ID)
*   **Request Body**: **NONE**
*   **Expected Response (200 OK)**:
    ```json
    {
      "success": true,
      "data": {
        "assignmentId": 34,
        "riderId": 1,
        "assignmentStatus": "REJECTED",
        "assignedAt": "2026-06-11T11:22:23.961Z",
        "acceptedAt": null,
        "completedAt": null,
        "orderId": 31,
        "orderNumber": "ORD-00031",
        "customerId": 5,
        "vendorId": 2,
        "branchId": null,
        "orderRiderId": null,
        "addressId": 10,
        "subtotal": "250.00",
        "taxAmount": "25.00",
        "deliveryFee": "40.00",
        "platformFee": "15.00",
        "discountAmount": "0.00",
        "totalAmount": "330.00",
        "orderStatus": "PLACED",
        "paymentMethod": "UPI",
        "orderCreatedAt": "2026-06-11T10:30:00.000Z",
        "orderUpdatedAt": "2026-06-11T10:30:00.000Z",
        "items": [...],
        "address": {...}
      }
    }
    ```
*   **How & Where to Use**: Tap on an order from the queue to view full details before accepting/rejecting it.

#### 4. Send Live GPS Coordinate Updates
*   **Method**: `POST`
*   **Endpoint**: `/api/rider/location`
*   **Request Body**:
    ```json
    {
      "orderId": 45,       // Optional: binds coordinate to a specific delivery track
      "latitude": 12.9716,
      "longitude": 77.5946
    }
    ```
*   **How & Where to Use**: Call inside a background GPS service every 15–30 seconds when the rider has an active delivery. This feeds the customer-facing map.

#### 5. Accept/Reject Delivery Requests
*   **Accept Delivery**: `PATCH /api/rider/orders/:id/accept`
*   **Reject Delivery**: `PATCH /api/rider/orders/:id/reject`
*   **Request Body**: **NONE**
*   **How & Where to Use**: When an order request pops up on the Rider app.

#### 6. Delivery Status Timeline Actions
As the rider travels, they click buttons in their app to trigger these. No request body is needed.
*   **Arrive at Restaurant**: `PATCH /api/rider/orders/:id/arrived-vendor`
*   **Pick Up Package**: `PATCH /api/rider/orders/:id/picked-up`
*   **Arrive at Home**: `PATCH /api/rider/orders/:id/arrived-customer`
*   **Request Body**: **NONE**

#### 7. Verify Delivery OTP & Complete Drop-off
*   **Method**: `POST`
*   **Endpoint**: `/api/rider/orders/:id/deliver`
*   **Path Parameter**: `:id` (Order ID)
*   **Request Body**:
    ```json
    {
      "otp": "982710"
    }
    ```
*   **How & Where to Use**: When completing delivery. The customer must tell the Rider the 6-digit OTP displayed on their app. Once submitted and verified, the order moves to `DELIVERED`, and the rider gets paid.

---

### Category E: Super Admin Dashboard APIs

Requires `role` to be `"SUPER_ADMIN"`.

#### 1. Create a Registered Vendor Profile
*   **Method**: `POST`
*   **Endpoint**: `/api/admin/vendors`
*   **Request Body**:
    ```json
    {
      "userId": 12,
      "name": "Gourmet Kitchen",
      "phone": "9887766554",
      "email": "gourmet@kitchen.com"
    }
    ```

#### 2. Manage Vendor Status
*   **Method**: `PATCH`
*   **Endpoint**: `/api/admin/vendors/:id/status`
*   **Request Body**:
    ```json
    {
      "status": "APPROVED" // APPROVED, REJECTED, SUSPENDED
    }
    ```

#### 3. Verify Documents (Vendor/Rider)
*   **Verify Vendor Doc**: `PATCH /api/admin/vendors/:id/documents/:docId`
*   **Verify Rider Doc**: `PATCH /api/admin/riders/:id/documents/:docId`
*   **Request Body**:
    ```json
    {
      "status": "VERIFIED" // VERIFIED, REJECTED
    }
    ```

#### 4. Manage Support Tickets & Complaints
*   **Respond Ticket**: `POST /api/admin/tickets/:id/respond`
*   **Respond Complaint**: `POST /api/admin/complaints/:id/respond`
*   **Request Body**:
    ```json
    {
      "response": "Refund has been processed and credited to your card."
    }
    ```
