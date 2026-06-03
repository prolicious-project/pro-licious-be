import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import http from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import authRoutes from './src/routes/auth.routes.js';
import customerRoutes from './src/routes/customer.routes.js';
import vendorRoutes from './src/routes/vendor.routes.js';
import riderRoutes from './src/routes/rider.routes.js';
import adminRoutes from './src/routes/admin.routes.js';
import { errorHandler } from './src/middleware/errorHandler.js';
import { socketHandlers } from './src/socket/handlers.js';
import { redisClient } from './src/config/redis.js';
import { createAdapter } from '@socket.io/redis-adapter';

dotenv.config();

const app = express();
const server = http.createServer(app);

// ============= MIDDLEWARE =============
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// ============= API ROUTES =============
app.use('/api/auth', authRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/vendor', vendorRoutes);
app.use('/api/rider', riderRoutes);
app.use('/api/admin', adminRoutes);

// ============= SOCKET.IO SETUP =============
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

// Redis adapter for multi-server scaling
io.adapter(createAdapter(redisClient, redisClient.duplicate()));

// Socket handlers
socketHandlers(io);

// ============= ERROR HANDLING =============
app.use(errorHandler);

// ============= 404 HANDLER =============
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found', path: req.path });
});

// ============= SERVER START =============
const PORT = process.env.PORT || 5000;

server.listen(PORT, async () => {
  try {
    await redisClient.connect();
    console.log('✅ Redis connected');
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`📡 Socket.IO ready for connections`);
  } catch (err) {
    console.error('❌ Redis connection failed:', err.message);
    process.exit(1);
  }
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await redisClient.disconnect();
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

export { app, server, io };
