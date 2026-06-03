import jwt from "jsonwebtoken";
import { env } from "../config/env";

export type TokenPayload = { id: number; role: string };

/** 4-hour access token */
export const generateAccessToken = (payload: TokenPayload) =>
  jwt.sign(payload, env.JWT_SECRET, { expiresIn: "4h" });

/** 30-day refresh token */
export const generateRefreshToken = (payload: TokenPayload) =>
  jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: "30d" });

/** Verify access token — throws on invalid/expired */
export const verifyAccessToken = (token: string): TokenPayload =>
  jwt.verify(token, env.JWT_SECRET) as TokenPayload;

/** Verify refresh token */
export const verifyRefreshToken = (token: string): TokenPayload =>
  jwt.verify(token, env.JWT_REFRESH_SECRET) as TokenPayload;
