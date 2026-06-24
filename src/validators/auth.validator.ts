import { z } from "zod";

export const sendOtpSchema = z.object({ phone: z.string().min(10).max(15) });

export const verifyOtpSchema = z.object({
  phone: z.string().min(10).max(15),
  otp: z.string().length(6),
  name: z.string().min(2).optional(),
  role: z.enum(["CUSTOMER", "VENDOR", "RIDER"]).optional(),
});

export const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().min(10).max(15),
  password: z.string().min(6).optional().or(z.literal("")),
  role: z.enum(["CUSTOMER", "VENDOR", "RIDER"]).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const refreshTokenSchema = z.object({ refreshToken: z.string().min(10) });

export const logoutSchema = z.object({ refreshToken: z.string().optional() });
