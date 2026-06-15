import { Server, Socket } from "socket.io";
import { db } from "../db";
import { deliveryTrackingEvents, riderAvailability, orders, riderAssignments } from "../db/schema";
import { eq, or, and } from "drizzle-orm";
import { verifyOTP, getOtpRedis } from "../utils/otp";
import { verifyAccessToken } from "../utils/jwt";
import { getRiderByUserId } from "../lib/helpers";
import * as svc from "../services/rider.service";
import { assignRiderToOrder } from "C:/Users/ADMIN/prolicious/pro-licious-be/src/services/rider.service"

/** Register all Socket.IO event handlers for live order tracking */
export const registerSocketHandlers = (io: Server) => {
  io.on("connection", async (socket: Socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // If middleware attached a user to socket.data, use it to auto-join rooms
    try {
      const user = (socket.data as any)?.user || null;
      if (user && user.role === "RIDER") {
        const rider = await getRiderByUserId(user.id);
        socket.join(`rider:${rider.id}`);
        // send pending/assigned assignments to rider
        const pending = await db.select().from(riderAssignments).where(and(eq(riderAssignments.riderId, rider.id), or(eq(riderAssignments.status, "ASSIGNED"), eq(riderAssignments.status, "ACCEPTED"))));
        socket.emit("pending_assignments", { assignments: pending });
      }
    } catch (err) {
      console.log("Socket post-connect user handling failed:", err instanceof Error ? err.message : String(err));
    }

    /** Client joins order room for live updates */
    socket.on("join_order_room", ({ orderId, userId, role }: { orderId: number; userId: number; role: string }) => {
      socket.join(`order:${orderId}`);
      console.log(`User ${userId} (${role}) joined order:${orderId}`);
    });

    /** Rider pushes GPS location during delivery */
    socket.on(
      "rider_location_update",
      async (payload: { orderId: number; riderId?: number; latitude: number; longitude: number }) => {
        try {
          const { orderId, latitude, longitude } = payload;
          if (!orderId || !Number.isFinite(orderId)) return;
          let riderId = payload.riderId;
          if (!riderId) {
            const user = (socket.data as any)?.user;
            if (user && user.role === "RIDER") {
              const rider = await getRiderByUserId(user.id);
              riderId = rider.id;
            }
          }
          if (!riderId || !Number.isFinite(riderId)) return;
          await db.insert(deliveryTrackingEvents).values({
            orderId,
            riderId,
            eventType: "LOCATION_UPDATE",
            latitude: String(latitude),
            longitude: String(longitude),
          });
          io.to(`order:${orderId}`).emit("rider_location", { riderId, latitude, longitude, timestamp: new Date() });
        } catch (err) {
          console.error("rider_location_update error:", err instanceof Error ? err.message : err);
        }
      },
    );

    /** Rider goes online */
    socket.on("rider_go_online", async (payload: { riderId?: number }) => {
      try {
        let riderId = payload?.riderId;
        if (!riderId) {
          const user = (socket.data as any)?.user;
          if (user && user.role === "RIDER") {
            const rider = await getRiderByUserId(user.id);
            riderId = rider.id;
          }
        }
        if (!riderId || !Number.isFinite(riderId)) return;
        await db.update(riderAvailability).set({ isOnline: true, lastSeen: new Date() }).where(eq(riderAvailability.riderId, riderId));
        io.emit("rider_online", { riderId, isOnline: true });
        // emit any pending assignments to this rider room
        const pending = await db.select().from(riderAssignments).where(and(eq(riderAssignments.riderId, riderId), or(eq(riderAssignments.status, "ASSIGNED"), eq(riderAssignments.status, "ACCEPTED"))));
        io.to(`rider:${riderId}`).emit("pending_assignments", { assignments: pending });
      } catch (err) {
        console.error("rider_go_online error:", err instanceof Error ? err.message : err);
      }
    });

    /** Rider goes offline */
    socket.on("rider_go_offline", async (payload: { riderId?: number }) => {
      try {
        let riderId = payload?.riderId;
        if (!riderId) {
          const user = (socket.data as any)?.user;
          if (user && user.role === "RIDER") {
            const rider = await getRiderByUserId(user.id);
            riderId = rider.id;
          }
        }
        if (!riderId || !Number.isFinite(riderId)) return;
        await db.update(riderAvailability).set({ isOnline: false, lastSeen: new Date() }).where(eq(riderAvailability.riderId, riderId));
        io.emit("rider_offline", { riderId, isOnline: false });
      } catch (err) {
        console.error("rider_go_offline error:", err instanceof Error ? err.message : err);
      }
    });

    // In socket/handlers.ts - Add this event handler

socket.on("assign_rider_to_order", async ({ orderId, vendorId }) => {
  try {
    const result = await assignRiderToOrder(orderId);
    
    if (result) {
      // ✅ Emit to rider room so they see the new order
      io.to(`rider:${result.rider.id}`).emit("new_order_assigned", {
        orderId,
        order: result.assignment,
      });

      // ✅ Emit to order room (vendor & customer)
      io.to(`order:${orderId}`).emit("rider_assigned", {
        orderId,
        riderId: result.rider.id,
        riderName: result.user.name,
        riderPhone: result.user.phone,
      });

      console.log(`Rider ${result.rider.id} assigned to order ${orderId}`);
    }
  } catch (err) {
    socket.emit("error", { message: "Failed to assign rider" });
    console.error("Assign rider error:", err);
  }
});

    /** Verify delivery OTP via socket */
    socket.on("verify_delivery_otp", async ({ orderId, otp }: { orderId: number; otp: string }) => {
      try {
        const hash = await getOtpRedis(`delivery:${orderId}`);
        if (hash && (await verifyOTP(otp, hash))) {
          await db.update(orders).set({ status: "DELIVERED" }).where(eq(orders.id, orderId));
          io.to(`order:${orderId}`).emit("order_delivered", { orderId, message: "Order delivered successfully" });
          io.to(`order:${orderId}`).emit("delivery_confirmed", { orderId, message: "Delivery confirmed" });
        } else {
          socket.emit("error", { message: "Invalid OTP" });
        }
      } catch (err) {
        console.error("verify_delivery_otp error:", err instanceof Error ? err.message : err);
        socket.emit("error", { message: "OTP verification failed" });
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
  const payload = { orderId, ...data, message: "Rider assigned to your order" };
  io.to(`order:${orderId}`).emit("rider_assigned", payload);
  if (data && data.riderId) {
    io.to(`rider:${data.riderId}`).emit("rider_assigned", payload);
  }
};
