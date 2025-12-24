// backend/src/middleware/versioning.middleware.ts
import { Request, Response, NextFunction } from 'express';

export const versioningMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const version = (req.headers['accept-version'] as string) || 'v1';
  req.version = version; // No longer errors
  next();
};
