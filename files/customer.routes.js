import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { roleGuard } from '../middleware/roleGuard.js';
import * as customerController from '../controllers/customerController.js';

const router = express.Router();

// Profile & Addresses
router.get('/profile', authMiddleware, roleGuard('CUSTOMER'), customerController.getProfile);
router.patch('/profile', authMiddleware, roleGuard('CUSTOMER'), customerController.updateProfile);
router.get('/addresses', authMiddleware, roleGuard('CUSTOMER'), customerController.getAddresses);
router.post('/addresses', authMiddleware, roleGuard('CUSTOMER'), customerController.addAddress);
router.patch('/addresses/:id', authMiddleware, roleGuard('CUSTOMER'), customerController.updateAddress);
router.delete('/addresses/:id', authMiddleware, roleGuard('CUSTOMER'), customerController.deleteAddress);

// Vendors & Menu
router.get('/vendors', authMiddleware, customerController.getVendors);
router.get('/vendors/:id', authMiddleware, customerController.getVendorDetail);
router.get('/vendors/:id/menu', authMiddleware, customerController.getVendorMenu);
router.get('/search', authMiddleware, customerController.searchVendorsAndItems);
router.get('/categories', authMiddleware, customerController.getCategories);

// Cart
router.get('/cart', authMiddleware, roleGuard('CUSTOMER'), customerController.getCart);
router.post('/cart/items', authMiddleware, roleGuard('CUSTOMER'), customerController.addToCart);
router.patch('/cart/items/:id', authMiddleware, roleGuard('CUSTOMER'), customerController.updateCartItem);
router.delete('/cart/items/:id', authMiddleware, roleGuard('CUSTOMER'), customerController.removeCartItem);
router.delete('/cart', authMiddleware, roleGuard('CUSTOMER'), customerController.clearCart);

// Orders
router.post('/orders', authMiddleware, roleGuard('CUSTOMER'), customerController.placeOrder);
router.get('/orders', authMiddleware, roleGuard('CUSTOMER'), customerController.getMyOrders);
router.get('/orders/:id', authMiddleware, roleGuard('CUSTOMER'), customerController.getOrderDetail);
router.get('/orders/:id/tracking', authMiddleware, roleGuard('CUSTOMER'), customerController.getOrderTracking);
router.post('/orders/:id/cancel', authMiddleware, roleGuard('CUSTOMER'), customerController.cancelOrder);

// Payments
router.post('/payments/initiate', authMiddleware, roleGuard('CUSTOMER'), customerController.initiatePayment);
router.post('/payments/verify', authMiddleware, roleGuard('CUSTOMER'), customerController.verifyPayment);

// Support & Notifications
router.post('/complaints', authMiddleware, roleGuard('CUSTOMER'), customerController.raiseComplaint);
router.get('/complaints', authMiddleware, roleGuard('CUSTOMER'), customerController.getComplaints);
router.post('/support/tickets', authMiddleware, roleGuard('CUSTOMER'), customerController.raiseTicket);
router.get('/notifications', authMiddleware, roleGuard('CUSTOMER'), customerController.getNotifications);
router.patch('/notifications/:id/read', authMiddleware, roleGuard('CUSTOMER'), customerController.markNotificationRead);

// Favorites
router.post('/favorites/:vendorId', authMiddleware, roleGuard('CUSTOMER'), customerController.addFavorite);
router.delete('/favorites/:vendorId', authMiddleware, roleGuard('CUSTOMER'), customerController.removeFavorite);

export default router;
