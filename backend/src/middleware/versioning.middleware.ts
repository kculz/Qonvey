import { Request, Response, NextFunction } from 'express';

// Define a custom interface that extends Request
export interface VersionedRequest extends Request {
  version: string;
}

export const versioningMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const version = (req.headers['accept-version'] as string) || 'v1';
  
  // Cast req to VersionedRequest to add the version property
  (req as VersionedRequest).version = version;
  
  next();
};