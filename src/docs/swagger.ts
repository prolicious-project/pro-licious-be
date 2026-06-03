import swaggerUi from "swagger-ui-express";
import { openapiPaths } from "./openapi.paths";

/** Full OpenAPI 3.0 spec — all 87 Pro-Licious APIs */
export const swaggerSpec = {
  openapi: "3.0.0",
  info: {
    title: "Pro-Licious API",
    version: "2.0.0",
    description: `
## Pro-Licious Food Delivery Platform

**87 REST endpoints** across Customer, Vendor, Rider, and Admin modules.

### Authentication
This API uses **JWT Bearer Token** authentication.

| Method | Use case | Endpoints |
|--------|----------|-----------|
| **OTP (Mobile)** | Flutter app / mobile login | \`POST /api/auth/send-otp\` → \`POST /api/auth/verify-otp\` |
| **Email + Password** | Web admin / vendor dashboard | \`POST /api/auth/login\` |
| **Token Refresh** | Renew expired access token | \`POST /api/auth/refresh-token\` |

- **Access Token**: 4 hours — send as \`Authorization: Bearer <token>\`
- **Refresh Token**: 30 days — stored in DB (\`user_sessions\`)
- **Roles**: CUSTOMER, VENDOR, RIDER, SUPER_ADMIN

### How to test in Swagger
1. Call \`POST /api/auth/send-otp\` (no auth needed)
2. Check server terminal for OTP (dev mode)
3. Call \`POST /api/auth/verify-otp\` — copy \`accessToken\` from response
4. Click **Authorize** (top right) → enter \`Bearer <accessToken>\`
5. Test any protected endpoint
    `,
  },
  servers: [{ url: "http://localhost:5000", description: "Local dev" }],
  tags: [
    { name: "System", description: "Health checks" },
    { name: "Auth", description: "Authentication — OTP, login, JWT tokens" },
    { name: "Customer", description: "Customer app APIs (role: CUSTOMER)" },
    { name: "Vendor", description: "Vendor dashboard APIs (role: VENDOR)" },
    { name: "Rider", description: "Rider delivery APIs (role: RIDER)" },
    { name: "Admin", description: "Admin panel APIs (role: SUPER_ADMIN)" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "JWT access token from /api/auth/verify-otp or /api/auth/login",
      },
    },
    schemas: {
      SuccessResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          message: { type: "string" },
          data: { type: "object" },
        },
      },
      ErrorResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: false },
          error: { type: "string" },
          code: { type: "string" },
          timestamp: { type: "string", format: "date-time" },
        },
      },
    },
  },
  paths: openapiPaths,
};

export { swaggerUi };
