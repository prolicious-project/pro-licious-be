import swaggerUi from "swagger-ui-express";
import { openapiPaths } from "./openapi.paths";

/** Full OpenAPI 3.0 spec — all 87 Pro-Licious APIs */
export const swaggerSpec = {
  openapi: "3.0.0",
  info: {
    title: "Pro-Licious API",
    version: "2.0.0",
    description: `
This interactive documentation covers **87 endpoints** across Customer, Vendor, Rider, and Admin operations.

---

### 🔑 Quick Start: How to Authenticate & Test APIs

1. **Get an OTP**: Open \`POST /api/auth/send-otp\`, click **Try it out**, set \`phone\`, and click **Execute**.
2. **Find Code**: Check your running console logs for: \`[DEV OTP] 9876543210: XXXXXX\`.
3. **Verify**: Open \`POST /api/auth/verify-otp\`, input the phone + OTP code, click **Execute**, and copy the \`accessToken\`.
4. **Authorize**: Click **Authorize** (top right) and paste the token.

---

### 👥 Roles and Targets
- **CUSTOMER**: Access \`/api/customer/*\`
- **VENDOR**: Access \`/api/vendor/*\`
- **RIDER**: Access \`/api/rider/*\`
- **SUPER_ADMIN**: Access \`/api/admin/*\` (Login via \`/api/auth/login\` with email & password)
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

// Premium, modern dark-ish/indigo themed CSS styling for Swagger UI
const customCss = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap');
  
  .swagger-ui {
    font-family: 'Plus Jakarta Sans', sans-serif !important;
    background-color: #fafbfc;
  }
  
  .swagger-ui .topbar {
    background-color: #0f172a !important;
    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  }
  
  .swagger-ui .info {
    margin: 30px 0 !important;
  }
  
  .swagger-ui .info .title {
    font-family: 'Plus Jakarta Sans', sans-serif !important;
    color: #1e293b !important;
    font-weight: 700 !important;
    font-size: 32px !important;
  }
  
  .swagger-ui .info p, .swagger-ui .info li {
    font-size: 14px !important;
    line-height: 1.6 !important;
    color: #475569 !important;
  }
  
  .swagger-ui .btn.authorize {
    background-color: #6366f1 !important;
    border-color: #6366f1 !important;
    color: #fff !important;
    border-radius: 8px !important;
    font-weight: 600 !important;
    transition: all 0.2s ease;
    box-shadow: 0 4px 6px -1px rgba(99, 102, 241, 0.2);
  }
  
  .swagger-ui .btn.authorize svg {
    fill: #fff !important;
  }
  
  .swagger-ui .btn.authorize:hover {
    background-color: #4f46e5 !important;
    border-color: #4f46e5 !important;
    transform: translateY(-1px);
  }

  .swagger-ui .opblock {
    border-radius: 12px !important;
    box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05) !important;
    border: 1px solid rgba(0, 0, 0, 0.05) !important;
  }

  .swagger-ui .opblock .opblock-summary {
    padding: 10px 20px !important;
  }

  .swagger-ui .opblock.opblock-post { background: rgba(16, 185, 129, 0.04) !important; border-color: rgba(16, 185, 129, 0.15) !important; }
  .swagger-ui .opblock.opblock-post .opblock-summary-method { background-color: #10b981 !important; border-radius: 6px !important; }
  
  .swagger-ui .opblock.opblock-get { background: rgba(59, 130, 246, 0.04) !important; border-color: rgba(59, 130, 246, 0.15) !important; }
  .swagger-ui .opblock.opblock-get .opblock-summary-method { background-color: #3b82f6 !important; border-radius: 6px !important; }
  
  .swagger-ui .opblock.opblock-patch { background: rgba(245, 158, 11, 0.04) !important; border-color: rgba(245, 158, 11, 0.15) !important; }
  .swagger-ui .opblock.opblock-patch .opblock-summary-method { background-color: #f59e0b !important; border-radius: 6px !important; }
  
  .swagger-ui .opblock.opblock-delete { background: rgba(239, 68, 68, 0.04) !important; border-color: rgba(239, 68, 68, 0.15) !important; }
  .swagger-ui .opblock.opblock-delete .opblock-summary-method { background-color: #ef4444 !important; border-radius: 6px !important; }

  .swagger-ui select, .swagger-ui input[type=text] {
    border-radius: 6px !important;
    border: 1px solid #cbd5e1 !important;
    padding: 6px 10px !important;
  }

  .swagger-ui .opblock-body pre {
    border-radius: 8px !important;
    background: #0f172a !important;
    color: #f8fafc !important;
  }
`;

export const swaggerUiOptions = {
  customCss,
  customSiteTitle: "Pro-Licious API Specs",
};

export { swaggerUi };

