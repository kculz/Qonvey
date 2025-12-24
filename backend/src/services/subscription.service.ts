// Complete Subscription Service
// Location: backend/src/services/subscription.service.ts

import prisma from '@/config/database';
import { config } from '@/config/env';
import { loggers } from '@/utils/logger';
import { PlanType, SubscriptionStatus } from '@prisma/client';
import type { FeatureAccess, UsageLimit } from '@/types/subscription.types';

class SubscriptionService {
  // ============================================
  // SUBSCRIPTION MANAGEMENT
  // ============================================

  async getUserSubscription(userId: string) {
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
      },
    });

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    // Check if trial has expired
    if (subscription.status === 'TRIAL' && subscription.trialEndDate) {
      if (new Date() > subscription.trialEndDate) {
        await this.expireTrial(userId);
        subscription.status = 'EXPIRED';
        subscription.plan = 'FREE';
      }
    }

    // Check if subscription has expired
    if (subscription.status === 'ACTIVE' && subscription.endDate) {
      if (new Date() > subscription.endDate) {
        await this.expireSubscription(userId);
        subscription.status = 'EXPIRED';
        subscription.plan = 'FREE';
      }
    }

    return subscription;
  }

  async createTrialSubscription(userId: string) {
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + config.subscription.trialDays);

    const subscription = await prisma.subscription.create({
      data: {
        userId,
        plan: 'STARTER',
        status: 'TRIAL',
        trialStartDate: new Date(),
        trialEndDate,
        hasUsedTrial: true,
        amount: 0,
      },
    });

    loggers.subscription.created(userId, 'STARTER (TRIAL)');
    return subscription;
  }

  async upgradePlan(userId: string, newPlan: PlanType, paymentReference?: string) {
    const currentSubscription = await this.getUserSubscription(userId);

    const prices = {
      STARTER: config.subscription.prices.starter,
      PROFESSIONAL: config.subscription.prices.professional,
      BUSINESS: config.subscription.prices.business,
      FREE: 0,
    };

    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 1);

    const subscription = await prisma.subscription.update({
      where: { userId },
      data: {
        plan: newPlan,
        status: 'ACTIVE',
        amount: prices[newPlan],
        startDate,
        endDate,
        nextBillingDate: endDate,
        lastPayment: new Date(),
        paymentMethod: paymentReference ? 'ECOCASH' : undefined,
      },
    });

    loggers.subscription.upgraded(userId, currentSubscription.plan, newPlan);
    return subscription;
  }

  async downgradePlan(userId: string, reason?: string) {
    const currentSubscription = await this.getUserSubscription(userId);

    const subscription = await prisma.subscription.update({
      where: { userId },
      data: {
        plan: 'FREE',
        status: 'ACTIVE',
        amount: 0,
        endDate: null,
        nextBillingDate: null,
      },
    });

    loggers.subscription.cancelled(userId, currentSubscription.plan, reason);
    return subscription;
  }

  async cancelSubscription(userId: string, reason?: string) {
    const subscription = await prisma.subscription.update({
      where: { userId },
      data: {
        status: 'CANCELLED',
        autoRenew: false,
      },
    });

    loggers.subscription.cancelled(userId, subscription.plan, reason);
    return subscription;
  }

  async expireTrial(userId: string) {
    const subscription = await prisma.subscription.update({
      where: { userId },
      data: {
        status: 'EXPIRED',
        plan: 'FREE',
        amount: 0,
      },
    });

    loggers.subscription.expired(userId, 'TRIAL');
    return subscription;
  }

  async expireSubscription(userId: string) {
    const currentSubscription = await this.getUserSubscription(userId);

    const subscription = await prisma.subscription.update({
      where: { userId },
      data: {
        status: 'EXPIRED',
        plan: 'FREE',
        amount: 0,
      },
    });

    loggers.subscription.expired(userId, currentSubscription.plan);
    return subscription;
  }

  async renewSubscription(userId: string, paymentReference: string) {
    const currentSubscription = await this.getUserSubscription(userId);

    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 1);

    const subscription = await prisma.subscription.update({
      where: { userId },
      data: {
        status: 'ACTIVE',
        startDate: new Date(),
        endDate,
        nextBillingDate: endDate,
        lastPayment: new Date(),
      },
    });

    loggers.subscription.paymentSuccess(userId, currentSubscription.amount, currentSubscription.plan);
    return subscription;
  }

  // ============================================
  // FEATURE ACCESS CHECKS
  // ============================================

  async getFeatureAccess(userId: string): Promise<FeatureAccess> {
    const subscription = await this.getUserSubscription(userId);
    return this.getPlanFeatures(subscription.plan);
  }

  getPlanFeatures(plan: PlanType): FeatureAccess {
    const features: Record<PlanType, FeatureAccess> = {
      FREE: {
        priorityListing: false,
        featuredListing: false,
        topPlacement: false,
        verifiedBadge: false,
        advancedChat: false,
        loadTemplates: false,
        bulkOperations: false,
        analytics: false,
        advancedAnalytics: false,
        apiAccess: false,
        fullApiAccess: false,
        invoiceGenerator: false,
        teamManagement: false,
        dedicatedSupport: false,
        historyDays: 7,
        maxVehicles: 1,
        maxTeamMembers: 0,
      },
      STARTER: {
        priorityListing: true,
        featuredListing: false,
        topPlacement: false,
        verifiedBadge: true,
        advancedChat: true,
        loadTemplates: true,
        bulkOperations: false,
        analytics: true,
        advancedAnalytics: false,
        apiAccess: false,
        fullApiAccess: false,
        invoiceGenerator: false,
        teamManagement: false,
        dedicatedSupport: false,
        historyDays: 7,
        maxVehicles: 1,
        maxTeamMembers: 0,
      },
      PROFESSIONAL: {
        priorityListing: true,
        featuredListing: true,
        topPlacement: false,
        verifiedBadge: true,
        advancedChat: true,
        loadTemplates: true,
        bulkOperations: true,
        analytics: true,
        advancedAnalytics: true,
        apiAccess: true,
        fullApiAccess: false,
        invoiceGenerator: false,
        teamManagement: false,
        dedicatedSupport: false,
        historyDays: 30,
        maxVehicles: 5,
        maxTeamMembers: 0,
      },
      BUSINESS: {
        priorityListing: true,
        featuredListing: true,
        topPlacement: true,
        verifiedBadge: true,
        advancedChat: true,
        loadTemplates: true,
        bulkOperations: true,
        analytics: true,
        advancedAnalytics: true,
        apiAccess: true,
        fullApiAccess: true,
        invoiceGenerator: true,
        teamManagement: true,
        dedicatedSupport: true,
        historyDays: 90,
        maxVehicles: Infinity,
        maxTeamMembers: 3,
      },
    };

    return features[plan];
  }

  // ============================================
  // USAGE LIMIT CHECKS
  // ============================================

  async canPostLoad(userId: string): Promise<UsageLimit> {
    const subscription = await this.getUserSubscription(userId);

    // Reset monthly usage if needed
    await this.resetMonthlyUsageIfNeeded(subscription.id);

    // Get updated subscription
    const updatedSubscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    if (!updatedSubscription) {
      return { allowed: false, reason: 'Subscription not found' };
    }

    // Check subscription status
    if (updatedSubscription.status === 'EXPIRED' || updatedSubscription.status === 'CANCELLED') {
      return { allowed: false, reason: 'Subscription expired or cancelled' };
    }

    // FREE tier - 1 load per month
    if (updatedSubscription.plan === 'FREE') {
      if (updatedSubscription.loadsPostedThisMonth >= 1) {
        return {
          allowed: false,
          reason: 'Free tier allows 1 load per month',
          remaining: 0,
          limit: 1,
          upgradeTo: 'STARTER',
        };
      }
      return { allowed: true, remaining: 1 - updatedSubscription.loadsPostedThisMonth, limit: 1 };
    }

    // Paid tiers - unlimited loads
    return { allowed: true };
  }

  async canPlaceBid(userId: string): Promise<UsageLimit> {
    const subscription = await this.getUserSubscription(userId);

    // Reset monthly usage if needed
    await this.resetMonthlyUsageIfNeeded(subscription.id);

    // Get updated subscription
    const updatedSubscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    if (!updatedSubscription) {
      return { allowed: false, reason: 'Subscription not found' };
    }

    // Check subscription status
    if (updatedSubscription.status === 'EXPIRED' || updatedSubscription.status === 'CANCELLED') {
      return { allowed: false, reason: 'Subscription expired or cancelled' };
    }

    // FREE tier - 3 bids per month
    if (updatedSubscription.plan === 'FREE') {
      if (updatedSubscription.bidsPlacedThisMonth >= 3) {
        return {
          allowed: false,
          reason: 'Free tier allows 3 bids per month',
          remaining: 0,
          limit: 3,
          upgradeTo: 'STARTER',
        };
      }
      return { allowed: true, remaining: 3 - updatedSubscription.bidsPlacedThisMonth, limit: 3 };
    }

    // Paid tiers - unlimited bids
    return { allowed: true };
  }

  async canAddVehicle(userId: string): Promise<UsageLimit> {
    const subscription = await this.getUserSubscription(userId);
    const features = this.getPlanFeatures(subscription.plan);

    const vehicleCount = await prisma.vehicle.count({
      where: { ownerId: userId, isActive: true },
    });

    if (vehicleCount >= features.maxVehicles) {
      const nextTier = subscription.plan === 'FREE' || subscription.plan === 'STARTER' 
        ? 'PROFESSIONAL' 
        : 'BUSINESS';
      
      return {
        allowed: false,
        reason: `Your plan allows ${features.maxVehicles} vehicle(s)`,
        remaining: 0,
        limit: features.maxVehicles,
        upgradeTo: nextTier,
      };
    }

    return { 
      allowed: true, 
      remaining: features.maxVehicles - vehicleCount,
      limit: features.maxVehicles,
    };
  }

  async canAddTeamMember(userId: string): Promise<UsageLimit> {
    const subscription = await this.getUserSubscription(userId);
    const features = this.getPlanFeatures(subscription.plan);

    if (subscription.plan !== 'BUSINESS') {
      return {
        allowed: false,
        reason: 'Team management is available on BUSINESS plan only',
        upgradeTo: 'BUSINESS',
      };
    }

    const teamCount = await prisma.teamMember.count({
      where: { businessOwnerId: userId, isActive: true },
    });

    if (teamCount >= features.maxTeamMembers) {
      return {
        allowed: false,
        reason: `BUSINESS plan allows up to ${features.maxTeamMembers} team members`,
        remaining: 0,
        limit: features.maxTeamMembers,
      };
    }

    return { 
      allowed: true,
      remaining: features.maxTeamMembers - teamCount,
      limit: features.maxTeamMembers,
    };
  }

  // ============================================
  // USAGE TRACKING
  // ============================================

  async recordLoadPosted(userId: string) {
    const subscription = await this.getUserSubscription(userId);
    await this.resetMonthlyUsageIfNeeded(subscription.id);

    await prisma.subscription.update({
      where: { userId },
      data: {
        loadsPostedThisMonth: { increment: 1 },
      },
    });
  }

  async recordBidPlaced(userId: string) {
    const subscription = await this.getUserSubscription(userId);
    await this.resetMonthlyUsageIfNeeded(subscription.id);

    await prisma.subscription.update({
      where: { userId },
      data: {
        bidsPlacedThisMonth: { increment: 1 },
      },
    });
  }

  async resetMonthlyUsageIfNeeded(subscriptionId: string) {
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
    });

    if (!subscription) return;

    const now = new Date();
    const lastResetDate = subscription.lastResetDate || subscription.startDate || now;

    // Check if it's a new month
    if (
      lastResetDate.getFullYear() !== now.getFullYear() ||
      lastResetDate.getMonth() !== now.getMonth()
    ) {
      await prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
          loadsPostedThisMonth: 0,
          bidsPlacedThisMonth: 0,
          lastResetDate: now,
        },
      });

      loggers.info('Monthly usage reset', { subscriptionId });
    }
  }

  // ============================================
  // ANALYTICS
  // ============================================

  async getSubscriptionStats(userId: string) {
    const subscription = await this.getUserSubscription(userId);

    const totalLoads = await prisma.load.count({
      where: { ownerId: userId },
    });

    const totalBids = await prisma.bid.count({
      where: { driverId: userId },
    });

    const completedTrips = await prisma.trip.count({
      where: { driverId: userId, status: 'COMPLETED' },
    });

    return {
      plan: subscription.plan,
      status: subscription.status,
      loadsPostedThisMonth: subscription.loadsPostedThisMonth,
      bidsPlacedThisMonth: subscription.bidsPlacedThisMonth,
      totalLoads,
      totalBids,
      completedTrips,
      trialEndsAt: subscription.trialEndDate,
      nextBillingDate: subscription.nextBillingDate,
      amount: subscription.amount,
    };
  }

  async getPlanPricing() {
    return {
      FREE: {
        price: 0,
        currency: 'USD',
        features: this.getPlanFeatures('FREE'),
      },
      STARTER: {
        price: config.subscription.prices.starter,
        currency: 'USD',
        features: this.getPlanFeatures('STARTER'),
      },
      PROFESSIONAL: {
        price: config.subscription.prices.professional,
        currency: 'USD',
        features: this.getPlanFeatures('PROFESSIONAL'),
      },
      BUSINESS: {
        price: config.subscription.prices.business,
        currency: 'USD',
        features: this.getPlanFeatures('BUSINESS'),
      },
    };
  }
}

export const subscriptionService = new SubscriptionService();