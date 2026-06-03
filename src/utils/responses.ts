import { Response } from "express";

/** Standard success JSON envelope */
export const successResponse = (res: Response, data: unknown, message = "OK", status = 200) =>
  res.status(status).json({ success: true, message, data });

/** Standard error JSON (used in controllers for non-thrown errors) */
export const errorResponse = (res: Response, message: string, status = 400, code = "BAD_REQUEST") =>
  res.status(status).json({ success: false, error: message, code, timestamp: new Date().toISOString() });

/** Paginated list response */
export const paginatedResponse = (
  res: Response,
  data: unknown[],
  total: number,
  page: number,
  limit: number,
) =>
  res.json({
    success: true,
    data,
    pagination: { total, page, limit, pages: Math.ceil(total / limit) },
  });
