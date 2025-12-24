import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      version: string;
      user?: {
        id: string;
        subscription?: {
          plan: 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'BUSINESS';
        };
      };
      // express-rate-limit attaches this property to the request
      rateLimit?: RateLimitInfo;
    }
    }
  }
}
