import { eq, and, desc } from "drizzle-orm";
import { db } from "../db";
import {
  users,
  otpVerifications,
  userSessions,
  customerProfiles,
  vendors,
  riders,
} from "../db/schema";
import { AppError } from "../lib/errors";
import { env } from "../config/env";
import {
  generateOTP,
  hashOTP,
  verifyOTP,
  storeOtpRedis,
  getOtpRedis,
  clearOtpRedis,
} from "../utils/otp";
import { hashPassword, verifyPassword } from "../utils/passwordHash";
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from "../utils/jwt";
import { getUserById } from "../lib/helpers";

const ALLOWED_ROLES = ["CUSTOMER", "VENDOR", "RIDER"] as const;

/** POST /api/auth/send-otp — send/login OTP to phone */
export const sendOtp = async (phone: string) => {
  const otp = generateOTP();
  const otpHash = await hashOTP(otp);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await db.insert(otpVerifications).values({
    phone,
    otpHash,
    purpose: "LOGIN",
    expiresAt,
  });
  await storeOtpRedis(phone, otpHash);

  if (env.NODE_ENV === "development") console.log(`[DEV OTP] ${phone}: ${otp}`);

  return { message: "OTP sent to phone", phone, expiresIn: "10 minutes" };
};

/** POST /api/auth/verify-otp — verify OTP, signup or login */
export const verifyOtpSignup = async (
  phone: string,
  otp: string,
  name?: string,
  role: string = "CUSTOMER",
) => {
  if (!ALLOWED_ROLES.includes(role as (typeof ALLOWED_ROLES)[number])) {
    throw new AppError(400, "Invalid role", "INVALID_ROLE");
  }

  const redisHash = await getOtpRedis(phone);
  const [record] = await db
    .select()
    .from(otpVerifications)
    .where(and(eq(otpVerifications.phone, phone), eq(otpVerifications.used, false)))
    .orderBy(desc(otpVerifications.createdAt))
    .limit(1);

  const hash = redisHash || record?.otpHash;
  if (!hash || !(await verifyOTP(otp, hash))) {
    throw new AppError(400, "Invalid OTP", "INVALID_OTP");
  }
  if (record && record.expiresAt < new Date()) {
    throw new AppError(400, "OTP expired", "OTP_EXPIRED");
  }

  let [user] = await db.select().from(users).where(eq(users.phone, phone));

  if (!user) {
    if (!name) throw new AppError(400, "Name required for signup", "MISSING_FIELDS");
    [user] = await db
      .insert(users)
      .values({ name, phone, role, status: "ACTIVE" })
      .returning();

    if (role === "CUSTOMER") {
      await db.insert(customerProfiles).values({ userId: user.id });
    } else if (role === "VENDOR") {
      await db.insert(vendors).values({ userId: user.id, name, phone, status: "PENDING" });
    } else if (role === "RIDER") {
      await db.insert(riders).values({ userId: user.id, status: "PENDING" });
    }
  }

  if (record) await db.update(otpVerifications).set({ used: true }).where(eq(otpVerifications.id, record.id));
  await clearOtpRedis(phone);
  await db.update(users).set({ lastLogin: new Date() }).where(eq(users.id, user.id));

  return issueTokens(user.id, user.role);
};

/** POST /api/auth/register — direct register with name, email, phone, and password */
export const registerCustomer = async (
  name: string,
  email: string,
  phone: string,
  password?: string,
  role: string = "CUSTOMER"
) => {
  if (!ALLOWED_ROLES.includes(role as (typeof ALLOWED_ROLES)[number])) {
    throw new AppError(400, "Invalid role", "INVALID_ROLE");
  }

  // Check if user already exists with this phone number
  const [existingByPhone] = await db.select().from(users).where(eq(users.phone, phone));
  if (existingByPhone) {
    throw new AppError(400, "User with this phone number already exists", "USER_EXISTS");
  }

  // Check if user already exists with this email
  if (email) {
    const [existingByEmail] = await db.select().from(users).where(eq(users.email, email));
    if (existingByEmail) {
      throw new AppError(400, "User with this email already exists", "USER_EXISTS");
    }
  }

  const hash = password ? await hashPassword(password) : null;

  const [user] = await db
    .insert(users)
    .values({
      name,
      phone,
      email: email || null,
      passwordHash: hash,
      role,
      status: "ACTIVE",
    })
    .returning();

  if (role === "CUSTOMER") {
    await db.insert(customerProfiles).values({ userId: user.id });
  } else if (role === "VENDOR") {
    await db.insert(vendors).values({ userId: user.id, name, phone, status: "PENDING" });
  } else if (role === "RIDER") {
    await db.insert(riders).values({ userId: user.id, status: "PENDING" });
  }

  return issueTokens(user.id, user.role);
};

/** POST /api/auth/login — email + password */
export const login = async (email: string, password: string) => {
  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user?.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
    throw new AppError(401, "Invalid credentials", "INVALID_CREDENTIALS");
  }
  if (user.status !== "ACTIVE") throw new AppError(403, "Account suspended", "PERMISSION_DENIED");
  await db.update(users).set({ lastLogin: new Date() }).where(eq(users.id, user.id));
  return issueTokens(user.id, user.role);
};

/** POST /api/auth/refresh-token */
export const refreshToken = async (token: string) => {
  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw new AppError(401, "Invalid refresh token", "INVALID_REFRESH_TOKEN");
  }

  const [session] = await db
    .select()
    .from(userSessions)
    .where(and(eq(userSessions.token, token), eq(userSessions.userId, payload.id)));

  if (!session || session.expiresAt < new Date()) {
    throw new AppError(401, "Session expired", "INVALID_REFRESH_TOKEN");
  }

  const accessToken = generateAccessToken({ id: payload.id, role: payload.role });
  return { accessToken, expiresIn: "4 hours" };
};

/** POST /api/auth/logout */
export const logout = async (userId: number, refreshToken?: string) => {
  if (refreshToken) {
    await db.delete(userSessions).where(and(eq(userSessions.userId, userId), eq(userSessions.token, refreshToken)));
  } else {
    await db.delete(userSessions).where(eq(userSessions.userId, userId));
  }
  return { message: "Logged out successfully" };
};

/** GET /api/auth/me */
export const getMe = async (userId: number) => {
  const user = await getUserById(userId);
  const { passwordHash: _, ...safe } = user;
  return safe;
};

/** Issue JWT pair and persist refresh session */
async function issueTokens(userId: number, role: string) {
  const payload = { id: userId, role };
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await db.insert(userSessions).values({ userId, token: refreshToken, expiresAt });

  return { userId, accessToken, refreshToken, role, expiresIn: "4 hours" };
}

/** Set password for email login (used internally / admin) */
export const setUserPassword = async (userId: number, password: string) => {
  const hash = await hashPassword(password);
  await db.update(users).set({ passwordHash: hash }).where(eq(users.id, userId));
};
