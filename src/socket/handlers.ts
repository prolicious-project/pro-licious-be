import { Server, Socket } from "socket.io";
import { db } from "../db";
import { deliveryTrackingEvents, riderAvailability, orders, riderAssignments } from "../db/schema";
import { eq, or, and } from "drizzle-orm";
import { verifyOTP, getOtpRedis } from "../utils/otp";
import { verifyAccessToken } from "../utils/jwt";
import { getRiderByUserId } from "../lib/helpers";
// import { assignRiderToOrder, getAssignmentsForRider } from "../services/rider.service";

import * as RiderService from "../services/rider.service";
import { getAssignmentsForRider } from "../services/rider.service";

/** Register all Socket.IO event handlers for live order tracking */



export const registerSocketHandlers = (io: Server) => {
  console.log("Registering Socket.IO handlers...");
  io.on("connection", async (socket: Socket) => {
     console.log(`Socket connected: ${socket.id}`);

    // If middleware attached a user to socket.data, use it to auto-join rooms
    try {
      const user = (socket.data as any)?.user || null;
      if (user && user.role === "RIDER") {
        const rider = await getRiderByUserId(user.id);
        socket.join(`rider:${rider.id}`);
        // send pending/assigned assignments to rider (enriched with order details)
        const pending = await RiderService.getAssignmentsForRider(rider.id);
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
      async ({ orderId, riderId, latitude, longitude }: { orderId: number; riderId: number; latitude: number; longitude: number }) => {
        await db.insert(deliveryTrackingEvents).values({
          orderId,
          riderId,
          eventType: "LOCATION_UPDATE",
          latitude: String(latitude),
          longitude: String(longitude),
        });
        io.to(`order:${orderId}`).emit("rider_location", { riderId, latitude, longitude, timestamp: new Date() });
      },
    );

    /** Rider goes online */
    socket.on("rider_go_online", async ({ riderId }: { riderId: number }) => {
      await db.update(riderAvailability).set({ isOnline: true, lastSeen: new Date() }).where(eq(riderAvailability.riderId, riderId));
      io.emit("rider_online", { riderId, isOnline: true });
      // emit any pending assignments to this rider room (enriched)
      const pending = await RiderService.getAssignmentsForRider(riderId);
      io.to(`rider:${riderId}`).emit("pending_assignments", { assignments: pending });
    });

    /** Rider goes offline */
    socket.on("rider_go_offline", async ({ riderId }: { riderId: number }) => {
      await db.update(riderAvailability).set({ isOnline: false, lastSeen: new Date() }).where(eq(riderAvailability.riderId, riderId));
      io.emit("rider_offline", { riderId, isOnline: false });
    });

    /** Assign rider to order via socket */
    socket.on("assign_rider_to_order", async ({ orderId, vendorId }) => {
      try {
        const result = await RiderService.assignRiderToOrder(orderId);
        if (result) {
          // enrich the created assignment with full order details
          const riderAssignments = await RiderService.getAssignmentsForRider(result.rider.id);
          const enriched = riderAssignments.find((x: any) => x.assignment && x.assignment.orderId === orderId);
          io.to(`rider:${result.rider.id}`).emit("new_order_assigned", { orderId, assignment: enriched });
          io.to(`order:${orderId}`).emit("rider_assigned", { orderId, riderId: result.rider.id, riderName: result.user.name, riderPhone: result.user.phone });
          console.log(`Rider ${result.rider.id} assigned to order ${orderId}`);
        }
      } catch (err) {
        socket.emit("error", { message: "Failed to assign rider" });
        console.error("Assign rider error:", err);
      }
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
  const payload = { orderId, ...data, message: "Rider assigned to your order" };
  io.to(`order:${orderId}`).emit("rider_assigned", payload);
  if (data && data.riderId) {
    io.to(`rider:${data.riderId}`).emit("rider_assigned", payload);
  }
};
