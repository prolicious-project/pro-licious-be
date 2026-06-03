import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";
import { AppError } from "../lib/errors";

/** Validate req.body against Zod schema */
export const validate =
  (schema: ZodSchema) => (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const msg = result.error.issues.map((i) => i.message).join(", ");
      return next(new AppError(400, msg, "MISSING_FIELDS"));
    }
    req.body = result.data;
    next();
  };
