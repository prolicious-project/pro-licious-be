import { query } from '../config/database.js';
import { redisSet, redisGet, redisDel } from '../config/redis.js';
import { generateOTP, hashOTP, verifyOTP as verifyOTPHash } from '../utils/otp.js';
import { hashPassword, verifyPassword } from '../utils/passwordHash.js';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt.js';
import { successResponse, errorResponse } from '../utils/responses.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';

// ============= SEND OTP =============
export const sendOTP = asyncHandler(async (req, res) => {
  const { phone } = req.body;

  if (!phone) {
    return errorResponse(res, 'Phone number required', 400, 'MISSING_PHONE');
  }

  // Check if user exists
  const userResult = await query('SELECT id FROM users WHERE phone = $1', [phone]);

  // Generate OTP
  const otp = generateOTP();
  const otpHash = await hashOTP(otp);

  // Store in Redis with 10 minute expiry
  await redisSet(`otp:${phone}`, { hash: otpHash, attempts: 0 }, 600);

  // TODO: Send OTP via SMS (Twilio/AWS SNS)
  console.log(`🔐 OTP for ${phone}: ${otp}`);

  successResponse(res, 
    { message: 'OTP sent to phone', phone, expiresIn: '10 minutes' },
    'OTP sent successfully'
  );
});

// ============= VERIFY OTP & CREATE ACCOUNT =============
export const verifyOTP = asyncHandler(async (req, res) => {
  const { phone, otp, name, role } = req.body;

  if (!phone || !otp) {
    return errorResponse(res, 'Phone and OTP required', 400, 'MISSING_FIELDS');
  }

  // Get OTP from Redis
  const storedOTP = await redisGet(`otp:${phone}`);
  if (!storedOTP) {
    return errorResponse(res, 'OTP expired or not requested', 400, 'OTP_EXPIRED');
  }

  // Check attempts
  if (storedOTP.attempts > 3) {
    await redisDel(`otp:${phone}`);
    return errorResponse(res, 'Too many OTP attempts', 429, 'OTP_LIMIT');
  }

  // Verify OTP
  const isValid = await verifyOTPHash(otp, storedOTP.hash);
  if (!isValid) {
    storedOTP.attempts++;
    await redisSet(`otp:${phone}`, storedOTP, 600);
    return errorResponse(res, 'Invalid OTP', 400, 'INVALID_OTP');
  }

  // Delete OTP from Redis
  await redisDel(`otp:${phone}`);

  // Check if user exists
  let userResult = await query('SELECT id, role FROM users WHERE phone = $1', [phone]);

  let userId;
  if (userResult.rows.length === 0) {
    // New user - create account
    if (!name || !role) {
      return errorResponse(res, 'Name and role required for new signup', 400, 'MISSING_SIGNUP_FIELDS');
    }

    const validRoles = ['CUSTOMER', 'VENDOR', 'RIDER'];
    if (!validRoles.includes(role)) {
      return errorResponse(res, `Invalid role. Must be one of: ${validRoles.join(', ')}`, 400, 'INVALID_ROLE');
    }

    const createUserResult = await query(
      'INSERT INTO users (name, phone, role, status) VALUES ($1, $2, $3, $4) RETURNING id',
      [name, phone, role, 'ACTIVE']
    );
    userId = createUserResult.rows[0].id;

    // Create role-specific profile
    if (role === 'CUSTOMER') {
      await query('INSERT INTO customer_profiles (user_id) VALUES ($1)', [userId]);
    } else if (role === 'VENDOR') {
      await query('INSERT INTO vendors (user_id, name, status) VALUES ($1, $2, $3)', 
        [userId, name, 'PENDING']);
    } else if (role === 'RIDER') {
      await query('INSERT INTO riders (user_id, status) VALUES ($1, $2)', 
        [userId, 'PENDING']);
    }
  } else {
    userId = userResult.rows[0].id;
  }

  // Generate tokens
  const userRoleResult = await query('SELECT role FROM users WHERE id = $1', [userId]);
  const userRole = userRoleResult.rows[0].role;
  
  const accessToken = generateAccessToken(userId, userRole);
  const refreshToken = generateRefreshToken(userId);

  // Store refresh token in DB
  await query(
    'INSERT INTO user_sessions (user_id, token, expires_at) VALUES ($1, $2, NOW() + INTERVAL \'30 days\')',
    [userId, refreshToken]
  );

  // Store in Redis for quick lookup
  await redisSet(`session:${userId}`, { accessToken, refreshToken }, 2592000); // 30 days

  successResponse(res, 
    { 
      userId, 
      accessToken, 
      refreshToken, 
      role: userRole,
      expiresIn: '4 hours'
    },
    'OTP verified successfully',
    201
  );
});

// ============= EMAIL + PASSWORD LOGIN =============
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return errorResponse(res, 'Email and password required', 400, 'MISSING_FIELDS');
  }

  // Find user
  const userResult = await query(
    'SELECT id, role, password_hash FROM users WHERE email = $1 AND status = $2',
    [email, 'ACTIVE']
  );

  if (userResult.rows.length === 0) {
    return errorResponse(res, 'Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  const user = userResult.rows[0];

  // Verify password
  const isPasswordValid = await verifyPassword(password, user.password_hash);
  if (!isPasswordValid) {
    return errorResponse(res, 'Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  // Generate tokens
  const accessToken = generateAccessToken(user.id, user.role);
  const refreshToken = generateRefreshToken(user.id);

  // Store refresh token in DB
  await query(
    'INSERT INTO user_sessions (user_id, token, expires_at) VALUES ($1, $2, NOW() + INTERVAL \'30 days\')',
    [user.id, refreshToken]
  );

  successResponse(res, 
    { 
      userId: user.id, 
      accessToken, 
      refreshToken, 
      role: user.role,
      expiresIn: '4 hours'
    },
    'Login successful'
  );
});

// ============= REFRESH TOKEN =============
export const refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken: token } = req.body;

  if (!token) {
    return errorResponse(res, 'Refresh token required', 400, 'MISSING_TOKEN');
  }

  try {
    const decoded = verifyRefreshToken(token);
    
    // Verify token exists in DB
    const sessionResult = await query(
      'SELECT * FROM user_sessions WHERE user_id = $1 AND token = $2 AND expires_at > NOW()',
      [decoded.id, token]
    );

    if (sessionResult.rows.length === 0) {
      return errorResponse(res, 'Refresh token invalid or expired', 401, 'INVALID_REFRESH_TOKEN');
    }

    // Get user role
    const userResult = await query('SELECT role FROM users WHERE id = $1', [decoded.id]);
    const role = userResult.rows[0].role;

    // Generate new access token
    const newAccessToken = generateAccessToken(decoded.id, role);

    successResponse(res, 
      { 
        accessToken: newAccessToken, 
        expiresIn: '4 hours'
      },
      'Token refreshed successfully'
    );
  } catch (error) {
    return errorResponse(res, 'Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN');
  }
});

// ============= LOGOUT =============
export const logout = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // Delete all sessions for this user
  await query('DELETE FROM user_sessions WHERE user_id = $1', [userId]);

  // Delete from Redis
  await redisDel(`session:${userId}`);

  successResponse(res, {}, 'Logged out successfully');
});

// ============= GET CURRENT USER =============
export const getMe = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const userResult = await query(
    'SELECT id, name, phone, email, role, status, last_login, created_at FROM users WHERE id = $1',
    [userId]
  );

  if (userResult.rows.length === 0) {
    return errorResponse(res, 'User not found', 404, 'USER_NOT_FOUND');
  }

  successResponse(res, userResult.rows[0], 'User retrieved successfully');
});

export default {
  sendOTP,
  verifyOTP,
  login,
  refreshToken,
  logout,
  getMe,
};
