// Enhanced Environment Configuration
// Location: backend/src/config/env.ts

import { subscribe } from 'diagnostics_channel';
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

// Environment validation schema
const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('5000'),
  API_VERSION: z.string().default('v1'),
  API_PREFIX: z.string().default('/api'),

  // Database
  DATABASE_URL: z.string().min(1, 'Database URL is required').default('postgresql://postgres:dontknow@localhost:5432/qonvey?schema=public'),
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.string().transform(Number).default('5432'),
  DB_USER: z.string().min(1, 'Database user is required').default('postgres'),
  DB_PASSWORD: z.string().min(1, 'Database password is required').default('dontknow'),
  DB_NAME: z.string().min(1, 'Database name is required').default('qonvey'),  

  // Redis
  REDIS_URL: z.string().optional(),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().transform(Number).default('6379'),
  REDIS_PASSWORD: z.string().optional(),

  // JWT
  JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters'),
  JWT_EXPIRE: z.string().default('7d'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT refresh secret must be at least 32 characters'),
  JWT_REFRESH_EXPIRE: z.string().default('30d'),

  // CORS
  CORS_ORIGIN: z.string().default('http://localhost:3000'),

  // Payment - Paynow
  PAYNOW_INTEGRATION_ID: z.string().optional(),
  PAYNOW_INTEGRATION_KEY: z.string().optional(),
  PAYNOW_RETURN_URL: z.string().url().optional(),
  PAYNOW_RESULT_URL: z.string().url().optional(),

  // SMS - Twilio
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),
  TWILIO_ENABLED: z.string().transform(val => val === 'true').default('true'),

  // SMS - Africa's Talking (Alternative)
  AFRICASTALKING_API_KEY: z.string().optional(),
  AFRICASTALKING_USERNAME: z.string().optional(),

  // Email
  SMTP_HOST: z.string().default('smtp.gmail.com'),
  SMTP_PORT: z.string().transform(Number).default('587'),
  SMTP_SECURE: z.string().transform(val => val === 'true').default('false'),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().email().optional(),

  // Firebase
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().email().optional(),
  FIREBASE_DATABASE_URL: z.string().url().optional(),

  // Cloudinary
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),

  // AWS S3
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_S3_BUCKET: z.string().optional(),
  AWS_REGION: z.string().default('af-south-1'),

  // Maps
  GOOGLE_MAPS_API_KEY: z.string().optional(),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('900000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default('100'),

  // Monitoring
  SENTRY_DSN: z.string().url().optional(),
  DATADOG_API_KEY: z.string().optional(),

  // Subscription Pricing
  SUBSCRIPTION_STARTER_PRICE: z.string().transform(Number).default('3'),
  SUBSCRIPTION_PROFESSIONAL_PRICE: z.string().transform(Number).default('5'),
  SUBSCRIPTION_BUSINESS_PRICE: z.string().transform(Number).default('7'),
  SUBSCRIPTION_TRIAL_DAYS: z.string().transform(Number).default('30'),

  // Feature Flags
  ENABLE_SOCKET_IO: z.string().transform(val => val === 'true').default('true'),
  ENABLE_RATE_LIMITING: z.string().transform(val => val === 'true').default('true'),
  ENABLE_PAYMENT_GATEWAY: z.string().transform(val => val === 'true').default('true'),
  ENABLE_SMS_NOTIFICATIONS: z.string().transform(val => val === 'true').default('true'),
  ENABLE_EMAIL_NOTIFICATIONS: z.string().transform(val => val === 'true').default('true'),

  // Bank Details
  BANK_NAME: z.string().optional(),
  BANK_ACCOUNT_NUMBER: z.string().optional(),
  BANK_ACCOUNT_NAME: z.string().optional(),
  BANK_BRANCH_CODE: z.string().optional(),
  BANK_SWIFT_CODE: z.string().optional(),

  // Client URLs
  CLIENT_URL: z.string().url().default('http://localhost:3000'),
  MOBILE_DEEP_LINK: z.string().default('qonvey://'),
  // APP_STORE_URL: z.string().url().optional(),
  // PLAY_STORE_URL: z.string().url().optional(),

  // Admin
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PHONE: z.string().optional(),
  SUPPORT_EMAIL: z.string().email().optional(),
  SUPPORT_PHONE: z.string().optional(),
  SUPPORT_WHATSAPP: z.string().optional(),
});

// Validate and parse environment variables
let env: z.infer<typeof envSchema>;

try {
  env = envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error('❌ Invalid environment variables:');
    error.errors.forEach((err) => {
      console.error(`  ${err.path.join('.')}: ${err.message}`);
    });
    process.exit(1);
  }
  throw error;
}

// Export typed environment configuration
export const config = {
  // Server
  env: env.NODE_ENV,
  port: env.PORT,
  apiVersion: env.API_VERSION,
  apiPrefix: env.API_PREFIX,
  isDevelopment: env.NODE_ENV === 'development',
  isProduction: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',

  // Database
  database: {
    url: env.DATABASE_URL,
  },

  // Redis
  redis: {
    url: env.REDIS_URL,
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD,
  },

  // JWT
  jwt: {
    secret: env.JWT_SECRET,
    expire: env.JWT_EXPIRE,
    refreshSecret: env.JWT_REFRESH_SECRET,
    refreshExpire: env.JWT_REFRESH_EXPIRE,
  },

  // CORS
  cors: {
    origin: env.CORS_ORIGIN.split(',').map(origin => origin.trim()),
  },

  // Payment
  payment: {
    paynow: {
      integrationId: env.PAYNOW_INTEGRATION_ID || '',
      integrationKey: env.PAYNOW_INTEGRATION_KEY || '',
      returnUrl: env.PAYNOW_RETURN_URL || '',
      resultUrl: env.PAYNOW_RESULT_URL || '',
      enabled: !!env.PAYNOW_INTEGRATION_ID && !!env.PAYNOW_INTEGRATION_KEY,
    },
    subscriptionPrices: {
      STARTER: env.SUBSCRIPTION_STARTER_PRICE,
      PROFESSIONAL: env.SUBSCRIPTION_PROFESSIONAL_PRICE,
      BUSINESS: env.SUBSCRIPTION_BUSINESS_PRICE,
    },
  },

  // SMS
  sms: {
    twilio: {
      accountSid: env.TWILIO_ACCOUNT_SID || '',
      authToken: env.TWILIO_AUTH_TOKEN || '',
      phoneNumber: env.TWILIO_PHONE_NUMBER || '',
      enabled: !!env.TWILIO_ACCOUNT_SID && !!env.TWILIO_AUTH_TOKEN,
    },
    africasTalking: {
      apiKey: env.AFRICASTALKING_API_KEY || '',
      username: env.AFRICASTALKING_USERNAME || '',
      enabled: !!env.AFRICASTALKING_API_KEY && !!env.AFRICASTALKING_USERNAME,
    },
  },

  // Email
  email: {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    user: env.SMTP_USER || '',
    pass: env.SMTP_PASS || '',
    from: env.EMAIL_FROM || env.SMTP_USER || 'noreply@qonvey.co.zw',
    enabled: !!env.SMTP_USER && !!env.SMTP_PASS,
  },

  // Firebase
  firebase: {
    projectId: env.FIREBASE_PROJECT_ID || '',
    privateKey: env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n') || '',
    clientEmail: env.FIREBASE_CLIENT_EMAIL || '',
    databaseURL: env.FIREBASE_DATABASE_URL || '',
    enabled: !!env.FIREBASE_PROJECT_ID && !!env.FIREBASE_PRIVATE_KEY,
  },

  // File Storage
  storage: {
    cloudinary: {
      cloudName: env.CLOUDINARY_CLOUD_NAME || '',
      apiKey: env.CLOUDINARY_API_KEY || '',
      apiSecret: env.CLOUDINARY_API_SECRET || '',
      enabled: !!env.CLOUDINARY_CLOUD_NAME,
    },
    aws: {
      accessKeyId: env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY || '',
      bucket: env.AWS_S3_BUCKET || '',
      region: env.AWS_REGION,
      enabled: !!env.AWS_ACCESS_KEY_ID && !!env.AWS_S3_BUCKET,
    },
  },

  // Bank Details
  bank: {
    name: env.BANK_NAME || '',
    accountNumber: env.BANK_ACCOUNT_NUMBER || '',
    accountName: env.BANK_ACCOUNT_NAME || '',
    branchCode: env.BANK_BRANCH_CODE || '',
    swiftCode: env.BANK_SWIFT_CODE || '',
  },

  // Maps
  maps: {
    googleApiKey: env.GOOGLE_MAPS_API_KEY || '',
    enabled: !!env.GOOGLE_MAPS_API_KEY,
  },

  // Rate Limiting
  rateLimit: {
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
  },

  // Monitoring
  monitoring: {
    sentry: {
      dsn: env.SENTRY_DSN || '',
      enabled: !!env.SENTRY_DSN,
    },
    datadog: {
      apiKey: env.DATADOG_API_KEY || '',
      enabled: !!env.DATADOG_API_KEY,
    },
  },

  // Subscription
  subscription: {
    prices: {
      starter: env.SUBSCRIPTION_STARTER_PRICE,
      professional: env.SUBSCRIPTION_PROFESSIONAL_PRICE,
      business: env.SUBSCRIPTION_BUSINESS_PRICE,
    },
    trialDays: env.SUBSCRIPTION_TRIAL_DAYS,
  },

  // Feature Flags
  features: {
    socketIO: env.ENABLE_SOCKET_IO,
    rateLimiting: env.ENABLE_RATE_LIMITING,
    paymentGateway: env.ENABLE_PAYMENT_GATEWAY,
    smsNotifications: env.ENABLE_SMS_NOTIFICATIONS,
    emailNotifications: env.ENABLE_EMAIL_NOTIFICATIONS,
  },

  // Client URLs
  client: {
    url: env.CLIENT_URL,
    mobileDeepLink: env.MOBILE_DEEP_LINK,
    // appStoreUrl: env.APP_STORE_URL || '',
    // playStoreUrl: env.PLAY_STORE_URL || '',
  },

  // Database connection parameters
  db: {
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    name: env.DB_NAME,
  },

  twilio: {
    accountSid: env.TWILIO_ACCOUNT_SID || '',
    authToken: env.TWILIO_AUTH_TOKEN || '',
    phoneNumber: env.TWILIO_PHONE_NUMBER || '',
    enabled: env.TWILIO_ENABLED,
  },

  // Admin & Support
  admin: {
    email: env.ADMIN_EMAIL || 'admin@qonvey.co.zw',
    phone: env.ADMIN_PHONE || '',
  },
  support: {
    email: env.SUPPORT_EMAIL || 'support@qonvey.co.zw',
    phone: env.SUPPORT_PHONE || '',
    whatsapp: env.SUPPORT_WHATSAPP || '',
  },
};

// Log configuration status on startup (only in development)
if (config.isDevelopment) {
  console.log('🔧 Configuration loaded:');
  console.log(`  Environment: ${config.env}`);
  console.log(`  Port: ${config.port}`);
  console.log(`  Payment Gateway: ${config.payment.paynow.enabled ? '✅' : '❌'}`);
  console.log(`  SMS (Twilio): ${config.sms.twilio.enabled ? '✅' : '❌'}`);
  console.log(`  Email: ${config.email.enabled ? '✅' : '❌'}`);
  console.log(`  Firebase: ${config.firebase.enabled ? '✅' : '❌'}`);
  console.log(`  Cloudinary: ${config.storage.cloudinary.enabled ? '✅' : '❌'}`);
}

export default config;