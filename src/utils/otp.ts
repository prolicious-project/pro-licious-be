import bcrypt from "bcrypt";
import { redisGet, redisSet, redisDel } from "./redis";

/** Generate 6-digit OTP */
export const generateOTP = () => String(Math.floor(100000 + Math.random() * 900000));

/** Hash OTP before DB/Redis storage */
export const hashOTP = (otp: string) => bcrypt.hash(otp, 10);

/** Verify OTP against hash */
export const verifyOTP = (otp: string, hash: string) => bcrypt.compare(otp, hash);

const otpKey = (phone: string) => `otp:${phone}`;

/** Store OTP hash in Redis (10 min TTL) */
export const storeOtpRedis = async (phone: string, hash: string) =>
  redisSet(otpKey(phone), hash, 600);

/** Get OTP hash from Redis */
export const getOtpRedis = (phone: string) => redisGet(otpKey(phone));

/** Remove OTP from Redis after use */
export const clearOtpRedis = (phone: string) => redisDel(otpKey(phone));
