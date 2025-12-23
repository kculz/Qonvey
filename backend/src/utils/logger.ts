// Winston Logger Configuration
// Location: backend/src/utils/logger.ts

import winston from 'winston';
import path from 'path';
import { config } from '@/config/env';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Tell winston about our colors
winston.addColors(colors);

// Define format for logs
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Define format for console output
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf((info) => {
    const { timestamp, level, message, ...meta } = info;
    let msg = `${timestamp} [${level}]: ${message}`;
    
    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta, null, 2)}`;
    }
    
    return msg;
  })
);

// Define which transports to use
const transports: winston.transport[] = [
  // Console transport
  new winston.transports.Console({
    format: consoleFormat,
  }),
];

// Add file transports in production
if (config.isProduction) {
  // Error logs
  transports.push(
    new winston.transports.File({
      filename: path.join('logs', 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );

  // Combined logs
  transports.push(
    new winston.transports.File({
      filename: path.join('logs', 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );

  // HTTP logs
  transports.push(
    new winston.transports.File({
      filename: path.join('logs', 'http.log'),
      level: 'http',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );
}

// Create the logger
const logger = winston.createLogger({
  level: config.isDevelopment ? 'debug' : 'info',
  levels,
  format,
  transports,
  exitOnError: false,
});

// Create a stream for Morgan HTTP logger
export const morganStream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};

// Helper functions for structured logging
export const loggers = {
  // General logging
  info: (message: string, meta?: any) => {
    logger.info(message, meta);
  },

  error: (message: string, error?: Error | any, meta?: any) => {
    logger.error(message, {
      error: error?.message || error,
      stack: error?.stack,
      ...meta,
    });
  },

  warn: (message: string, meta?: any) => {
    logger.warn(message, meta);
  },

  debug: (message: string, meta?: any) => {
    logger.debug(message, meta);
  },

  http: (message: string, meta?: any) => {
    logger.http(message, meta);
  },

  // Specific domain logging
  auth: {
    login: (userId: string, ip: string) => {
      logger.info('User logged in', { userId, ip, domain: 'auth' });
    },
    logout: (userId: string) => {
      logger.info('User logged out', { userId, domain: 'auth' });
    },
    register: (userId: string, role: string) => {
      logger.info('New user registered', { userId, role, domain: 'auth' });
    },
    failed: (email: string, reason: string, ip: string) => {
      logger.warn('Login failed', { email, reason, ip, domain: 'auth' });
    },
  },

  subscription: {
    created: (userId: string, plan: string) => {
      logger.info('Subscription created', { userId, plan, domain: 'subscription' });
    },
    upgraded: (userId: string, fromPlan: string, toPlan: string) => {
      logger.info('Subscription upgraded', { userId, fromPlan, toPlan, domain: 'subscription' });
    },
    cancelled: (userId: string, plan: string, reason?: string) => {
      logger.info('Subscription cancelled', { userId, plan, reason, domain: 'subscription' });
    },
    expired: (userId: string, plan: string) => {
      logger.warn('Subscription expired', { userId, plan, domain: 'subscription' });
    },
    paymentSuccess: (userId: string, amount: number, plan: string) => {
      logger.info('Payment successful', { userId, amount, plan, domain: 'payment' });
    },
    paymentFailed: (userId: string, amount: number, reason: string) => {
      logger.error('Payment failed', { userId, amount, reason, domain: 'payment' });
    },
  },

  load: {
    created: (loadId: string, userId: string, title: string) => {
      logger.info('Load created', { loadId, userId, title, domain: 'load' });
    },
    published: (loadId: string, userId: string) => {
      logger.info('Load published', { loadId, userId, domain: 'load' });
    },
    deleted: (loadId: string, userId: string) => {
      logger.info('Load deleted', { loadId, userId, domain: 'load' });
    },
  },

  bid: {
    placed: (bidId: string, loadId: string, driverId: string, amount: number) => {
      logger.info('Bid placed', { bidId, loadId, driverId, amount, domain: 'bid' });
    },
    accepted: (bidId: string, loadId: string, driverId: string) => {
      logger.info('Bid accepted', { bidId, loadId, driverId, domain: 'bid' });
    },
    rejected: (bidId: string, loadId: string, reason?: string) => {
      logger.info('Bid rejected', { bidId, loadId, reason, domain: 'bid' });
    },
  },

  trip: {
    started: (tripId: string, driverId: string, loadId: string) => {
      logger.info('Trip started', { tripId, driverId, loadId, domain: 'trip' });
    },
    completed: (tripId: string, driverId: string, duration: number) => {
      logger.info('Trip completed', { tripId, driverId, duration, domain: 'trip' });
    },
    cancelled: (tripId: string, reason: string) => {
      logger.warn('Trip cancelled', { tripId, reason, domain: 'trip' });
    },
  },

  notification: {
    sent: (userId: string, type: string, channel: 'push' | 'sms' | 'email') => {
      logger.info('Notification sent', { userId, type, channel, domain: 'notification' });
    },
    failed: (userId: string, type: string, channel: string, error: string) => {
      logger.error('Notification failed', { userId, type, channel, error, domain: 'notification' });
    },
  },

  api: {
    request: (method: string, path: string, userId?: string, duration?: number) => {
      logger.http('API Request', { method, path, userId, duration, domain: 'api' });
    },
    error: (method: string, path: string, error: string, statusCode: number) => {
      logger.error('API Error', { method, path, error, statusCode, domain: 'api' });
    },
    rateLimit: (ip: string, path: string) => {
      logger.warn('Rate limit exceeded', { ip, path, domain: 'api' });
    },
  },

  security: {
    suspiciousActivity: (userId: string, activity: string, ip: string) => {
      logger.warn('Suspicious activity detected', { userId, activity, ip, domain: 'security' });
    },
    invalidToken: (ip: string) => {
      logger.warn('Invalid token attempt', { ip, domain: 'security' });
    },
    accountLocked: (userId: string, reason: string) => {
      logger.warn('Account locked', { userId, reason, domain: 'security' });
    },
  },

  database: {
    connectionError: (error: string) => {
      logger.error('Database connection error', { error, domain: 'database' });
    },
    queryError: (query: string, error: string) => {
      logger.error('Database query error', { query, error, domain: 'database' });
    },
    slowQuery: (query: string, duration: number) => {
      logger.warn('Slow database query', { query, duration, domain: 'database' });
    },
  },

  system: {
    startup: () => {
      logger.info('🚀 Server started successfully', { domain: 'system' });
    },
    shutdown: () => {
      logger.info('Server shutting down', { domain: 'system' });
    },
    healthCheck: (status: 'healthy' | 'unhealthy', details?: any) => {
      if (status === 'healthy') {
        logger.info('Health check passed', { status, ...details, domain: 'system' });
      } else {
        logger.error('Health check failed', { status, ...details, domain: 'system' });
      }
    },
  },
};

// Export the main logger
export default logger;