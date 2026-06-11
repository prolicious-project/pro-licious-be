import { Server, Socket } from "socket.io";
import { db } from "../db";
import { deliveryTrackingEvents, riderAvailability, orders, orderMessages, users } from "../db/schema";
import { eq } from "drizzle-orm";
import { verifyOTP, getOtpRedis } from "../utils/otp";

/** Register all Socket.IO event handlers for live order tracking */
export const registerSocketHandlers = (io: Server) => {
  io.on("connection", (socket: Socket) => {
    console.log(`Socket connected: ${socket.id}`);

    /** Client joins order room for live updates */
    socket.on("join_order_room", ({ orderId, userId, role }: { orderId: number; userId: number; role: string }) => {
      socket.join(`order:${orderId}`);
      console.log(`User ${userId} (${role}) joined order:${orderId}`);
    });

    /** User sends chat message inside order room */
    socket.on("send_message", async ({ orderId, senderId, message }: { orderId: number; senderId: number; message: string }) => {
      try {
        const [msg] = await db.insert(orderMessages).values({
          orderId,
          senderId,
          message
        }).returning();

        // Fetch sender name for dynamic layout rendering
        const [user] = await db.select().from(users).where(eq(users.id, senderId));
        const enrichedMsg = {
          ...msg,
          senderName: user?.name || "User"
        };

        io.to(`order:${orderId}`).emit("new_message", enrichedMsg);
      } catch (err) {
        console.error("Socket send_message error:", err);
      }
    });

    /** Rider pushes GPS location during delivery */
    socket.on(
      "rider_location_update",
      async ({ orderId, riderId, latitude, longitude }: { orderId: number; riderId: number; latitude: number; longitude: number }) => {
        await db.insert(deliveryTrackingEvents).values({
          orderId,
          riderId,
          eventType: "LOCATION_UPDATE",
          latitude: String(latitude),
          longitude: String(longitude),
        });
        io.to(`order:${orderId}`).emit("rider_location", { riderId, latitude, longitude, timestamp: new Date() });
        io.emit("admin_rider_location", { orderId, riderId, latitude, longitude, timestamp: new Date() });
      },
    );

    /** Rider goes online */
    socket.on("rider_go_online", async ({ riderId }: { riderId: number }) => {
      await db.update(riderAvailability).set({ isOnline: true, lastSeen: new Date() }).where(eq(riderAvailability.riderId, riderId));
      io.emit("rider_online", { riderId, isOnline: true });
    });

    /** Rider goes offline */
    socket.on("rider_go_offline", async ({ riderId }: { riderId: number }) => {
      await db.update(riderAvailability).set({ isOnline: false, lastSeen: new Date() }).where(eq(riderAvailability.riderId, riderId));
      io.emit("rider_offline", { riderId, isOnline: false });
    });

    /** Verify delivery OTP via socket */
    socket.on("verify_delivery_otp", async ({ orderId, otp }: { orderId: number; otp: string }) => {
      const hash = await getOtpRedis(`delivery:${orderId}`);
      if (hash && (await verifyOTP(otp, hash))) {
        await db.update(orders).set({ status: "DELIVERED" }).where(eq(orders.id, orderId));
        io.to(`order:${orderId}`).emit("order_delivered", { orderId, message: "Order delivered successfully" });
        io.to(`order:${orderId}`).emit("delivery_confirmed", { orderId, message: "Delivery confirmed" });
      } else {
        socket.emit("error", { message: "Invalid OTP" });
      }
    });

    socket.on("disconnect", () => console.log(`Socket disconnected: ${socket.id}`));
  });
};

/** Emit order status change to all parties in order room */
export const emitOrderStatus = (io: Server, orderId: number, status: string, message: string) => {
  io.to(`order:${orderId}`).emit("order_status_changed", { orderId, status, message });
};

/** Notify customer/vendor that rider was assigned */
export const emitRiderAssigned = (
  io: Server,
  orderId: number,
  data: { riderId: number; riderName: string; riderPhone: string; riderLocation?: { lat: number; lng: number } },
) => {
  io.to(`order:${orderId}`).emit("rider_assigned", { orderId, ...data, message: "Rider assigned to your order" });
};
