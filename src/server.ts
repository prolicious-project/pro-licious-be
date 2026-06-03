import express from "express";
import cors from "cors";
import { env } from "./config/env";
import { pool } from "./config/database";
import redisClient from "./config/redis";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    success: true,
    message: "Prolious Backend Running",
  });
});

const startServer = async () => {
  try {
    await pool.query("SELECT NOW()");

    console.log("✅ PostgreSQL Connected");

    await redisClient.connect();

    console.log("✅ Redis Connected");

    app.listen(env.PORT, () => {
      console.log(
        `🚀 Server running on port ${env.PORT}`
      );
    });
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

startServer();