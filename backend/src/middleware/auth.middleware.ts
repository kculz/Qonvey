// Authentication Middleware
// Location: backend/src/middleware/auth.middleware.ts

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '@/config/env';
import prisma from '@/config/database';
import { loggers } from '@/utils/logger';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    role: string;
    subscription?: any;
  };
}

export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ 
        success: false,
        message: 'No token, authorization denied' 
      });
    }

    const decoded = jwt.verify(token, config.jwt.secret) as any;

    // Fetch user from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        subscription: true,
      },
    });

    if (!user) {
      return res.status(401).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    if (user.status === 'BANNED' || user.status === 'SUSPENDED') {
      return res.status(403).json({ 
        success: false,
        message: 'Account is not active' 
      });
    }

    req.user = {
      id: user.id,
      role: user.role,
      subscription: user.subscription,
    };

    next();
  } catch (error: any) {
    loggers.security.invalidToken(req.ip || 'unknown');
    res.status(401).json({ 
      success: false,
      message: 'Token is not valid' 
    });
  }
};

export const optionalAuthMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return next();
    }

    const decoded = jwt.verify(token, config.jwt.secret) as any;

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        subscription: true,
      },
    });

    if (user && user.status === 'ACTIVE') {
      req.user = {
        id: user.id,
        role: user.role,
        subscription: user.subscription,
      };
    }

    next();
  } catch (error) {
    next();
  }
};

export const requireRole = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false,
        message: 'Authentication required' 
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false,
        message: 'Insufficient permissions' 
      });
    }

    next();
  };
};

export const requireVerification = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false,
      message: 'Authentication required' 
    });
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
  });

  if (!user?.phoneVerified) {
    return res.status(403).json({ 
      success: false,
      message: 'Phone verification required' 
    });
  }

  next();
};

export default authMiddleware;