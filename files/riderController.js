import { query } from '../config/database.js';
import { redisSet, redisGet } from '../config/redis.js';
import { successResponse, errorResponse } from '../utils/responses.js';
import { asyncHandler } from '../middleware/errorHandler.js';

export const toggleAvailability = asyncHandler(async (req, res) => {
  const { is_online } = req.body;
  const riderId = req.user.id;
  const riderResult = await query('SELECT id FROM riders WHERE user_id = $1', [riderId]);
  const id = riderResult.rows[0].id;
  await query('UPDATE rider_availability SET is_online = $1, last_seen = NOW() WHERE rider_id = $2', [is_online, id]);
  await redisSet(`rider:${id}:online`, is_online, 86400);
  successResponse(res, {}, 'Availability updated');
});

export const updateLocation = asyncHandler(async (req, res) => {
  const { latitude, longitude } = req.body;
  const riderId = req.user.id;
  const riderResult = await query('SELECT id FROM riders WHERE user_id = $1', [riderId]);
  const id = riderResult.rows[0].id;
  await redisSet(`rider:${id}:location`, { latitude, longitude }, 300);
  successResponse(res, {}, 'Location updated');
});

export const getOrders = asyncHandler(async (req, res) => {
  const riderId = req.user.id;
  const result = await query(
    `SELECT o.* FROM orders o 
     JOIN riders r ON o.rider_id = r.id 
     WHERE r.user_id = $1 ORDER BY o.created_at DESC`,
    [riderId]
  );
  successResponse(res, result.rows);
});

export const getOrderDetail = asyncHandler(async (req, res) => {
  const orderId = req.params.id;
  const result = await query(
    `SELECT o.*, ca.street, ca.city, ca.latitude, ca.longitude, ca.house_number FROM orders o 
     JOIN customer_addresses ca ON o.address_id = ca.id WHERE o.id = $1`,
    [orderId]
  );
  successResponse(res, result.rows[0]);
});

export const acceptDelivery = asyncHandler(async (req, res) => {
  const orderId = req.params.id;
  const riderId = req.user.id;
  const riderResult = await query('SELECT id FROM riders WHERE user_id = $1', [riderId]);
  const id = riderResult.rows[0].id;
  await query('UPDATE rider_assignments SET status = $1, accepted_at = NOW() WHERE order_id = $2 AND rider_id = $3', ['ACCEPTED', orderId, id]);
  successResponse(res, {}, 'Delivery accepted');
});

export const rejectDelivery = asyncHandler(async (req, res) => {
  const orderId = req.params.id;
  const riderId = req.user.id;
  const riderResult = await query('SELECT id FROM riders WHERE user_id = $1', [riderId]);
  const id = riderResult.rows[0].id;
  await query('UPDATE rider_assignments SET status = $1 WHERE order_id = $2 AND rider_id = $3', ['REJECTED', orderId, id]);
  successResponse(res, {}, 'Delivery rejected');
});

export const arrivedVendor = asyncHandler(async (req, res) => {
  const orderId = req.params.id;
  const riderId = req.user.id;
  const riderResult = await query('SELECT id FROM riders WHERE user_id = $1', [riderId]);
  const id = riderResult.rows[0].id;
  await query(
    'INSERT INTO delivery_tracking_events (order_id, rider_id, event_type, event_time) VALUES ($1, $2, $3, NOW())',
    [orderId, id, 'ARRIVED_VENDOR']
  );
  successResponse(res, {}, 'Arrived at vendor');
});

export const pickedUp = asyncHandler(async (req, res) => {
  const orderId = req.params.id;
  const riderId = req.user.id;
  const riderResult = await query('SELECT id FROM riders WHERE user_id = $1', [riderId]);
  const id = riderResult.rows[0].id;
  await query('UPDATE orders SET status = $1 WHERE id = $2', ['PICKED_UP', orderId]);
  await query(
    'INSERT INTO delivery_tracking_events (order_id, rider_id, event_type, event_time) VALUES ($1, $2, $3, NOW())',
    [orderId, id, 'PICKED_UP']
  );
  successResponse(res, {}, 'Order picked up');
});

export const arrivedCustomer = asyncHandler(async (req, res) => {
  const orderId = req.params.id;
  const riderId = req.user.id;
  const riderResult = await query('SELECT id FROM riders WHERE user_id = $1', [riderId]);
  const id = riderResult.rows[0].id;
  await query(
    'INSERT INTO delivery_tracking_events (order_id, rider_id, event_type, event_time) VALUES ($1, $2, $3, NOW())',
    [orderId, id, 'ARRIVED_CUSTOMER']
  );
  successResponse(res, {}, 'Arrived at customer');
});

export const deliverOrder = asyncHandler(async (req, res) => {
  const { otp } = req.body;
  const orderId = req.params.id;
  const riderId = req.user.id;
  const riderResult = await query('SELECT id FROM riders WHERE user_id = $1', [riderId]);
  const id = riderResult.rows[0].id;
  
  // TODO: Verify OTP from otp_verifications table
  
  await query('UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2', ['DELIVERED', orderId]);
  await query('UPDATE rider_assignments SET status = $1, completed_at = NOW() WHERE order_id = $2', ['COMPLETED', orderId]);
  await query(
    'INSERT INTO delivery_tracking_events (order_id, rider_id, event_type, event_time) VALUES ($1, $2, $3, NOW())',
    [orderId, id, 'DELIVERED']
  );
  successResponse(res, {}, 'Order delivered');
});

export const getEarnings = asyncHandler(async (req, res) => {
  const riderId = req.user.id;
  const result = await query(
    `SELECT * FROM rider_earnings 
     WHERE rider_id = (SELECT id FROM riders WHERE user_id = $1) 
     ORDER BY created_at DESC`,
    [riderId]
  );
  successResponse(res, result.rows);
});

export const getEarningsSummary = asyncHandler(async (req, res) => {
  const riderId = req.user.id;
  const result = await query(
    `SELECT DATE(created_at) as date, SUM(earning_amount) as daily_earnings 
     FROM rider_earnings 
     WHERE rider_id = (SELECT id FROM riders WHERE user_id = $1) 
     GROUP BY DATE(created_at) ORDER BY date DESC LIMIT 30`,
    [riderId]
  );
  successResponse(res, result.rows);
});

export const getShifts = asyncHandler(async (req, res) => {
  const riderId = req.user.id;
  const result = await query(
    `SELECT * FROM rider_shift_logs 
     WHERE rider_id = (SELECT id FROM riders WHERE user_id = $1) 
     ORDER BY login_time DESC`,
    [riderId]
  );
  successResponse(res, result.rows);
});

export const getSettlements = asyncHandler(async (req, res) => {
  const riderId = req.user.id;
  const result = await query(
    `SELECT * FROM rider_settlements 
     WHERE rider_id = (SELECT id FROM riders WHERE user_id = $1) 
     ORDER BY settlement_date DESC`,
    [riderId]
  );
  successResponse(res, result.rows);
});

export const getPayouts = asyncHandler(async (req, res) => {
  const riderId = req.user.id;
  const result = await query(
    `SELECT * FROM rider_payout_transactions 
     WHERE rider_id = (SELECT id FROM riders WHERE user_id = $1) 
     ORDER BY created_at DESC`,
    [riderId]
  );
  successResponse(res, result.rows);
});

export const getNotifications = asyncHandler(async (req, res) => {
  const riderId = req.user.id;
  const result = await query(
    `SELECT * FROM notifications 
     WHERE user_id = $1 ORDER BY created_at DESC`,
    [riderId]
  );
  successResponse(res, result.rows);
});

export default {
  toggleAvailability, updateLocation, getOrders, getOrderDetail,
  acceptDelivery, rejectDelivery, arrivedVendor, pickedUp,
  arrivedCustomer, deliverOrder, getEarnings, getEarningsSummary,
  getShifts, getSettlements, getPayouts, getNotifications
};
