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