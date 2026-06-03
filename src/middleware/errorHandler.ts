import { Request, Response, NextFunction, RequestHandler } from "express";
import { AppError } from "../lib/errors";

/** Wrap async route handlers — forwards errors to errorHandler */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

/** Global error handler — README format */
export const errorHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
      timestamp: new Date().toISOString(),
    });
  }
  const message = err instanceof Error ? err.message : "Internal Server Error";
  return res.status(500).json({
    success: false,
    error: message,
    code: "INTERNAL_ERROR",
    timestamp: new Date().toISOString(),
  });
};
