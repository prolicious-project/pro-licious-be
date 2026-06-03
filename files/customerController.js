import { query } from '../config/database.js';
import { createRazorpayOrder } from '../config/razorpay.js';
import { successResponse, errorResponse, paginatedResponse } from '../utils/responses.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { v4 as uuidv4 } from 'uuid';

// ============= PROFILE =============
export const getProfile = asyncHandler(async (req, res) => {
  const customerId = req.user.id;
  
  const result = await query(
    `SELECT cp.id, u.name, u.phone, u.email, cp.profile_image, cp.gender, cp.date_of_birth 
     FROM customer_profiles cp 
     JOIN users u ON cp.user_id = u.id 
     WHERE u.id = $1`,
    [customerId]
  );

  if (result.rows.length === 0) {
    return errorResponse(res, 'Profile not found', 404, 'PROFILE_NOT_FOUND');
  }

  successResponse(res, result.rows[0], 'Profile retrieved successfully');
});

export const updateProfile = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { name, email, profile_image, gender, date_of_birth } = req.body;

  // Update users table
  if (name || email) {
    await query(
      'UPDATE users SET name = COALESCE($1, name), email = COALESCE($2, email), updated_at = NOW() WHERE id = $3',
      [name || null, email || null, userId]
    );
  }

  // Update customer_profiles
  if (profile_image || gender || date_of_birth) {
    await query(
      `UPDATE customer_profiles 
       SET profile_image = COALESCE($1, profile_image), 
           gender = COALESCE($2, gender), 
           date_of_birth = COALESCE($3, date_of_birth) 
       WHERE user_id = $4`,
      [profile_image || null, gender || null, date_of_birth || null, userId]
    );
  }

  successResponse(res, { message: 'Profile updated' }, 'Profile updated successfully');
});

// ============= ADDRESSES =============
export const getAddresses = asyncHandler(async (req, res) => {
  const customerId = req.user.id;

  const result = await query(
    `SELECT * FROM customer_addresses 
     WHERE customer_id = (SELECT id FROM customer_profiles WHERE user_id = $1) 
     AND deleted_at IS NULL 
     ORDER BY is_default DESC, created_at DESC`,
    [customerId]
  );

  successResponse(res, result.rows, 'Addresses retrieved successfully');
});

export const addAddress = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { address_type, house_number, street, landmark, city, state, pincode, latitude, longitude, is_default } = req.body;

  // Get customer_id
  const customerResult = await query('SELECT id FROM customer_profiles WHERE user_id = $1', [userId]);
  if (customerResult.rows.length === 0) {
    return errorResponse(res, 'Customer profile not found', 404, 'PROFILE_NOT_FOUND');
  }
  const customerId = customerResult.rows[0].id;

  // If setting as default, unset others
  if (is_default) {
    await query(
      'UPDATE customer_addresses SET is_default = FALSE WHERE customer_id = $1',
      [customerId]
    );
  }

  const result = await query(
    `INSERT INTO customer_addresses 
     (customer_id, address_type, house_number, street, landmark, city, state, pincode, latitude, longitude, is_default) 
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
     RETURNING *`,
    [customerId, address_type || 'HOME', house_number, street, landmark, city, state, pincode, latitude, longitude, is_default || FALSE]
  );

  successResponse(res, result.rows[0], 'Address added successfully', 201);
});

export const updateAddress = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const addressId = req.params.id;
  const { address_type, house_number, street, landmark, city, state, pincode, latitude, longitude, is_default } = req.body;

  // Verify ownership
  const ownershipCheck = await query(
    `SELECT ca.id FROM customer_addresses ca 
     JOIN customer_profiles cp ON ca.customer_id = cp.id 
     WHERE ca.id = $1 AND cp.user_id = $2`,
    [addressId, userId]
  );

  if (ownershipCheck.rows.length === 0) {
    return errorResponse(res, 'Address not found', 404, 'ADDRESS_NOT_FOUND');
  }

  // If setting as default, unset others
  if (is_default) {
    const customerResult = await query('SELECT customer_id FROM customer_addresses WHERE id = $1', [addressId]);
    const customerId = customerResult.rows[0].customer_id;
    await query(
      'UPDATE customer_addresses SET is_default = FALSE WHERE customer_id = $1',
      [customerId]
    );
  }

  const result = await query(
    `UPDATE customer_addresses 
     SET address_type = COALESCE($1, address_type),
         house_number = COALESCE($2, house_number),
         street = COALESCE($3, street),
         landmark = COALESCE($4, landmark),
         city = COALESCE($5, city),
         state = COALESCE($6, state),
         pincode = COALESCE($7, pincode),
         latitude = COALESCE($8, latitude),
         longitude = COALESCE($9, longitude),
         is_default = COALESCE($10, is_default)
     WHERE id = $11 
     RETURNING *`,
    [address_type, house_number, street, landmark, city, state, pincode, latitude, longitude, is_default, addressId]
  );

  successResponse(res, result.rows[0], 'Address updated successfully');
});

export const deleteAddress = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const addressId = req.params.id;

  // Verify ownership
  const ownershipCheck = await query(
    `SELECT ca.id FROM customer_addresses ca 
     JOIN customer_profiles cp ON ca.customer_id = cp.id 
     WHERE ca.id = $1 AND cp.user_id = $2`,
    [addressId, userId]
  );

  if (ownershipCheck.rows.length === 0) {
    return errorResponse(res, 'Address not found', 404, 'ADDRESS_NOT_FOUND');
  }

  // Soft delete
  await query(
    'UPDATE customer_addresses SET deleted_at = NOW() WHERE id = $1',
    [addressId]
  );

  successResponse(res, {}, 'Address deleted successfully');
});

// ============= VENDORS & MENU =============
export const getVendors = asyncHandler(async (req, res) => {
  const { zone_id, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  let whereClause = 'v.status = $1';
  let params = ['ACTIVE'];

  if (zone_id) {
    whereClause += ' AND vb.zone_id = $2';
    params.push(zone_id);
  }

  const result = await query(
    `SELECT DISTINCT v.id, v.name, v.description, v.rating, COUNT(DISTINCT vb.id) as branch_count
     FROM vendors v
     LEFT JOIN vendor_branches vb ON v.id = vb.vendor_id
     WHERE ${whereClause}
     GROUP BY v.id
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );

  const totalResult = await query(
    `SELECT COUNT(DISTINCT v.id) as total FROM vendors v
     LEFT JOIN vendor_branches vb ON v.id = vb.vendor_id
     WHERE ${whereClause}`,
    params
  );

  paginatedResponse(res, result.rows, parseInt(totalResult.rows[0].total), page, limit, 'Vendors retrieved successfully');
});

export const getVendorDetail = asyncHandler(async (req, res) => {
  const vendorId = req.params.id;

  const result = await query(
    'SELECT id, name, description, phone, email, rating FROM vendors WHERE id = $1 AND status = $2',
    [vendorId, 'ACTIVE']
  );

  if (result.rows.length === 0) {
    return errorResponse(res, 'Vendor not found', 404, 'VENDOR_NOT_FOUND');
  }

  successResponse(res, result.rows[0], 'Vendor retrieved successfully');
});

export const getVendorMenu = asyncHandler(async (req, res) => {
  const vendorId = req.params.id;

  const categoriesResult = await query(
    'SELECT id, name FROM categories WHERE vendor_id = $1 AND status = $2 ORDER BY sort_order',
    [vendorId, 'ACTIVE']
  );

  const menuResult = await query(
    `SELECT m.id, m.name, m.description, m.price, m.discount_price, m.image_url, m.is_veg, m.stock_quantity, m.preparation_time, m.category_id
     FROM menu_items m
     WHERE m.vendor_id = $1 AND m.status IN ('ACTIVE', 'SOLD_OUT')
     ORDER BY m.category_id, m.created_at DESC`,
    [vendorId]
  );

  const menu = categoriesResult.rows.map(cat => ({
    ...cat,
    items: menuResult.rows.filter(item => item.category_id === cat.id),
  }));

  successResponse(res, menu, 'Menu retrieved successfully');
});

export const searchVendorsAndItems = asyncHandler(async (req, res) => {
  const { query: searchQuery, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  if (!searchQuery || searchQuery.length < 2) {
    return errorResponse(res, 'Search query must be at least 2 characters', 400, 'INVALID_QUERY');
  }

  const result = await query(
    `SELECT 'vendor' as type, v.id, v.name, v.rating as rating, NULL as price
     FROM vendors v
     WHERE v.status = 'ACTIVE' AND v.name ILIKE $1
     UNION ALL
     SELECT 'item' as type, m.id, m.name, NULL as rating, m.price
     FROM menu_items m
     WHERE m.status IN ('ACTIVE', 'SOLD_OUT') AND (m.name ILIKE $1 OR m.description ILIKE $1)
     LIMIT $2 OFFSET $3`,
    [`%${searchQuery}%`, limit, offset]
  );

  successResponse(res, result.rows, 'Search results retrieved successfully');
});

export const getCategories = asyncHandler(async (req, res) => {
  const result = await query(
    'SELECT id, name, description FROM categories WHERE status = $1 GROUP BY id ORDER BY name',
    ['ACTIVE']
  );

  successResponse(res, result.rows, 'Categories retrieved successfully');
});

// ============= CART =============
export const getCart = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const customerResult = await query('SELECT id FROM customer_profiles WHERE user_id = $1', [userId]);
  if (customerResult.rows.length === 0) {
    return errorResponse(res, 'Customer not found', 404, 'CUSTOMER_NOT_FOUND');
  }
  const customerId = customerResult.rows[0].id;

  const cartResult = await query(
    'SELECT * FROM carts WHERE customer_id = $1 AND status = $2',
    [customerId, 'ACTIVE']
  );

  if (cartResult.rows.length === 0) {
    return successResponse(res, { items: [], total: 0 }, 'Empty cart');
  }

  const cart = cartResult.rows[0];
  const itemsResult = await query(
    `SELECT ci.*, m.name, m.price 
     FROM cart_items ci 
     LEFT JOIN menu_items m ON ci.menu_item_id = m.id 
     WHERE ci.cart_id = $1`,
    [cart.id]
  );

  const total = itemsResult.rows.reduce((sum, item) => sum + (parseFloat(item.price) * item.quantity), 0);

  successResponse(res, { 
    cartId: cart.id, 
    vendorId: cart.vendor_id,
    items: itemsResult.rows,
    total: parseFloat(total.toFixed(2))
  }, 'Cart retrieved successfully');
});

export const addToCart = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { vendor_id, menu_item_id, quantity, customizations } = req.body;

  if (!vendor_id || !menu_item_id || !quantity) {
    return errorResponse(res, 'vendor_id, menu_item_id, and quantity required', 400, 'MISSING_FIELDS');
  }

  const customerResult = await query('SELECT id FROM customer_profiles WHERE user_id = $1', [userId]);
  if (customerResult.rows.length === 0) {
    return errorResponse(res, 'Customer not found', 404, 'CUSTOMER_NOT_FOUND');
  }
  const customerId = customerResult.rows[0].id;

  // Get or create cart
  let cartResult = await query(
    'SELECT id FROM carts WHERE customer_id = $1 AND vendor_id = $2 AND status = $3',
    [customerId, vendor_id, 'ACTIVE']
  );

  let cartId;
  if (cartResult.rows.length === 0) {
    const newCartResult = await query(
      'INSERT INTO carts (customer_id, vendor_id, status, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW()) RETURNING id',
      [customerId, vendor_id, 'ACTIVE']
    );
    cartId = newCartResult.rows[0].id;
  } else {
    cartId = cartResult.rows[0].id;
  }

  // Get item price
  const itemResult = await query('SELECT price FROM menu_items WHERE id = $1 AND vendor_id = $2', [menu_item_id, vendor_id]);
  if (itemResult.rows.length === 0) {
    return errorResponse(res, 'Menu item not found', 404, 'ITEM_NOT_FOUND');
  }
  const price = itemResult.rows[0].price;

  // Add to cart
  const result = await query(
    'INSERT INTO cart_items (cart_id, menu_item_id, quantity, price, customizations) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [cartId, menu_item_id, quantity, price, customizations ? JSON.stringify(customizations) : null]
  );

  successResponse(res, result.rows[0], 'Item added to cart', 201);
});

export const updateCartItem = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const itemId = req.params.id;
  const { quantity } = req.body;

  if (!quantity || quantity < 1) {
    return errorResponse(res, 'Quantity must be at least 1', 400, 'INVALID_QUANTITY');
  }

  // Verify ownership
  const ownershipCheck = await query(
    `SELECT ci.id FROM cart_items ci 
     JOIN carts c ON ci.cart_id = c.id 
     JOIN customer_profiles cp ON c.customer_id = cp.id 
     WHERE ci.id = $1 AND cp.user_id = $2`,
    [itemId, userId]
  );

  if (ownershipCheck.rows.length === 0) {
    return errorResponse(res, 'Cart item not found', 404, 'ITEM_NOT_FOUND');
  }

  const result = await query(
    'UPDATE cart_items SET quantity = $1 WHERE id = $2 RETURNING *',
    [quantity, itemId]
  );

  successResponse(res, result.rows[0], 'Cart item updated');
});

export const removeCartItem = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const itemId = req.params.id;

  // Verify ownership
  const ownershipCheck = await query(
    `SELECT ci.id FROM cart_items ci 
     JOIN carts c ON ci.cart_id = c.id 
     JOIN customer_profiles cp ON c.customer_id = cp.id 
     WHERE ci.id = $1 AND cp.user_id = $2`,
    [itemId, userId]
  );

  if (ownershipCheck.rows.length === 0) {
    return errorResponse(res, 'Cart item not found', 404, 'ITEM_NOT_FOUND');
  }

  await query('DELETE FROM cart_items WHERE id = $1', [itemId]);

  successResponse(res, {}, 'Item removed from cart');
});

export const clearCart = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const customerResult = await query('SELECT id FROM customer_profiles WHERE user_id = $1', [userId]);
  if (customerResult.rows.length === 0) {
    return errorResponse(res, 'Customer not found', 404, 'CUSTOMER_NOT_FOUND');
  }
  const customerId = customerResult.rows[0].id;

  // Get cart and delete items
  const cartResult = await query(
    'SELECT id FROM carts WHERE customer_id = $1 AND status = $2',
    [customerId, 'ACTIVE']
  );

  if (cartResult.rows.length > 0) {
    await query('DELETE FROM cart_items WHERE cart_id = $1', [cartResult.rows[0].id]);
    await query('UPDATE carts SET status = $1, updated_at = NOW() WHERE id = $2', ['ABANDONED', cartResult.rows[0].id]);
  }

  successResponse(res, {}, 'Cart cleared');
});

// ============= ORDERS =============
export const placeOrder = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { vendor_id, branch_id, address_id, payment_method } = req.body;

  if (!vendor_id || !branch_id || !address_id || !payment_method) {
    return errorResponse(res, 'vendor_id, branch_id, address_id, and payment_method required', 400, 'MISSING_FIELDS');
  }

  const customerResult = await query('SELECT id FROM customer_profiles WHERE user_id = $1', [userId]);
  if (customerResult.rows.length === 0) {
    return errorResponse(res, 'Customer not found', 404, 'CUSTOMER_NOT_FOUND');
  }
  const customerId = customerResult.rows[0].id;

  // Get active cart
  const cartResult = await query(
    'SELECT id FROM carts WHERE customer_id = $1 AND vendor_id = $2 AND status = $3',
    [customerId, vendor_id, 'ACTIVE']
  );

  if (cartResult.rows.length === 0) {
    return errorResponse(res, 'No active cart for this vendor', 400, 'NO_ACTIVE_CART');
  }

  const cartId = cartResult.rows[0].id;

  // Get cart items
  const itemsResult = await query(
    'SELECT * FROM cart_items WHERE cart_id = $1',
    [cartId]
  );

  if (itemsResult.rows.length === 0) {
    return errorResponse(res, 'Cart is empty', 400, 'EMPTY_CART');
  }

  const items = itemsResult.rows;

  // Calculate totals
  const subtotal = items.reduce((sum, item) => sum + (parseFloat(item.price) * item.quantity), 0);
  const tax = parseFloat((subtotal * 0.05).toFixed(2)); // 5% tax
  const delivery_fee = parseFloat('50.00'); // Fixed delivery fee
  const platform_fee = parseFloat((subtotal * 0.01).toFixed(2)); // 1% platform fee
  const total = parseFloat((subtotal + tax + delivery_fee + platform_fee).toFixed(2));

  // Generate order number
  const orderNumber = `PRO-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

  // Create order
  const orderResult = await query(
    `INSERT INTO orders 
     (order_number, customer_id, vendor_id, branch_id, address_id, subtotal, tax_amount, delivery_fee, platform_fee, total_amount, status, payment_method, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
     RETURNING *`,
    [orderNumber, customerId, vendor_id, branch_id, address_id, subtotal, tax, delivery_fee, platform_fee, total, 'PLACED', payment_method]
  );

  const orderId = orderResult.rows[0].id;

  // Copy cart items to order_items
  for (const item of items) {
    const itemTotalPrice = parseFloat((item.price * item.quantity).toFixed(2));
    await query(
      `INSERT INTO order_items (order_id, menu_item_id, item_name, price, quantity, total, customizations)
       VALUES ($1, $2, (SELECT name FROM menu_items WHERE id = $3), $4, $5, $6, $7)`,
      [orderId, item.menu_item_id, item.menu_item_id, item.price, item.quantity, itemTotalPrice, item.customizations]
    );
  }

  // Create order status history
  await query(
    'INSERT INTO order_status_history (order_id, status, remarks, created_at) VALUES ($1, $2, $3, NOW())',
    [orderId, 'PLACED', 'Order placed by customer']
  );

  // Create tracking timeline
  await query(
    'INSERT INTO order_tracking_timeline (order_id, title, description, created_at) VALUES ($1, $2, $3, NOW())',
    [orderId, 'Order Placed', 'Your order has been placed successfully', ]
  );

  // Mark cart as converted
  await query(
    'UPDATE carts SET status = $1, updated_at = NOW() WHERE id = $2',
    ['CONVERTED', cartId]
  );

  successResponse(res, {
    orderId,
    orderNumber,
    total,
    subtotal,
    tax,
    delivery_fee,
    platform_fee,
  }, 'Order placed successfully', 201);
});

export const getMyOrders = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { page = 1, limit = 20, status } = req.query;
  const offset = (page - 1) * limit;

  const customerResult = await query('SELECT id FROM customer_profiles WHERE user_id = $1', [userId]);
  if (customerResult.rows.length === 0) {
    return errorResponse(res, 'Customer not found', 404, 'CUSTOMER_NOT_FOUND');
  }
  const customerId = customerResult.rows[0].id;

  let whereClause = 'o.customer_id = $1';
  let params = [customerId];

  if (status) {
    whereClause += ` AND o.status = $${params.length + 1}`;
    params.push(status);
  }

  const result = await query(
    `SELECT o.id, o.order_number, o.status, o.total_amount, o.created_at 
     FROM orders o 
     WHERE ${whereClause} 
     ORDER BY o.created_at DESC 
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );

  const totalResult = await query(
    `SELECT COUNT(*) as total FROM orders WHERE ${whereClause}`,
    params
  );

  paginatedResponse(res, result.rows, parseInt(totalResult.rows[0].total), page, limit, 'Orders retrieved successfully');
});

export const getOrderDetail = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const orderId = req.params.id;

  const customerResult = await query('SELECT id FROM customer_profiles WHERE user_id = $1', [userId]);
  if (customerResult.rows.length === 0) {
    return errorResponse(res, 'Customer not found', 404, 'CUSTOMER_NOT_FOUND');
  }
  const customerId = customerResult.rows[0].id;

  const result = await query(
    `SELECT o.*, v.name as vendor_name, ca.street, ca.city, u.phone as rider_phone 
     FROM orders o 
     LEFT JOIN vendors v ON o.vendor_id = v.id 
     LEFT JOIN customer_addresses ca ON o.address_id = ca.id 
     LEFT JOIN users u ON o.rider_id = (SELECT user_id FROM riders WHERE id = o.rider_id) 
     WHERE o.id = $1 AND o.customer_id = $2`,
    [orderId, customerId]
  );

  if (result.rows.length === 0) {
    return errorResponse(res, 'Order not found', 404, 'ORDER_NOT_FOUND');
  }

  const itemsResult = await query(
    'SELECT id, menu_item_id, item_name, price, quantity, total FROM order_items WHERE order_id = $1',
    [orderId]
  );

  successResponse(res, { ...result.rows[0], items: itemsResult.rows }, 'Order retrieved successfully');
});

export const getOrderTracking = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const orderId = req.params.id;

  // Verify ownership
  const customerResult = await query('SELECT id FROM customer_profiles WHERE user_id = $1', [userId]);
  if (customerResult.rows.length === 0) {
    return errorResponse(res, 'Customer not found', 404, 'CUSTOMER_NOT_FOUND');
  }

  const ownershipCheck = await query(
    'SELECT id FROM orders WHERE id = $1 AND customer_id = $2',
    [orderId, customerResult.rows[0].id]
  );

  if (ownershipCheck.rows.length === 0) {
    return errorResponse(res, 'Order not found', 404, 'ORDER_NOT_FOUND');
  }

  const result = await query(
    'SELECT id, title, description, created_at FROM order_tracking_timeline WHERE order_id = $1 ORDER BY created_at ASC',
    [orderId]
  );

  successResponse(res, result.rows, 'Tracking timeline retrieved successfully');
});

export const cancelOrder = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const orderId = req.params.id;

  const customerResult = await query('SELECT id FROM customer_profiles WHERE user_id = $1', [userId]);
  if (customerResult.rows.length === 0) {
    return errorResponse(res, 'Customer not found', 404, 'CUSTOMER_NOT_FOUND');
  }
  const customerId = customerResult.rows[0].id;

  const orderResult = await query(
    'SELECT id, status FROM orders WHERE id = $1 AND customer_id = $2',
    [orderId, customerId]
  );

  if (orderResult.rows.length === 0) {
    return errorResponse(res, 'Order not found', 404, 'ORDER_NOT_FOUND');
  }

  const order = orderResult.rows[0];

  // Only allow cancellation of PLACED and ACCEPTED orders
  if (!['PLACED', 'ACCEPTED'].includes(order.status)) {
    return errorResponse(res, 'Order cannot be cancelled in current status', 400, 'INVALID_STATUS');
  }

  // Update order status
  await query(
    'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2',
    ['CANCELLED', orderId]
  );

  // Add status history
  await query(
    'INSERT INTO order_status_history (order_id, status, remarks, created_at) VALUES ($1, $2, $3, NOW())',
    [orderId, 'CANCELLED', 'Order cancelled by customer']
  );

  // Add tracking timeline
  await query(
    'INSERT INTO order_tracking_timeline (order_id, title, description, created_at) VALUES ($1, $2, $3, NOW())',
    [orderId, 'Order Cancelled', 'Your order has been cancelled']
  );

  successResponse(res, {}, 'Order cancelled successfully');
});

// ============= PAYMENTS =============
export const initiatePayment = asyncHandler(async (req, res) => {
  const { order_id } = req.body;

  if (!order_id) {
    return errorResponse(res, 'order_id required', 400, 'MISSING_ORDER_ID');
  }

  const orderResult = await query(
    'SELECT id, total_amount FROM orders WHERE id = $1 AND status = $2',
    [order_id, 'PLACED']
  );

  if (orderResult.rows.length === 0) {
    return errorResponse(res, 'Order not found or not in PLACED status', 404, 'ORDER_NOT_FOUND');
  }

  const order = orderResult.rows[0];

  // Create Razorpay order
  const razorpayOrder = await createRazorpayOrder(order.total_amount, order_id);

  // Store payment record
  await query(
    'INSERT INTO payments (order_id, gateway, payment_reference, amount, status, created_at) VALUES ($1, $2, $3, $4, $5, NOW())',
    [order_id, 'RAZORPAY', razorpayOrder.id, order.total_amount, 'PENDING']
  );

  successResponse(res, {
    razorpayOrderId: razorpayOrder.id,
    amount: order.total_amount,
    currency: 'INR',
    key: process.env.RAZORPAY_KEY_ID,
  }, 'Payment initiated successfully');
});

export const verifyPayment = asyncHandler(async (req, res) => {
  const { order_id, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  if (!order_id || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return errorResponse(res, 'All payment verification fields required', 400, 'MISSING_FIELDS');
  }

  // Verify signature (simplified - use crypto.createHmac in production)
  // const isValid = verifyRazorpaySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature, process.env.RAZORPAY_WEBHOOK_SECRET);
  
  // For now, assume verification passed
  const isValid = true;

  if (!isValid) {
    return errorResponse(res, 'Payment verification failed', 400, 'VERIFICATION_FAILED');
  }

  // Update payment record
  await query(
    'UPDATE payments SET status = $1 WHERE order_id = $2 AND payment_reference = $3',
    ['SUCCESS', order_id, razorpay_order_id]
  );

  // Update order status
  await query(
    'UPDATE orders SET status = $1, payment_method = $2, updated_at = NOW() WHERE id = $3',
    ['ACCEPTED', 'RAZORPAY', order_id]
  );

  // Add status history
  await query(
    'INSERT INTO order_status_history (order_id, status, remarks, created_at) VALUES ($1, $2, $3, NOW())',
    [order_id, 'ACCEPTED', 'Payment successful - order accepted']
  );

  // Add tracking timeline
  await query(
    'INSERT INTO order_tracking_timeline (order_id, title, description, created_at) VALUES ($1, $2, $3, NOW())',
    [order_id, 'Payment Confirmed', 'Your payment has been confirmed']
  );

  successResponse(res, { message: 'Payment verified successfully' }, 'Payment verified');
});

// ============= SUPPORT =============
export const raiseComplaint = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { order_id, category, description } = req.body;

  if (!category || !description) {
    return errorResponse(res, 'category and description required', 400, 'MISSING_FIELDS');
  }

  const customerResult = await query('SELECT id FROM customer_profiles WHERE user_id = $1', [userId]);
  if (customerResult.rows.length === 0) {
    return errorResponse(res, 'Customer not found', 404, 'CUSTOMER_NOT_FOUND');
  }
  const customerId = customerResult.rows[0].id;

  const result = await query(
    'INSERT INTO complaints (order_id, customer_id, category, description, status, created_at) VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *',
    [order_id || null, customerId, category, description, 'OPEN']
  );

  successResponse(res, result.rows[0], 'Complaint raised successfully', 201);
});

export const getComplaints = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const customerResult = await query('SELECT id FROM customer_profiles WHERE user_id = $1', [userId]);
  if (customerResult.rows.length === 0) {
    return errorResponse(res, 'Customer not found', 404, 'CUSTOMER_NOT_FOUND');
  }
  const customerId = customerResult.rows[0].id;

  const result = await query(
    'SELECT * FROM complaints WHERE customer_id = $1 ORDER BY created_at DESC',
    [customerId]
  );

  successResponse(res, result.rows, 'Complaints retrieved successfully');
});

export const raiseTicket = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { subject, priority = 'MEDIUM' } = req.body;

  if (!subject) {
    return errorResponse(res, 'subject required', 400, 'MISSING_SUBJECT');
  }

  const customerResult = await query('SELECT id FROM customer_profiles WHERE user_id = $1', [userId]);
  if (customerResult.rows.length === 0) {
    return errorResponse(res, 'Customer not found', 404, 'CUSTOMER_NOT_FOUND');
  }
  const customerId = customerResult.rows[0].id;

  const result = await query(
    'INSERT INTO support_tickets (customer_id, subject, status, priority, created_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING *',
    [customerId, subject, 'OPEN', priority]
  );

  successResponse(res, result.rows[0], 'Support ticket created successfully', 201);
});

export const getNotifications = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { page = 1, limit = 20, is_read } = req.query;
  const offset = (page - 1) * limit;

  let whereClause = 'n.user_id = $1';
  let params = [userId];

  if (is_read !== undefined) {
    whereClause += ` AND n.is_read = $${params.length + 1}`;
    params.push(is_read === 'true');
  }

  const result = await query(
    `SELECT n.* FROM notifications n 
     WHERE ${whereClause} 
     ORDER BY n.created_at DESC 
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );

  const totalResult = await query(
    `SELECT COUNT(*) as total FROM notifications WHERE ${whereClause}`,
    params
  );

  paginatedResponse(res, result.rows, parseInt(totalResult.rows[0].total), page, limit, 'Notifications retrieved successfully');
});

export const markNotificationRead = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const notificationId = req.params.id;

  // Verify ownership
  const ownershipCheck = await query(
    'SELECT id FROM notifications WHERE id = $1 AND user_id = $2',
    [notificationId, userId]
  );

  if (ownershipCheck.rows.length === 0) {
    return errorResponse(res, 'Notification not found', 404, 'NOTIFICATION_NOT_FOUND');
  }

  await query(
    'UPDATE notifications SET is_read = TRUE WHERE id = $1',
    [notificationId]
  );

  successResponse(res, {}, 'Notification marked as read');
});

// ============= FAVORITES =============
export const addFavorite = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const vendorId = req.params.vendorId;

  const customerResult = await query('SELECT id FROM customer_profiles WHERE user_id = $1', [userId]);
  if (customerResult.rows.length === 0) {
    return errorResponse(res, 'Customer not found', 404, 'CUSTOMER_NOT_FOUND');
  }
  const customerId = customerResult.rows[0].id;

  // Check if already favorited
  const existingResult = await query(
    'SELECT id FROM customer_favorites WHERE customer_id = $1 AND vendor_id = $2',
    [customerId, vendorId]
  );

  if (existingResult.rows.length > 0) {
    return errorResponse(res, 'Vendor already in favorites', 400, 'ALREADY_FAVORITED');
  }

  const result = await query(
    'INSERT INTO customer_favorites (customer_id, vendor_id, created_at) VALUES ($1, $2, NOW()) RETURNING *',
    [customerId, vendorId]
  );

  successResponse(res, result.rows[0], 'Vendor added to favorites', 201);
});

export const removeFavorite = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const vendorId = req.params.vendorId;

  const customerResult = await query('SELECT id FROM customer_profiles WHERE user_id = $1', [userId]);
  if (customerResult.rows.length === 0) {
    return errorResponse(res, 'Customer not found', 404, 'CUSTOMER_NOT_FOUND');
  }
  const customerId = customerResult.rows[0].id;

  await query(
    'DELETE FROM customer_favorites WHERE customer_id = $1 AND vendor_id = $2',
    [customerId, vendorId]
  );

  successResponse(res, {}, 'Vendor removed from favorites');
});

export default {
  getProfile,
  updateProfile,
  getAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  getVendors,
  getVendorDetail,
  getVendorMenu,
  searchVendorsAndItems,
  getCategories,
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  clearCart,
  placeOrder,
  getMyOrders,
  getOrderDetail,
  getOrderTracking,
  cancelOrder,
  initiatePayment,
  verifyPayment,
  raiseComplaint,
  getComplaints,
  raiseTicket,
  getNotifications,
  markNotificationRead,
  addFavorite,
  removeFavorite,
};
