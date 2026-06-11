import http from "http";
import { Server } from "socket.io";
import { env } from "./config/env";
import { pool } from "./config/database";
import redisClient from "./config/redis";
import app from "./app";
import { registerSocketHandlers } from "./socket/handlers";

/** Create HTTP server and attach Socket.IO for live tracking */
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: env.FRONTEND_URL, credentials: true },
});

app.set("io", io);

registerSocketHandlers(io);

const startServer = async () => {
  try {
    await pool.query("SELECT NOW()");
    console.log("✅ PostgreSQL Connected");

    if (!redisClient.isOpen) await redisClient.connect();
    console.log("✅ Redis Connected");

    httpServer.listen(env.PORT, () => {
      console.log(`🚀 Server + Socket.IO running on port ${env.PORT}`);
      console.log(`📚 API Docs: http://localhost:${env.PORT}/api/docs`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();

export { io };
