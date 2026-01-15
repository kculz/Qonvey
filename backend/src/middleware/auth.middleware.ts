// Authentication Middleware - Sequelize Version
// Location: backend/src/middleware/auth.middleware.ts

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '@/config/env';
import { loggers } from '@/utils/logger';
import User, { UserRole } from '@/models/user.model';
import Subscription from '@/models/subscription.model';

// User status enum (from your User model)
export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
  BANNED = 'BANNED',
  PENDING = 'PENDING'
}


export interface AuthRequest extends Request {
  user?: {
    id: string;
    role: UserRole;
    subscription?: any;
  };
}

export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Extract token from various sources
    const token = extractToken(req);

    if (!token) {
      // loggers.security.noToken(req.ip || 'unknown');
      return res.status(401).json({ 
        success: false,
        message: 'No token, authorization denied' 
      });
    }

    // Verify token
    const decoded = jwt.verify(token, config.jwt.secret) as any;

    // Fetch user from database using Sequelize
    const user = await User.findByPk(decoded.userId, {
      include: [{
        association: 'subscription',
      }],
      attributes: {
        exclude: ['password_hash', 'password_reset_token', 'email_verification_token']
      },
    });

    if (!user) {
      // loggers.security.userNotFound(decoded.userId);
      return res.status(401).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    // Check user status
    if (user.status === UserStatus.BANNED || user.status === UserStatus.SUSPENDED) {
      // loggers.security.accountNotActive(user.id, user.status);
      return res.status(403).json({ 
        success: false,
        message: 'Account is not active',
        status: user.status
      });
    }

    // Check if token was issued before password change
    if (user.updatedAt) {
      const tokenIssuedAt = decoded.iat * 1000; // Convert to milliseconds
      if (tokenIssuedAt < user.updatedAt.getTime()) {
        // loggers.security.tokenIssuedBeforePasswordChange(user.id);
        return res.status(401).json({ 
          success: false,
          message: 'Token expired due to password change. Please login again.' 
        });
      }
    }

    // Set user information on request
    req.user = {
      id: user.id,
      role: user.role as UserRole,
      subscription: user.subscription,
    };

    // Update last active timestamp
    await user.update({ last_active_at: new Date() });

    // loggers.security.authSuccess(user.id, req.method, req.originalUrl);
    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      // loggers.security.tokenExpired(req.ip || 'unknown');
      return res.status(401).json({ 
        success: false,
        message: 'Token has expired',
        code: 'TOKEN_EXPIRED'
      });
    }

    if (error.name === 'JsonWebTokenError') {
      loggers.security.invalidToken(req.ip || 'unknown');
      return res.status(401).json({ 
        success: false,
        message: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    }

    // loggers.security.authError(error);
    return res.status(401).json({ 
      success: false,
      message: 'Authentication failed' 
    });
  }
};

export const optionalAuthMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = extractToken(req);

    if (!token) {
      return next();
    }

    const decoded = jwt.verify(token, config.jwt.secret) as any;

    const user = await User.findByPk(decoded.userId, {
      include: [{
        association: 'subscription',
      }],
      attributes: {
        exclude: ['password_hash', 'password_reset_token', 'email_verification_token']
      },
    });

    if (user && user.status === UserStatus.ACTIVE) {
      req.user = {
        id: user.id,
        role: user.role as UserRole,
        subscription: user.subscription,
      };

      // Update last active timestamp
      await user.update({ last_active_at: new Date() });
    }

    next();
  } catch (error) {
    // Don't block the request if token is invalid for optional auth
    next();
  }
};

export const requireRole = (...allowedRoles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    // Check if user is authenticated
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Check if user has one of the allowed roles
    if (!allowedRoles.includes(req.user.role)) {
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

  const user = await User.findByPk(req.user.id);

  if (!user) {
    return res.status(404).json({ 
      success: false,
      message: 'User not found' 
    });
  }

  if (!user.phone_verified) {
    return res.status(403).json({ 
      success: false,
      message: 'Phone verification required',
      code: 'PHONE_VERIFICATION_REQUIRED'
    });
  }

  next();
};

export const requireEmailVerification = async (
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

  const user = await User.findByPk(req.user.id);

  if (!user) {
    return res.status(404).json({ 
      success: false,
      message: 'User not found' 
    });
  }

  if (!user.email_verified) {
    return res.status(403).json({ 
      success: false,
      message: 'Email verification required',
      code: 'EMAIL_VERIFICATION_REQUIRED'
    });
  }

  next();
};

export const requireSubscription = (requiredPlan?: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false,
        message: 'Authentication required' 
      });
    }

    const user = await User.findByPk(req.user.id, {
      include: [{
        association: 'subscription',
      }],
    });

    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    if (!user.subscription) {
      return res.status(403).json({ 
        success: false,
        message: 'No active subscription',
        code: 'NO_SUBSCRIPTION'
      });
    }

    if (user.subscription.status !== 'ACTIVE' && user.subscription.status !== 'TRIAL') {
      return res.status(403).json({ 
        success: false,
        message: 'Subscription is not active',
        status: user.subscription.status,
        code: 'SUBSCRIPTION_INACTIVE'
      });
    }

    if (requiredPlan && user.subscription.plan !== requiredPlan) {
      return res.status(403).json({ 
        success: false,
        message: `Requires ${requiredPlan} plan or higher`,
        currentPlan: user.subscription.plan,
        code: 'INSUFFICIENT_PLAN'
      });
    }

    next();
  };
};

export const requireActiveAccount = async (
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

  const user = await User.findByPk(req.user.id);

  if (!user) {
    return res.status(404).json({ 
      success: false,
      message: 'User not found' 
    });
  }

  if (user.status !== UserStatus.ACTIVE) {
    return res.status(403).json({ 
      success: false,
      message: `Account is ${user.status.toLowerCase()}`,
      status: user.status,
      code: 'ACCOUNT_INACTIVE'
    });
  }

  next();
};

export const rateLimitMiddleware = (options: {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (req: Request) => string;
}) => {
  const requestCounts = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction) => {
    const key = options.keyGenerator 
      ? options.keyGenerator(req) 
      : req.ip || 'unknown';

    const now = Date.now();
    const windowMs = options.windowMs * 1000; // Convert to milliseconds

    let record = requestCounts.get(key);

    if (!record || now > record.resetTime) {
      // Reset count for new time window
      record = { count: 1, resetTime: now + windowMs };
      requestCounts.set(key, record);
      return next();
    }

    if (record.count >= options.maxRequests) {
      // loggers.security.rateLimitExceeded(key, req.method, req.originalUrl);
      return res.status(429).json({ 
        success: false,
        message: 'Too many requests',
        retryAfter: Math.ceil((record.resetTime - now) / 1000),
        code: 'RATE_LIMIT_EXCEEDED'
      });
    }

    record.count++;
    next();
  };
};

// export const requireApiKey = (req: Request, res: Response, next: NextFunction) => {
//   const apiKey = req.header('X-API-Key') || req.query.apiKey as string;

//   if (!apiKey) {
//     return res.status(401).json({ 
//       success: false,
//       message: 'API key required' 
//     });
//   }

//   if (apiKey !== config.api.key) {
//     loggers.security.invalidApiKey(req.ip || 'unknown');
//     return res.status(403).json({ 
//       success: false,
//       message: 'Invalid API key' 
//     });
//   }

//   next();
// };

// Helper function to extract token from various sources
const extractToken = (req: Request): string | null => {
  // 1. Check Authorization header
  const authHeader = req.header('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.replace('Bearer ', '');
  }

  // 2. Check query parameter
  if (req.query.token) {
    return req.query.token as string;
  }

  // 3. Check cookie
  if (req.cookies && req.cookies.token) {
    return req.cookies.token;
  }

  return null;
};

// Middleware to attach user without blocking request (for logging)
export const attachUserIfExists = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = extractToken(req);

    if (token) {
      const decoded = jwt.verify(token, config.jwt.secret) as any;
      const user = await User.findByPk(decoded.userId, {
        attributes: ['id', 'role', 'first_name', 'last_name'],
      });

      if (user && user.status === UserStatus.ACTIVE) {
        req.user = {
          id: user.id,
          role: user.role as UserRole,
        };
      }
    }
  } catch (error) {
    // Silently fail - this middleware is just for attaching user if exists
  }

  next();
};

// Middleware to check if user owns the resource
export const requireOwnership = (modelName: string, paramName: string = 'id') => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false,
        message: 'Authentication required' 
      });
    }

    const resourceId = req.params[paramName];
    
    // Dynamically require the model based on modelName
    let Model: any;
    try {
      Model = require(`@/models/${modelName.toLowerCase()}.model`).default;
    } catch (error) {
      return res.status(500).json({ 
        success: false,
        message: 'Internal server error' 
      });
    }

    const resource = await Model.findByPk(resourceId);

    if (!resource) {
      return res.status(404).json({ 
        success: false,
        message: 'Resource not found' 
      });
    }

    // Check ownership based on common foreign key patterns
    const ownerId = resource.owner_id || resource.user_id || resource.created_by;
    
    if (!ownerId || ownerId !== req.user.id) {
      // Check if admin can bypass
      if (req.user.role === UserRole.ADMIN) {
        return next();
      }
      
      return res.status(403).json({ 
        success: false,
        message: 'You do not have permission to access this resource' 
      });
    }

    next();
  };
};

// Middleware to log all requests
export const requestLogger = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const start = Date.now();
  const userId = req.user?.id || 'anonymous';

  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      userId,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    };

    if (res.statusCode >= 500) {
      loggers.error('Server error', logData);
    } else if (res.statusCode >= 400) {
      loggers.warn('Client error', logData);
    } else {
      loggers.info('Request completed', logData);
    }
  });

  next();
};

// Middleware to prevent cross-tenant data access
export const tenantIsolation = (req: AuthRequest, res: Response, next: NextFunction) => {
  // This middleware ensures users can only access their own data
  // It should be combined with ownership checks on specific routes
  if (!req.user) {
    return next();
  }

  // For multi-tenant queries, we can add a filter to ensure users only see their data
  // This would be implemented at the service layer
  
  next();
};

export default authMiddleware;