// backend/src/types/subscription.types.ts

export enum PlanType {
  FREE = 'FREE',
  STARTER = 'STARTER',
  PROFESSIONAL = 'PROFESSIONAL',
  BUSINESS = 'BUSINESS'
}

export enum SubscriptionStatus {
  TRIAL = 'TRIAL',
  ACTIVE = 'ACTIVE',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED'
}

export interface FeatureAccess {
  priorityListing: boolean;
  featuredListing: boolean;
  topPlacement: boolean;
  verifiedBadge: boolean;
  advancedChat: boolean;
  loadTemplates: boolean;
  bulkOperations: boolean;
  analytics: boolean;
  advancedAnalytics: boolean;
  apiAccess: boolean;
  fullApiAccess: boolean;
  invoiceGenerator: boolean;
  teamManagement: boolean;
  dedicatedSupport: boolean;
  historyDays: number;
  maxVehicles: number;
  maxTeamMembers: number;
}

export interface UsageLimit {
  allowed: boolean;
  reason?: string;
  remaining?: number;
  limit?: number;
  upgradeTo?: PlanType;
}

export interface SubscriptionResponse {
  id: string;
  userId: string;
  plan: PlanType;
  status: SubscriptionStatus;
  amount: number;
  startDate?: Date;
  endDate?: Date;
  trialStartDate?: Date;
  trialEndDate?: Date;
  autoRenew: boolean;
  loadsPostedThisMonth: number;
  bidsPlacedThisMonth: number;
  nextBillingDate?: Date;
  lastPayment?: Date;
  paymentMethod?: string;
  createdAt: Date;
  updatedAt: Date;
  user?: any;
}

export interface SubscriptionStats {
  plan: PlanType;
  status: SubscriptionStatus;
  loadsPostedThisMonth: number;
  bidsPlacedThisMonth: number;
  totalLoads: number;
  totalBids: number;
  completedTrips: number;
  trialEndsAt?: Date;
  nextBillingDate?: Date;
  amount: number;
}

export interface PlanPricing {
  [key: string]: {
    price: number;
    currency: string;
    features: FeatureAccess;
  };
}

export interface SubscriptionUsageAnalytics {
  subscription: {
    plan: PlanType;
    status: SubscriptionStatus;
    startDate?: Date;
    endDate?: Date;
  };
  usage: {
    vehicles: {
      count: number;
      limit: number;
      usagePercent: number;
      remaining: number;
    };
    teamMembers: {
      count: number;
      limit: number;
      usagePercent: number;
      remaining: number;
    };
    monthly: {
      loads: {
        count: number;
        unlimited: boolean;
      };
      bids: {
        count: number;
        unlimited: boolean;
      };
    };
  };
  features: FeatureAccess;
}

export interface TrialEligibility {
  eligible: boolean;
  reason?: string;
}