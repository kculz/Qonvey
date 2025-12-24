// Rate Limiter Middleware
// Location: backend/src/middleware/rateLimiter.middleware.ts

import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { Request, Response } from 'express';
import Redis from 'ioredis';
import { config } from '@/config/env';
import { loggers } from '@/utils/logger';

// Initialize Redis client for rate limiting
let redisClient: Redis | undefined;

if (config.redis.url) {
  redisClient = new Redis(config.redis.url, {
    enableOfflineQueue: false,
    maxRetriesPerRequest: 3,
  });

  redisClient.on('error', (err) => {
    loggers.error('Redis rate limiter error', err);
  });
}

// Custom key generator to identify users
const keyGenerator = (req: Request): string => {
  // If authenticated, use user ID
  if (req.user?.id) {
    return `user:${req.user.id}`;
  }
  
  // Otherwise use IP address
  const forwarded = req.headers['x-forwarded-for'];
  const ip = typeof forwarded === 'string' 
    ? forwarded.split(',')[0].trim() 
    : req.socket.remoteAddress || 'unknown';
  
  return `ip:${ip}`;
};

// Custom handler for rate limit exceeded
const rateLimitHandler = (req: Request, res: Response) => {
  const key = keyGenerator(req);
  loggers.api.rateLimit(key, req.path);
  
  res.status(429).json({
    success: false,
    message: 'Too many requests, please try again later.',
    retryAfter: req.rateLimit?.resetTime,
  });
};

// Skip rate limiting for certain conditions
const skipRateLimit = (req: Request): boolean => {
  // Skip in test environment
  if (config.isTest) {
    return true;
  }

  // Skip if rate limiting is disabled
  if (!config.features.rateLimiting) {
    return true;
  }

  // Skip for health check endpoint
  if (req.path === '/health' || req.path === '/api/health') {
    return true;
  }

  return false;
};

// ============================================
// GENERAL API RATE LIMITER
// ============================================
export const generalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs, // 15 minutes
  max: config.rateLimit.maxRequests, // 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  handler: rateLimitHandler,
  skip: skipRateLimit,
  // Use Redis store if available, otherwise use memory store
  ...(redisClient && {
    store: new RedisStore({
      // @ts-expect-error - Known typing issue with rate-limit-redis
      sendCommand: (...args: string[]) => redisClient!.call(...args),
      prefix: 'rl:general:',
    }),
  }),
});

// ============================================
// AUTHENTICATION RATE LIMITER (Stricter)
// ============================================
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per windowMs
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  handler: rateLimitHandler,
  skip: skipRateLimit,
  ...(redisClient && {
    store: new RedisStore({
      // @ts-expect-error - Known typing issue
      sendCommand: (...args: string[]) => redisClient!.call(...args),
      prefix: 'rl:auth:',
    }),
  }),
});

// ============================================
// LOAD POSTING RATE LIMITER
// ============================================
export const loadPostingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: async (req: Request) => {
    // Different limits based on subscription tier
    const subscription = req.user?.subscription;
    
    if (!subscription || subscription.plan === 'FREE') {
      return 1; // 1 load per hour for free users
    } else if (subscription.plan === 'STARTER') {
      return 10; // 10 loads per hour
    } else if (subscription.plan === 'PROFESSIONAL') {
      return 50; // 50 loads per hour
    } else {
      return 100; // 100 loads per hour for business
    }
  },
  message: 'Load posting limit reached for your subscription tier.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  handler: rateLimitHandler,
  skip: skipRateLimit,
  ...(redisClient && {
    store: new RedisStore({
      // @ts-expect-error - Known typing issue
      sendCommand: (...args: string[]) => redisClient!.call(...args),
      prefix: 'rl:loads:',
    }),
  }),
});

// ============================================
// BID PLACING RATE LIMITER
// ============================================
export const bidPlacingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: async (req: Request) => {
    const subscription = req.user?.subscription;
    
    if (!subscription || subscription.plan === 'FREE') {
      return 3; // 3 bids per hour for free users
    } else if (subscription.plan === 'STARTER') {
      return 20; // 20 bids per hour
    } else if (subscription.plan === 'PROFESSIONAL') {
      return 100; // 100 bids per hour
    } else {
      return 200; // 200 bids per hour for business
    }
  },
  message: 'Bid placing limit reached for your subscription tier.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  handler: rateLimitHandler,
  skip: skipRateLimit,
  ...(redisClient && {
    store: new RedisStore({
      // @ts-expect-error - Known typing issue
      sendCommand: (...args: string[]) => redisClient!.call(...args),
      prefix: 'rl:bids:',
    }),
  }),
});

// ============================================
// MESSAGE SENDING RATE LIMITER
// ============================================
export const messageLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 messages per minute
  message: 'Too many messages sent, please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  handler: rateLimitHandler,
  skip: skipRateLimit,
  ...(redisClient && {
    store: new RedisStore({
      // @ts-expect-error - Known typing issue
      sendCommand: (...args: string[]) => redisClient!.call(...args),
      prefix: 'rl:messages:',
    }),
  }),
});

// ============================================
// FILE UPLOAD RATE LIMITER
// ============================================
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // 50 uploads per hour
  message: 'Upload limit reached, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  handler: rateLimitHandler,
  skip: skipRateLimit,
  ...(redisClient && {
    store: new RedisStore({
      // @ts-expect-error - Known typing issue
      sendCommand: (...args: string[]) => redisClient!.call(...args),
      prefix: 'rl:uploads:',
    }),
  }),
});

// ============================================
// PAYMENT RATE LIMITER (Very strict)
// ============================================
export const paymentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 payment attempts per hour
  message: 'Too many payment attempts, please contact support.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  handler: rateLimitHandler,
  skip: skipRateLimit,
  ...(redisClient && {
    store: new RedisStore({
      // @ts-expect-error - Known typing issue
      sendCommand: (...args: string[]) => redisClient!.call(...args),
      prefix: 'rl:payment:',
    }),
  }),
});

// ============================================
// OTP VERIFICATION RATE LIMITER
// ============================================
export const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 OTP requests per 15 minutes
  message: 'Too many OTP requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  handler: rateLimitHandler,
  skip: skipRateLimit,
  ...(redisClient && {
    store: new RedisStore({
      // @ts-expect-error - Known typing issue
      sendCommand: (...args: string[]) => redisClient!.call(...args),
      prefix: 'rl:otp:',
    }),
  }),
});

// ============================================
// SEARCH/BROWSE RATE LIMITER (Lenient)
// ============================================
export const searchLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 searches per minute
  message: 'Search limit reached, please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  handler: rateLimitHandler,
  skip: skipRateLimit,
  ...(redisClient && {
    store: new RedisStore({
      // @ts-expect-error - Known typing issue
      sendCommand: (...args: string[]) => redisClient!.call(...args),
      prefix: 'rl:search:',
    }),
  }),
});

// Export default middleware
export default generalLimiter;

// Utility function to reset rate limit for a user (admin function)
export const resetRateLimit = async (userId: string, prefix: string = 'general') => {
  if (!redisClient) {
    loggers.warn('Redis not available, cannot reset rate limit');
    return false;
  }

  try {
    const key = `rl:${prefix}:user:${userId}`;
    await redisClient.del(key);
    loggers.info(`Rate limit reset for user: ${userId}`, { prefix });
    return true;
  } catch (error) {
    loggers.error('Failed to reset rate limit', error);
    return false;
  }
};

// Utility to check remaining requests
export const getRateLimitInfo = async (req: Request, prefix: string = 'general') => {
  if (!redisClient) {
    return null;
  }

  try {
    const key = `rl:${prefix}:${keyGenerator(req)}`;
    const value = await redisClient.get(key);
    
    if (!value) {
      return {
        remaining: config.rateLimit.maxRequests,
        resetTime: null,
      };
    }

    const data = JSON.parse(value);
    return {
      remaining: data.remaining,
      resetTime: data.resetTime,
    };
  } catch (error) {
    loggers.error('Failed to get rate limit info', error);
    return null;
  }
};