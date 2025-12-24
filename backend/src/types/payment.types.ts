import { PlanType, PaymentMethod } from '@prisma/client';

export interface PaymentResult {
  success: boolean;
  reference?: string;
  pollUrl?: string;
  redirectUrl?: string;
  message?: string;
  error?: string;
}

export interface PaymentStatus {
  paid: boolean;
  amount: number;
  reference: string;
  status: string;
  message?: string;
}

