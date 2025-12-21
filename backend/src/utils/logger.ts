import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import morgan from 'morgan';
import { Request, Response } from 'express';
import path from 'path';

// Define custom log levels
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define custom colors for each level
const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

// Add colors to winston
winston.addColors(logColors);

// Define log format based on environment
const getLogFormat = (env: string) => {
  const isDevelopment = env === 'development';
  
  return winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
    winston.format.errors({ stack: true }),
    isDevelopment
      ? winston.format.colorize({ all: true })
      : winston.format.uncolorize(),
    winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
      let log = `${timestamp} [${level}]: ${message}`;
      
      if (stack) {
        log += `\n${stack}`;
      }
      
      if (Object.keys(meta).length > 0) {
        log += `\n${JSON.stringify(meta, null, 2)}`;
      }
      
      return log;
    })
  );
};

// Create rotating file transport
const createRotatingTransport = (
  filename: string,
  level: string,
  maxSize: string = '5m',
  maxFiles: string = '14d'
): DailyRotateFile => {
  const logsDir = process.env.LOGS_DIR || 'logs';
  
  return new DailyRotateFile({
    filename: path.join(logsDir, `${filename}-%DATE%.log`),
    datePattern: 'YYYY-MM-DD',
    maxSize,
    maxFiles,
    level,
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
  });
};

// Base transports
const getTransports = (env: string) => {
  const transports: winston.transport[] = [
    // Console transport for all environments
    new winston.transports.Console({
      format: getLogFormat(env),
    }),
  ];

  // File transports for production
  if (env === 'production') {
    transports.push(
      createRotatingTransport('error', 'error'),
      createRotatingTransport('combined', 'info'),
      createRotatingTransport('http', 'http')
    );
  }

  return transports;
};

// Create base logger
const env = process.env.NODE_ENV || 'development';
export const loggers = winston.createLogger({
  level: env === 'development' ? 'debug' : 'info',
  levels: logLevels,
  transports: getTransports(env),
  exitOnError: false,
});

// Domain-specific child logger
export const authLogger = loggers.child({ domain: 'authentication' });
export const subscriptionLogger = loggers.child({ domain: 'subscription' });
export const loadLogger = loggers.child({ domain: 'load-operations' });
export const bidLogger = loggers.child({ domain: 'bid-operations' });
export const tripLogger = loggers.child({ domain: 'trip-operations' });
export const paymentLogger = loggers.child({ domain: 'payment-tracking' });
export const apiLogger = loggers.child({ domain: 'api-requests' });
export const securityLogger = loggers.child({ domain: 'security-alerts' });
export const healthLogger = loggers.child({ domain: 'system-health' });

// Morgan stream for HTTP logging
export const morganStream = {
  write: (message: string) => {
    const cleanedMessage = message.trim();
    if (cleanedMessage) {
      loggers.http(cleanedMessage);
    }
  },
};

// Custom Morgan token for request body (excluding sensitive data)
morgan.token('body', (req: Request) => {
  const body = { ...req.body };
  
  // Remove sensitive fields
  const sensitiveFields = [
    'password',
    'token',
    'creditCard',
    'cvv',
    'ssn',
    'secret',
    'apiKey',
  ];
  
  sensitiveFields.forEach(field => {
    if (body[field]) {
      body[field] = '***REDACTED***';
    }
  });
  
  return JSON.stringify(body);
});

// Custom Morgan token for response body (excluding large or sensitive data)
morgan.token('res-body', (_req: Request, res: Response) => {
  const body = res.locals.body || {};
  
  // Truncate large responses
  const bodyStr = JSON.stringify(body);
  if (bodyStr.length > 1000) {
    return `${bodyStr.substring(0, 1000)}... [TRUNCATED]`;
  }
  
  return bodyStr;
});

// HTTP request logging middleware
export const httpLogger = morgan(
  (tokens, req, res) => {
    return JSON.stringify({
      method: tokens.method(req, res),
      url: tokens.url(req, res),
      status: tokens.status(req, res),
      content_length: tokens.res(req, res, 'content-length'),
      response_time: `${tokens['response-time'](req, res)}ms`,
      timestamp: tokens.date(req, res, 'iso'),
      ip: req.ip,
      user_agent: req.get('user-agent'),
      request_id: req.headers['x-request-id'],
      user_id: req.user?.id || 'anonymous',
    });
  },
  {
    stream: morganStream,
    skip: (req) => {
      // Skip health check endpoints from general logging
      return req.url === '/health' || req.url === '/api/health';
    },
  }
);

// Health check endpoint logger
export const healthCheckLogger = morgan(
  ':method :url :status :response-time ms',
  {
    stream: {
      write: (message: string) => {
        healthLogger.http(message.trim());
      },
    },
    skip: (req) => req.url !== '/health' && req.url !== '/api/health',
  }
);

// Custom logging functions for specific domains
export const logger = {
  // Authentication logging
  auth: {
    loginSuccess: (userId: string, metadata?: Record<string, any>) => {
      authLogger.info(`User ${userId} logged in successfully`, metadata);
    },
    loginFailure: (username: string, reason: string, metadata?: Record<string, any>) => {
      authLogger.warn(`Failed login attempt for ${username}: ${reason}`, metadata);
    },
    logout: (userId: string, metadata?: Record<string, any>) => {
      authLogger.info(`User ${userId} logged out`, metadata);
    },
    tokenRefresh: (userId: string, metadata?: Record<string, any>) => {
      authLogger.debug(`Token refreshed for user ${userId}`, metadata);
    },
  },

  // Subscription logging
  subscription: {
    created: (subscriptionId: string, userId: string, plan: string, metadata?: Record<string, any>) => {
      subscriptionLogger.info(`Subscription ${subscriptionId} created for user ${userId} (plan: ${plan})`, metadata);
    },
    updated: (subscriptionId: string, changes: Record<string, any>, metadata?: Record<string, any>) => {
      subscriptionLogger.info(`Subscription ${subscriptionId} updated`, { changes, ...metadata });
    },
    cancelled: (subscriptionId: string, reason: string, metadata?: Record<string, any>) => {
      subscriptionLogger.warn(`Subscription ${subscriptionId} cancelled: ${reason}`, metadata);
    },
    paymentFailed: (subscriptionId: string, userId: string, error: string, metadata?: Record<string, any>) => {
      subscriptionLogger.error(`Payment failed for subscription ${subscriptionId}, user ${userId}: ${error}`, metadata);
    },
  },

  // Load operations
  load: {
    created: (loadId: string, metadata?: Record<string, any>) => {
      loadLogger.info(`Load ${loadId} created`, metadata);
    },
    updated: (loadId: string, changes: Record<string, any>, metadata?: Record<string, any>) => {
      loadLogger.info(`Load ${loadId} updated`, { changes, ...metadata });
    },
    assigned: (loadId: string, driverId: string, metadata?: Record<string, any>) => {
      loadLogger.info(`Load ${loadId} assigned to driver ${driverId}`, metadata);
    },
    delivered: (loadId: string, metadata?: Record<string, any>) => {
      loadLogger.info(`Load ${loadId} delivered`, metadata);
    },
  },

  // Bid operations
  bid: {
    placed: (bidId: string, loadId: string, amount: number, metadata?: Record<string, any>) => {
      bidLogger.info(`Bid ${bidId} placed on load ${loadId} for $${amount}`, metadata);
    },
    accepted: (bidId: string, loadId: string, metadata?: Record<string, any>) => {
      bidLogger.info(`Bid ${bidId} accepted for load ${loadId}`, metadata);
    },
    rejected: (bidId: string, loadId: string, reason: string, metadata?: Record<string, any>) => {
      bidLogger.warn(`Bid ${bidId} rejected for load ${loadId}: ${reason}`, metadata);
    },
  },

  // Trip operations
  trip: {
    started: (tripId: string, metadata?: Record<string, any>) => {
      tripLogger.info(`Trip ${tripId} started`, metadata);
    },
    locationUpdate: (tripId: string, location: any, metadata?: Record<string, any>) => {
      tripLogger.debug(`Trip ${tripId} location update`, { location, ...metadata });
    },
    completed: (tripId: string, metadata?: Record<string, any>) => {
      tripLogger.info(`Trip ${tripId} completed`, metadata);
    },
    delayed: (tripId: string, reason: string, metadata?: Record<string, any>) => {
      tripLogger.warn(`Trip ${tripId} delayed: ${reason}`, metadata);
    },
  },

  // Payment tracking
  payment: {
    initiated: (paymentId: string, amount: number, metadata?: Record<string, any>) => {
      paymentLogger.info(`Payment ${paymentId} initiated for $${amount}`, metadata);
    },
    completed: (paymentId: string, metadata?: Record<string, any>) => {
      paymentLogger.info(`Payment ${paymentId} completed successfully`, metadata);
    },
    failed: (paymentId: string, error: string, metadata?: Record<string, any>) => {
      paymentLogger.error(`Payment ${paymentId} failed: ${error}`, metadata);
    },
    refunded: (paymentId: string, amount: number, metadata?: Record<string, any>) => {
      paymentLogger.info(`Payment ${paymentId} refunded $${amount}`, metadata);
    },
  },

  // Security alerts
  security: {
    suspiciousActivity: (userId: string, activity: string, metadata?: Record<string, any>) => {
      securityLogger.warn(`Suspicious activity detected for user ${userId}: ${activity}`, metadata);
    },
    bruteForceAttempt: (ip: string, attempts: number, metadata?: Record<string, any>) => {
      securityLogger.error(`Brute force attempt from IP ${ip} (${attempts} attempts)`, metadata);
    },
    unauthorizedAccess: (resource: string, user: string, metadata?: Record<string, any>) => {
      securityLogger.error(`Unauthorized access attempt to ${resource} by ${user}`, metadata);
    },
    rateLimitExceeded: (ip: string, endpoint: string, metadata?: Record<string, any>) => {
      securityLogger.warn(`Rate limit exceeded for IP ${ip} on ${endpoint}`, metadata);
    },
  },

  // System health
  health: {
    startup: (service: string, metadata?: Record<string, any>) => {
      healthLogger.info(`${service} service started`, metadata);
    },
    shutdown: (service: string, reason: string, metadata?: Record<string, any>) => {
      healthLogger.warn(`${service} service shutting down: ${reason}`, metadata);
    },
    error: (service: string, error: Error, metadata?: Record<string, any>) => {
      healthLogger.error(`${service} service error: ${error.message}`, { error, ...metadata });
    },
    performance: (operation: string, duration: number, metadata?: Record<string, any>) => {
      healthLogger.debug(`${operation} completed in ${duration}ms`, metadata);
    },
  },
};

// Utility function for structured error logging
export const logError = (error: Error, context?: string, metadata?: Record<string, any>) => {
  loggers.error({
    message: error.message,
    stack: error.stack,
    name: error.name,
    context,
    ...metadata,
  });
};

// Utility function for API request logging
export const logApiRequest = (
  method: string,
  url: string,
  statusCode: number,
  duration: number,
  userId?: string,
  metadata?: Record<string, any>
) => {
  apiLogger.http(`${method} ${url}`, {
    statusCode,
    duration: `${duration}ms`,
    userId: userId || 'anonymous',
    ...metadata,
  });
};

// Handle uncaught exceptions and unhandled rejections
process.on('uncaughtException', (error) => {
  logError(error, 'uncaughtException');
  // Don't exit immediately in production, let the process manager handle it
  if (process.env.NODE_ENV === 'development') {
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  loggers.error('Unhandled Rejection at:', { promise, reason });
});

export default loggers;