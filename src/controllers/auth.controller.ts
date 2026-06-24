import { Request, Response } from "express";
import * as authService from "../services/auth.service";
import { successResponse } from "../utils/responses";
import { env } from "../config/env";

/** POST /send-otp */
export const sendOtp = async (req: Request, res: Response) => {
  const data = await authService.sendOtp(req.body.phone);
  successResponse(res, data, data.message);
};

/** POST /verify-otp */
export const verifyOtp = async (req: Request, res: Response) => {
  const { phone, otp, name, role } = req.body;
  const data = await authService.verifyOtpSignup(phone, otp, name, role);
  // set refresh token as httpOnly cookie (for improved security)
  if (data.refreshToken) {
    res.cookie("refreshToken", data.refreshToken, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
  }
  successResponse(res, data, "Authenticated");
};

/** POST /register */
export const register = async (req: Request, res: Response) => {
  const { name, email, phone, password, role } = req.body;
  const data = await authService.registerCustomer(name, email, phone, password, role);
  if (data.refreshToken) {
    res.cookie("refreshToken", data.refreshToken, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
  }
  successResponse(res, data, "User registered successfully", 201);
};

/** POST /login */
export const login = async (req: Request, res: Response) => {
  const data = await authService.login(req.body.email, req.body.password);
  if (data.refreshToken) {
    res.cookie("refreshToken", data.refreshToken, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
  }
  successResponse(res, data, "Logged in");
};

/** POST /refresh-token */
export const refreshToken = async (req: Request, res: Response) => {
  // accept refresh token either from cookie or request body
  const token = (req.cookies && (req.cookies as any).refreshToken) || req.body.refreshToken;
  const data = await authService.refreshToken(token);
  successResponse(res, data);
};

/** POST /logout */
export const logout = async (req: Request, res: Response) => {
  const token = (req.cookies && (req.cookies as any).refreshToken) || req.body.refreshToken;
  const data = await authService.logout(req.user!.id, token);
  // clear cookie
  res.clearCookie("refreshToken", { httpOnly: true, sameSite: "lax", secure: env.NODE_ENV === "production" });
  successResponse(res, data, data.message);
};

/** GET /me */
export const me = async (req: Request, res: Response) => {
  const data = await authService.getMe(req.user!.id);
  successResponse(res, data);
};
