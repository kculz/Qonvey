// Redis Client Utility
// Location: backend/src/utils/redis.ts

import Redis from 'ioredis';
import { config } from '@/config/env';
import { loggers } from './logger';

let redisClient: Redis | null = null;

export const getRedisClient = (): Redis => {
  if (redisClient) {
    return redisClient;
  }

  const redisConfig: any = {
    host: config.redis.host,
    port: config.redis.port,
    retryStrategy: (times: number) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    maxRetriesPerRequest: 3,
  };

  if (config.redis.password) {
    redisConfig.password = config.redis.password;
  }

  if (config.redis.url) {
    redisClient = new Redis(config.redis.url, redisConfig);
  } else {
    redisClient = new Redis(redisConfig);
  }

  redisClient.on('connect', () => {
    loggers.info('Redis connected', { host: config.redis.host, port: config.redis.port });
  });

  redisClient.on('error', (error) => {
    loggers.error('Redis error', error);
  });

  redisClient.on('close', () => {
    loggers.info('Redis connection closed');
  });

  return redisClient;
};

export const closeRedisConnection = async (): Promise<void> => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
};

// OTP Storage Helpers
export const otpRedis = {
  async set(phoneNumber: string, otp: string, expiresInSeconds: number = 600): Promise<void> {
    const client = getRedisClient();
    const key = `otp:${phoneNumber}`;
    const data = JSON.stringify({
      otp,
      attempts: 0,
      createdAt: new Date().toISOString(),
    });
    await client.setex(key, expiresInSeconds, data);
  },

  async get(phoneNumber: string): Promise<{ otp: string; attempts: number; createdAt: string } | null> {
    const client = getRedisClient();
    const key = `otp:${phoneNumber}`;
    const data = await client.get(key);
    if (!data) return null;
    return JSON.parse(data);
  },

  async incrementAttempts(phoneNumber: string): Promise<number> {
    const client = getRedisClient();
    const key = `otp:${phoneNumber}`;
    const data = await client.get(key);
    if (!data) return 0;
    
    const parsed = JSON.parse(data);
    parsed.attempts = (parsed.attempts || 0) + 1;
    const ttl = await client.ttl(key);
    if (ttl > 0) {
      await client.setex(key, ttl, JSON.stringify(parsed));
    }
    return parsed.attempts;
  },

  async delete(phoneNumber: string): Promise<void> {
    const client = getRedisClient();
    const key = `otp:${phoneNumber}`;
    await client.del(key);
  },

  async exists(phoneNumber: string): Promise<boolean> {
    const client = getRedisClient();
    const key = `otp:${phoneNumber}`;
    const result = await client.exists(key);
    return result === 1;
  },
};

export default getRedisClient;

