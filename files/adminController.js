import { query } from '../config/database.js';
import { successResponse, errorResponse, paginatedResponse } from '../utils/responses.js';
import { asyncHandler } from '../middleware/errorHandler.js';

export const getLiveDashboard = asyncHandler(async (req, res) => {
  const ordersResult = await query('SELECT COUNT(*) as total FROM orders WHERE status NOT IN ($1, $2)', ['DELIVERED', 'CANCELLED']);
  const vendorsResult = await query('SELECT COUNT(*) as total FROM vendors WHERE status = $1', ['ACTIVE']);
  const ridersResult = await query('SELECT COUNT(*) as total FROM riders WHERE status = $1', ['ACTIVE']);
  const customersResult = await query('SELECT COUNT(*) as total FROM customer_profiles');
  
  successResponse(res, {
    active_orders: parseInt(ordersResult.rows[0].total),
    active_vendors: parseInt(vendorsResult.rows[0].total),
    active_riders: parseInt(ridersResult.rows[0].total),
    total_customers: parseInt(customersResult.rows[0].total),
  });
});

export const getDailyAnalytics = asyncHandler(async (req, res) => {
  const result = await query('SELECT * FROM daily_metrics ORDER BY metric_date DESC LIMIT 30');
  successResponse(res, result.rows);
});

export const getDemandSupplyMetrics = asyncHandler(async (req, res) => {
  const result = await query('SELECT * FROM demand_supply_metrics ORDER BY created_at DESC');
  successResponse(res, result.rows);
});

export const getAllOrders = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;
  
  let whereClause = '1=1';
  let params = [];
  
  if (status) {
    whereClause += ` AND o.status = $${params.length + 1}`;
    params.push(status);
  }
  
  const result = await query(
    `SELECT o.* FROM orders o WHERE ${whereClause} ORDER BY o.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );
  
  successResponse(res, result.rows);
});

export const getOrderDetail = asyncHandler(async (req, res) => {
  const orderId = req.params.id;
  const result = await query('SELECT * FROM orders WHERE id = $1', [orderId]);
  successResponse(res, result.rows[0]);
});

export const cancelOrder = asyncHandler(async (req, res) => {
  const orderId = req.params.id;
  await query('UPDATE orders SET status = $1 WHERE id = $2', ['CANCELLED', orderId]);
  successResponse(res, {}, 'Order cancelled');
});

export const approveRefund = asyncHandler(async (req, res) => {
  const { payment_id, amount } = req.body;
  const result = await query(
    'INSERT INTO refunds (payment_id, amount, reason, status, created_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING *',
    [payment_id, amount, 'Admin approved', 'PENDING']
  );
  successResponse(res, result.rows[0], 'Refund approved', 201);
});

export const getVendors = asyncHandler(async (req, res) => {
  const result = await query('SELECT * FROM vendors ORDER BY created_at DESC');
  successResponse(res, result.rows);
});

export const addVendor = asyncHandler(async (req, res) => {
  const { name, phone, email } = req.body;
  // Create user + vendor
  successResponse(res, {}, 'Vendor added', 201);
});

export const updateVendorStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const vendorId = req.params.id;
  await query('UPDATE vendors SET status = $1 WHERE id = $2', [status, vendorId]);
  successResponse(res, {}, 'Vendor status updated');
});

export const getVendorDocuments = asyncHandler(async (req, res) => {
  const vendorId = req.params.id;
  const result = await query('SELECT * FROM vendor_documents WHERE vendor_id = $1', [vendorId]);
  successResponse(res, result.rows);
});

export const verifyVendorDocument = asyncHandler(async (req, res) => {
  const { verification_status } = req.body;
  const docId = req.params.docId;
  await query('UPDATE vendor_documents SET verification_status = $1 WHERE id = $2', [verification_status, docId]);
  successResponse(res, {}, 'Document verification updated');
});

export const getRiders = asyncHandler(async (req, res) => {
  const result = await query('SELECT * FROM riders ORDER BY created_at DESC');
  successResponse(res, result.rows);
});

export const addRider = asyncHandler(async (req, res) => {
  const { name, phone } = req.body;
  successResponse(res, {}, 'Rider added', 201);
});

export const updateRiderStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const riderId = req.params.id;
  await query('UPDATE riders SET status = $1 WHERE id = $2', [status, riderId]);
  successResponse(res, {}, 'Rider status updated');
});

export const getRiderDocuments = asyncHandler(async (req, res) => {
  const riderId = req.params.id;
  const result = await query('SELECT * FROM rider_documents WHERE rider_id = $1', [riderId]);
  successResponse(res, result.rows);
});

export const verifyRiderDocument = asyncHandler(async (req, res) => {
  const { verification_status } = req.body;
  const docId = req.params.docId;
  await query('UPDATE rider_documents SET verification_status = $1 WHERE id = $2', [verification_status, docId]);
  successResponse(res, {}, 'Document verification updated');
});

export const getTickets = asyncHandler(async (req, res) => {
  const result = await query('SELECT * FROM support_tickets ORDER BY created_at DESC');
  successResponse(res, result.rows);
});

export const respondTicket = asyncHandler(async (req, res) => {
  const { response } = req.body;
  const ticketId = req.params.id;
  await query('UPDATE support_tickets SET status = $1 WHERE id = $2', ['RESOLVED', ticketId]);
  successResponse(res, {}, 'Ticket responded');
});

export const getComplaints = asyncHandler(async (req, res) => {
  const result = await query('SELECT * FROM complaints ORDER BY created_at DESC');
  successResponse(res, result.rows);
});

export const respondComplaint = asyncHandler(async (req, res) => {
  const { response } = req.body;
  const complaintId = req.params.id;
  const adminId = req.user.id;
  await query('INSERT INTO complaint_responses (complaint_id, admin_id, response, created_at) VALUES ($1, $2, $3, NOW())', [complaintId, adminId, response]);
  successResponse(res, {}, 'Complaint responded');
});

export const getAuditLogs = asyncHandler(async (req, res) => {
  const result = await query('SELECT * FROM admin_actions ORDER BY created_at DESC LIMIT 100');
  successResponse(res, result.rows);
});

export const getFraudFlags = asyncHandler(async (req, res) => {
  const result = await query('SELECT * FROM fraud_flags ORDER BY created_at DESC');
  successResponse(res, result.rows);
});

export const updateFraudFlag = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const flagId = req.params.id;
  await query('UPDATE fraud_flags SET status = $1 WHERE id = $2', [status, flagId]);
  successResponse(res, {}, 'Fraud flag updated');
});

export default {
  getLiveDashboard, getDailyAnalytics, getDemandSupplyMetrics,
  getAllOrders, getOrderDetail, cancelOrder, approveRefund,
  getVendors, addVendor, updateVendorStatus, getVendorDocuments, verifyVendorDocument,
  getRiders, addRider, updateRiderStatus, getRiderDocuments, verifyRiderDocument,
  getTickets, respondTicket, getComplaints, respondComplaint,
  getAuditLogs, getFraudFlags, updateFraudFlag
};
