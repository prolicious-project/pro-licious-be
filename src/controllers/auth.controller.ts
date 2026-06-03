import { Request, Response } from "express";
import * as authService from "../services/auth.service";
import { successResponse } from "../utils/responses";

/** POST /send-otp */
export const sendOtp = async (req: Request, res: Response) => {
  const data = await authService.sendOtp(req.body.phone);
  successResponse(res, data, data.message);
};

/** POST /verify-otp */
export const verifyOtp = async (req: Request, res: Response) => {
  const { phone, otp, name, role } = req.body;
  const data = await authService.verifyOtpSignup(phone, otp, name, role);
  successResponse(res, data, "Authenticated");
};

/** POST /login */
export const login = async (req: Request, res: Response) => {
  const data = await authService.login(req.body.email, req.body.password);
  successResponse(res, data, "Logged in");
};

/** POST /refresh-token */
export const refreshToken = async (req: Request, res: Response) => {
  const data = await authService.refreshToken(req.body.refreshToken);
  successResponse(res, data);
};

/** POST /logout */
export const logout = async (req: Request, res: Response) => {
  const data = await authService.logout(req.user!.id, req.body.refreshToken);
  successResponse(res, data, data.message);
};

/** GET /me */
export const me = async (req: Request, res: Response) => {
  const data = await authService.getMe(req.user!.id);
  successResponse(res, data);
};
