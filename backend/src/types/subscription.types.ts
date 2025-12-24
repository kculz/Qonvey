import { PlanType, SubscriptionStatus } from '@prisma/client';

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
  upgradeTo?: string;
}

