import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { swaggerUi, swaggerSpec, swaggerUiOptions } from "./docs/swagger";
import { errorHandler } from "./middleware/errorHandler";
import authRoutes from "./routes/auth.routes";
import customerRoutes from "./routes/customer.routes";
import vendorRoutes from "./routes/vendor.routes";
import riderRoutes from "./routes/rider.routes";
import adminRoutes from "./routes/admin.routes";
import { env } from "./config/env";

const app = express();

app.use(helmet());
app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/** Health check */
app.get("/health", (_req, res) => {
  res.json({ success: true, message: "Prolious Backend Running" });
});

/** Swagger API docs */
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));

/** REST API routes — 87 endpoints total */
app.use("/api/auth", authRoutes);
app.use("/api/customer", customerRoutes);
app.use("/api/vendor", vendorRoutes);
app.use("/api/rider", riderRoutes);
app.use("/api/admin", adminRoutes);

/** Global error handler (must be last) */
app.use(errorHandler);

export default app;
