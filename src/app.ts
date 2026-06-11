import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
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
app.use(cors({ origin: ["http://localhost:3000", "http://127.0.0.1:3000"], credentials: true }));
app.use(morgan("dev"));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/** Disable caching for API routes to prevent 304 responses during development */
app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  next();
});

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
