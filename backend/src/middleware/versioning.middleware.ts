import { Request, Response, NextFunction } from 'express';

const versioningMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Extract version from header or default to v1
  const version = req.headers['accept-version'] || 'v1';
  req.version = version as string;
  next();
};

export default versioningMiddleware;