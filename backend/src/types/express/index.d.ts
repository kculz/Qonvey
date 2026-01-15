import { UserRole } from '@/models/user.model';

declare global {
  namespace Express {
    interface Request {
      version: string;
      user?: {
        id: string;
        role: UserRole;
        subscription?: {
          plan: 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'BUSINESS';
        };
      };
      rateLimit?: RateLimitInfo;
    }
  }
}

interface RateLimitInfo {
  limit: number;
  current: number;
  remaining: number;
  resetTime: Date;
}
