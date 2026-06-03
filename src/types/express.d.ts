import "express";

declare global {
  namespace Express {
    interface Request {
      /** Set by authMiddleware after JWT verification */
      user?: { id: number; role: string };
    }
  }
}

export {};
