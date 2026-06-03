export const socketHandlers = (io) => {
  io.on('connection', (socket) => {
    console.log(`✅ Socket connected: ${socket.id}`);

    // ============= JOIN ROOMS =============
    socket.on('join_order_room', (data) => {
      const { orderId, userId, role } = data;
      const roomName = `order_${orderId}`;
      socket.join(roomName);
      console.log(`👤 User ${userId} (${role}) joined room: ${roomName}`);
    });

    // ============= RIDER LOCATION UPDATES =============
    socket.on('rider_location_update', (data) => {
      const { orderId, riderId, latitude, longitude } = data;
      io.to(`order_${orderId}`).emit('rider_location', {
        riderId,
        latitude,
        longitude,
        timestamp: new Date().toISOString(),
      });
    });

    // ============= RIDER ONLINE/OFFLINE =============
    socket.on('rider_go_online', (data) => {
      const { riderId } = data;
      socket.join(`rider_${riderId}_availability`);
      io.emit('rider_online', { riderId, isOnline: true });
      console.log(`📍 Rider ${riderId} is now ONLINE`);
    });

    socket.on('rider_go_offline', (data) => {
      const { riderId } = data;
      socket.leave(`rider_${riderId}_availability`);
      io.emit('rider_offline', { riderId, isOnline: false });
      console.log(`📍 Rider ${riderId} is now OFFLINE`);
    });

    // ============= ORDER STATUS BROADCASTS =============
    socket.on('order_status_updated', (data) => {
      const { orderId, status, message } = data;
      io.to(`order_${orderId}`).emit('order_status_changed', {
        orderId,
        status,
        message,
        timestamp: new Date().toISOString(),
      });
      console.log(`📦 Order ${orderId} status: ${status}`);
    });

    // ============= RIDER ASSIGNMENT =============
    socket.on('rider_assigned', (data) => {
      const { orderId, riderId, riderName, riderPhone, riderLocation } = data;
      io.to(`order_${orderId}`).emit('rider_assigned', {
        orderId,
        riderId,
        riderName,
        riderPhone,
        riderLocation,
        message: `${riderName} is on the way to pick up your order`,
        timestamp: new Date().toISOString(),
      });
      console.log(`🏍 Rider ${riderName} assigned to order ${orderId}`);
    });

    // ============= ORDER EVENTS =============
    socket.on('order_accepted', (data) => {
      const { orderId, vendorName } = data;
      io.to(`order_${orderId}`).emit('order_accepted', {
        orderId,
        message: `${vendorName} accepted your order`,
        timestamp: new Date().toISOString(),
      });
    });

    socket.on('food_preparation_started', (data) => {
      const { orderId } = data;
      io.to(`order_${orderId}`).emit('food_preparation_started', {
        orderId,
        message: 'Your food is being prepared',
        timestamp: new Date().toISOString(),
      });
    });

    socket.on('food_ready', (data) => {
      const { orderId } = data;
      io.to(`order_${orderId}`).emit('food_ready', {
        orderId,
        message: 'Your food is ready for pickup',
        timestamp: new Date().toISOString(),
      });
    });

    socket.on('order_picked_up', (data) => {
      const { orderId, riderName } = data;
      io.to(`order_${orderId}`).emit('order_picked_up', {
        orderId,
        message: `${riderName} picked up your order`,
        timestamp: new Date().toISOString(),
      });
    });

    socket.on('delivery_arrived_customer', (data) => {
      const { orderId, riderName } = data;
      io.to(`order_${orderId}`).emit('delivery_arrived_customer', {
        orderId,
        message: `${riderName} has arrived with your order`,
        timestamp: new Date().toISOString(),
      });
    });

    socket.on('order_delivered', (data) => {
      const { orderId } = data;
      io.to(`order_${orderId}`).emit('order_delivered', {
        orderId,
        message: 'Your order has been delivered',
        timestamp: new Date().toISOString(),
      });
    });

    // ============= DELIVERY OTP =============
    socket.on('send_delivery_otp', (data) => {
      const { orderId, customerSocketId, otp } = data; // otp sent from backend, not socket
      io.to(customerSocketId).emit('delivery_otp', {
        orderId,
        message: 'Enter OTP with delivery partner to confirm order',
        // NOTE: Do NOT send OTP in socket, send via SMS/backend
      });
    });

    socket.on('verify_delivery_otp', (data) => {
      const { orderId, otp } = data;
      // Backend verifies OTP against otp_verifications table
      io.to(`order_${orderId}`).emit('delivery_confirmed', {
        orderId,
        message: 'Delivery confirmed',
        timestamp: new Date().toISOString(),
      });
    });

    // ============= NEW ORDER NOTIFICATIONS (Vendor) =============
    socket.on('notify_vendor_new_order', (data) => {
      const { vendorId, orderId, orderNumber, totalAmount } = data;
      io.to(`vendor_${vendorId}`).emit('new_order_received', {
        orderId,
        orderNumber,
        totalAmount,
        message: `New order #${orderNumber} received`,
        timestamp: new Date().toISOString(),
      });
      console.log(`🔔 Vendor ${vendorId} notified of new order`);
    });

    // ============= DISCONNECT =============
    socket.on('disconnect', () => {
      console.log(`❌ Socket disconnected: ${socket.id}`);
    });

    // ============= ERROR HANDLING =============
    socket.on('error', (error) => {
      console.error(`⚠️ Socket error: ${error}`);
    });
  });

  return io;
};

export default socketHandlers;
