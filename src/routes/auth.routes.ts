import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler";
import { validate } from "../middleware/validate";
import { authMiddleware } from "../middleware/auth";
import * as authController from "../controllers/auth.controller";
import {
  sendOtpSchema,
  verifyOtpSchema,
  registerSchema,
  loginSchema,
  refreshTokenSchema,
} from "../validators/auth.validator";

const router = Router();

/** Auth routes — 6 endpoints */
router.post("/send-otp", validate(sendOtpSchema), asyncHandler(authController.sendOtp));
router.post("/verify-otp", validate(verifyOtpSchema), asyncHandler(authController.verifyOtp));
router.post("/register", validate(registerSchema), asyncHandler(authController.register));
router.post("/login", validate(loginSchema), asyncHandler(authController.login));
router.post("/refresh-token", validate(refreshTokenSchema), asyncHandler(authController.refreshToken));
router.post("/logout", authMiddleware, asyncHandler(authController.logout));
router.get("/me", authMiddleware, asyncHandler(authController.me));

export default router;
