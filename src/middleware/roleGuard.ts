import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/errors";

/** Restrict route to specific roles e.g. roleGuard('VENDOR') */
export const roleGuard =
  (...roles: string[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError(403, "Permission denied", "PERMISSION_DENIED"));
    }
    next();
  };
