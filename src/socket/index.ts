import { Server } from "socket.io";

let ioInstance: Server | null = null;

export const setIo = (io: Server) => {
  ioInstance = io;
};

export const getIo = (): Server | null => ioInstance;

export const emitOrderStatus = (orderId: number, status: string, message: string) => {
  if (!ioInstance) return;
  ioInstance.to(`order:${orderId}`).emit("order_status_changed", { orderId, status, message });
};

export const emitRiderAssigned = (orderId: number, data: any) => {
  if (!ioInstance) return;
  const payload = { orderId, ...data, message: "Rider assigned to your order" };
  // to order room (customer/vendor)
  ioInstance.to(`order:${orderId}`).emit("rider_assigned", payload);
  // targeted notify to the rider room if riderId present
  if (data && data.riderId) {
    ioInstance.to(`rider:${data.riderId}`).emit("rider_assigned", payload);
  }
  // Fallback global notify for compatibility with older clients
  ioInstance.emit("rider_assigned", payload);
};
