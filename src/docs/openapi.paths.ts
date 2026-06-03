/** OpenAPI path helper — keeps swagger spec DRY */
const op = (tag: string, summary: string, secure = true, body?: Record<string, unknown>) => ({
  tags: [tag],
  summary,
  ...(secure ? { security: [{ bearerAuth: [] }] } : {}),
  ...(body ? { requestBody: { content: { "application/json": { schema: body } } } } : {}),
  responses: {
    200: { description: "Success" },
    401: { description: "Unauthorized" },
    403: { description: "Forbidden" },
  },
});

const idParam = { name: "id", in: "path" as const, required: true, schema: { type: "integer" } };

/** All 87 REST API paths for Pro-Licious */
export const openapiPaths = {
  "/health": {
    get: { tags: ["System"], summary: "Health check", responses: { 200: { description: "OK" } } },
  },

  // ─── AUTH (public + JWT) ───
  "/api/auth/send-otp": {
    post: op("Auth", "Send OTP to phone (public)", false, {
      type: "object",
      required: ["phone"],
      properties: { phone: { type: "string", example: "9876543210" } },
    }),
  },
  "/api/auth/verify-otp": {
    post: op("Auth", "Verify OTP — signup or login (public)", false, {
      type: "object",
      required: ["phone", "otp"],
      properties: {
        phone: { type: "string" },
        otp: { type: "string", example: "123456" },
        name: { type: "string", description: "Required for new users" },
        role: { type: "string", enum: ["CUSTOMER", "VENDOR", "RIDER"] },
      },
    }),
  },
  "/api/auth/login": {
    post: op("Auth", "Email + password login (public)", false, {
      type: "object",
      required: ["email", "password"],
      properties: { email: { type: "string" }, password: { type: "string" } },
    }),
  },
  "/api/auth/refresh-token": {
    post: op("Auth", "Refresh access token (public)", false, {
      type: "object",
      required: ["refreshToken"],
      properties: { refreshToken: { type: "string" } },
    }),
  },
  "/api/auth/logout": { post: op("Auth", "Logout — invalidate refresh token") },
  "/api/auth/me": { get: op("Auth", "Get current logged-in user") },

  // ─── CUSTOMER ───
  "/api/customer/profile": {
    get: op("Customer", "Get profile"),
    patch: op("Customer", "Update profile", true, { type: "object" }),
  },
  "/api/customer/addresses": {
    get: op("Customer", "List addresses"),
    post: op("Customer", "Add address", true, { type: "object" }),
  },
  "/api/customer/addresses/{id}": {
    patch: { ...op("Customer", "Update address"), parameters: [idParam] },
    delete: { ...op("Customer", "Delete address (soft)"), parameters: [idParam] },
  },
  "/api/customer/vendors": { get: { ...op("Customer", "List vendors"), parameters: [{ name: "zoneId", in: "query", schema: { type: "integer" } }] } },
  "/api/customer/vendors/{id}": { get: { ...op("Customer", "Vendor details"), parameters: [idParam] } },
  "/api/customer/vendors/{id}/menu": { get: { ...op("Customer", "Vendor menu"), parameters: [idParam] } },
  "/api/customer/search": { get: { ...op("Customer", "Search vendors & items"), parameters: [{ name: "query", in: "query", required: true, schema: { type: "string" } }] } },
  "/api/customer/categories": { get: op("Customer", "List categories") },
  "/api/customer/cart": {
    get: op("Customer", "Get cart"),
    delete: op("Customer", "Clear cart"),
  },
  "/api/customer/cart/items": { post: op("Customer", "Add item to cart", true, { type: "object" }) },
  "/api/customer/cart/items/{id}": {
    patch: { ...op("Customer", "Update cart item qty"), parameters: [idParam] },
    delete: { ...op("Customer", "Remove cart item"), parameters: [idParam] },
  },
  "/api/customer/orders": {
    get: op("Customer", "List my orders"),
    post: op("Customer", "Place order from cart", true, { type: "object" }),
  },
  "/api/customer/orders/{id}": { get: { ...op("Customer", "Order details"), parameters: [idParam] } },
  "/api/customer/orders/{id}/tracking": { get: { ...op("Customer", "Live tracking timeline"), parameters: [idParam] } },
  "/api/customer/orders/{id}/cancel": { post: { ...op("Customer", "Cancel order"), parameters: [idParam] } },
  "/api/customer/payments/initiate": { post: op("Customer", "Initiate Razorpay payment", true, { type: "object" }) },
  "/api/customer/payments/verify": { post: op("Customer", "Verify Razorpay payment", true, { type: "object" }) },
  "/api/customer/complaints": {
    get: op("Customer", "List complaints"),
    post: op("Customer", "Raise complaint", true, { type: "object" }),
  },
  "/api/customer/support/tickets": { post: op("Customer", "Create support ticket", true, { type: "object" }) },
  "/api/customer/notifications": { get: op("Customer", "List notifications") },
  "/api/customer/notifications/{id}/read": { patch: { ...op("Customer", "Mark notification read"), parameters: [idParam] } },
  "/api/customer/favorites/{vendorId}": {
    post: { ...op("Customer", "Add favorite vendor"), parameters: [{ name: "vendorId", in: "path", required: true, schema: { type: "integer" } }] },
    delete: { ...op("Customer", "Remove favorite"), parameters: [{ name: "vendorId", in: "path", required: true, schema: { type: "integer" } }] },
  },

  // ─── VENDOR ───
  "/api/vendor/profile": { get: op("Vendor", "Get vendor profile"), patch: op("Vendor", "Update profile", true, { type: "object" }) },
  "/api/vendor/branches": { get: op("Vendor", "List branches") },
  "/api/vendor/branches/{id}/status": { patch: { ...op("Vendor", "Toggle branch status"), parameters: [idParam] } },
  "/api/vendor/operating-hours": { get: op("Vendor", "Get hours"), put: op("Vendor", "Set hours", true, { type: "object" }) },
  "/api/vendor/categories": { get: op("Vendor", "List categories"), post: op("Vendor", "Create category", true, { type: "object" }) },
  "/api/vendor/categories/{id}": {
    patch: { ...op("Vendor", "Update category"), parameters: [idParam] },
    delete: { ...op("Vendor", "Delete category"), parameters: [idParam] },
  },
  "/api/vendor/menu": { get: op("Vendor", "List menu items"), post: op("Vendor", "Add menu item", true, { type: "object" }) },
  "/api/vendor/menu/{id}": {
    patch: { ...op("Vendor", "Edit menu item"), parameters: [idParam] },
    delete: { ...op("Vendor", "Delete menu item"), parameters: [idParam] },
  },
  "/api/vendor/menu/{id}/availability": { patch: { ...op("Vendor", "Toggle availability"), parameters: [idParam] } },
  "/api/vendor/orders": { get: { ...op("Vendor", "List orders"), parameters: [{ name: "status", in: "query", schema: { type: "string" } }] } },
  "/api/vendor/orders/{id}": { get: { ...op("Vendor", "Order details"), parameters: [idParam] } },
  "/api/vendor/orders/{id}/accept": { patch: { ...op("Vendor", "Accept order"), parameters: [idParam] } },
  "/api/vendor/orders/{id}/reject": { patch: { ...op("Vendor", "Reject order"), parameters: [idParam] } },
  "/api/vendor/orders/{id}/preparing": { patch: { ...op("Vendor", "Mark preparing"), parameters: [idParam] } },
  "/api/vendor/orders/{id}/ready": { patch: { ...op("Vendor", "Mark ready"), parameters: [idParam] } },
  "/api/vendor/analytics/summary": { get: op("Vendor", "Sales summary") },
  "/api/vendor/analytics/daily": { get: op("Vendor", "Daily analytics (30 days)") },
  "/api/vendor/transactions": { get: op("Vendor", "Payment transactions") },
  "/api/vendor/settlements": { get: op("Vendor", "Payout settlements") },
  "/api/vendor/performance": { get: op("Vendor", "SLA performance metrics") },

  // ─── RIDER ───
  "/api/rider/availability": { patch: op("Rider", "Toggle online/offline", true, { type: "object", properties: { isOnline: { type: "boolean" } } }) },
  "/api/rider/location": { post: op("Rider", "Push GPS location", true, { type: "object" }) },
  "/api/rider/orders": { get: op("Rider", "Assigned deliveries") },
  "/api/rider/orders/{id}": { get: { ...op("Rider", "Order details"), parameters: [idParam] } },
  "/api/rider/orders/{id}/accept": { patch: { ...op("Rider", "Accept assignment"), parameters: [idParam] } },
  "/api/rider/orders/{id}/reject": { patch: { ...op("Rider", "Reject assignment"), parameters: [idParam] } },
  "/api/rider/orders/{id}/arrived-vendor": { patch: { ...op("Rider", "Arrived at vendor"), parameters: [idParam] } },
  "/api/rider/orders/{id}/picked-up": { patch: { ...op("Rider", "Picked up order"), parameters: [idParam] } },
  "/api/rider/orders/{id}/arrived-customer": { patch: { ...op("Rider", "Arrived at customer"), parameters: [idParam] } },
  "/api/rider/orders/{id}/deliver": { post: { ...op("Rider", "Confirm delivery with OTP", true, { type: "object", properties: { otp: { type: "string" } } }), parameters: [idParam] } },
  "/api/rider/earnings": { get: op("Rider", "All earnings") },
  "/api/rider/earnings/summary": { get: op("Rider", "Earnings summary") },
  "/api/rider/shifts": { get: op("Rider", "Shift history") },
  "/api/rider/settlements": { get: op("Rider", "Settlements") },
  "/api/rider/payouts": { get: op("Rider", "Payout transactions") },
  "/api/rider/notifications": { get: op("Rider", "Notifications") },

  // ─── ADMIN ───
  "/api/admin/dashboard/live": { get: op("Admin", "Live dashboard stats") },
  "/api/admin/analytics/daily": { get: op("Admin", "Daily metrics") },
  "/api/admin/analytics/demand-supply": { get: op("Admin", "Zone demand/supply") },
  "/api/admin/orders": { get: { ...op("Admin", "All orders"), parameters: [{ name: "status", in: "query", schema: { type: "string" } }] } },
  "/api/admin/orders/{id}": { get: { ...op("Admin", "Order details"), parameters: [idParam] } },
  "/api/admin/orders/{id}/cancel": { patch: { ...op("Admin", "Force cancel order"), parameters: [idParam] } },
  "/api/admin/refunds": { post: op("Admin", "Approve refund", true, { type: "object" }) },
  "/api/admin/vendors": { get: op("Admin", "List vendors"), post: op("Admin", "Onboard vendor", true, { type: "object" }) },
  "/api/admin/vendors/{id}/status": { patch: { ...op("Admin", "Update vendor status"), parameters: [idParam] } },
  "/api/admin/vendors/{id}/documents": { get: { ...op("Admin", "Vendor KYC docs"), parameters: [idParam] } },
  "/api/admin/vendors/{id}/documents/{docId}": { patch: { ...op("Admin", "Verify vendor doc"), parameters: [idParam, { name: "docId", in: "path", required: true, schema: { type: "integer" } }] } },
  "/api/admin/riders": { get: op("Admin", "List riders"), post: op("Admin", "Onboard rider", true, { type: "object" }) },
  "/api/admin/riders/{id}/status": { patch: { ...op("Admin", "Update rider status"), parameters: [idParam] } },
  "/api/admin/riders/{id}/documents": { get: { ...op("Admin", "Rider KYC docs"), parameters: [idParam] } },
  "/api/admin/riders/{id}/documents/{docId}": { patch: { ...op("Admin", "Verify rider doc"), parameters: [idParam, { name: "docId", in: "path", required: true, schema: { type: "integer" } }] } },
  "/api/admin/tickets": { get: op("Admin", "Support tickets") },
  "/api/admin/tickets/{id}/respond": { post: { ...op("Admin", "Respond to ticket", true, { type: "object" }), parameters: [idParam] } },
  "/api/admin/complaints": { get: op("Admin", "All complaints") },
  "/api/admin/complaints/{id}/respond": { post: { ...op("Admin", "Respond to complaint", true, { type: "object" }), parameters: [idParam] } },
  "/api/admin/audit-logs": { get: op("Admin", "Admin audit trail") },
  "/api/admin/fraud-flags": { get: op("Admin", "Fraud flags") },
  "/api/admin/fraud-flags/{id}": { patch: { ...op("Admin", "Review fraud flag"), parameters: [idParam] } },
};
