import http from "http";
import { Server } from "socket.io";
import { env } from "./config/env";
import { pool } from "./config/database";
import redisClient from "./config/redis";
import app from "./app";
import { registerSocketHandlers } from "./socket/handlers";
import { setIo } from "./socket";
import { verifyAccessToken } from "./utils/jwt";

/** Create HTTP server and attach Socket.IO for live tracking */
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: env.FRONTEND_URL, credentials: true },
});

setIo(io);
// Socket auth middleware: verify token in handshake.auth.token and attach `user` to socket.data
io.use((socket, next) => {
  try {
    const token = (socket.handshake.auth && (socket.handshake.auth as any).token) || null;
    if (token) {
      const user = verifyAccessToken(token as string);
      // attach user to socket data for handlers to use
      (socket.data as any).user = user;
    }
    return next();
  } catch (err) {
    console.log("Socket auth middleware error:", err instanceof Error ? err.message : err);
    // allow unauthenticated sockets to continue (some pages may use public events)
    return next();
  }
});

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

// Prevent unhandled errors from crashing the server
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});

startServer();

export { io };
