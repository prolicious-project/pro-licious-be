import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import path from "path";
import fs from "fs";
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
app.use(cors({
   origin: [
      ...(process.env.FRONTEND_URL?.split(",") || []),
      "http://localhost:8081",
    ],
  credentials: true,
}));
app.use(morgan("dev"));
app.use(cookieParser());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Serve static uploaded files
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Handle base64 uploads
app.post("/api/upload", (req, res) => {
  try {
    const { file, fileName } = req.body;
    if (!file || !fileName) {
      res.status(400).json({ success: false, message: "Missing file or fileName" });
      return;
    }
    const base64Data = file.replace(/^data:image\/\w+;base64,/, "").replace(/^data:application\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");
    const uploadsDir = path.join(__dirname, "../uploads");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    const uniqueFileName = `${Date.now()}-${fileName.replace(/\s+/g, "_")}`;
    const filePath = path.join(uploadsDir, uniqueFileName);
    fs.writeFileSync(filePath, buffer);
    const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${uniqueFileName}`;
    res.json({ success: true, url: fileUrl });
  } catch (error: any) {
    console.error("Upload error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});


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
