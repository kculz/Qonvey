// Complete Subscription Service - Sequelize Version (Fixed)
// Location: backend/src/services/subscription.service.ts

import { Op } from 'sequelize';
import { config } from '@/config/env';
import { loggers } from '@/utils/logger';
import type { FeatureAccess, UsageLimit } from '@/types/subscription.types';
import Subscription from '@/models/subscription.model';
import User from '@/models/user.model';
import Vehicle from '@/models/vehicle.model';
import TeamMember from '@/models/team-member.model';
import Load from '@/models/load.model';
import Bid from '@/models/bid.model';
import Trip from '@/models/trip.model';

// Enums (from your Prisma schema)
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

class SubscriptionService {
  // ============================================
  // SUBSCRIPTION MANAGEMENT
  // ============================================

  async getUserSubscription(userId: string) {
    const subscription = await Subscription.findOne({
      where: { user_id: userId },
      include: [{
        association: 'user',
        attributes: ['id', 'first_name', 'last_name', 'email', 'role'],
      }],
    });

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    // Check if trial has expired
    if (subscription.status === SubscriptionStatus.TRIAL && subscription.trial_end_date) {
      if (new Date() > subscription.trial_end_date) {
        await this.expireTrial(userId);
        // We need to fetch the updated subscription after expiration
        const updatedSubscription = await Subscription.findOne({
          where: { user_id: userId },
        });
        if (updatedSubscription) {
          updatedSubscription.status = SubscriptionStatus.EXPIRED;
          updatedSubscription.plan = PlanType.FREE;
          return updatedSubscription;
        }
      }
    }

    // Check if subscription has expired
    if (subscription.status === SubscriptionStatus.ACTIVE && subscription.end_date) {
      if (new Date() > subscription.end_date) {
        await this.expireSubscription(userId);
        // We need to fetch the updated subscription after expiration
        const updatedSubscription = await Subscription.findOne({
          where: { user_id: userId },
        });
        if (updatedSubscription) {
          updatedSubscription.status = SubscriptionStatus.EXPIRED;
          updatedSubscription.plan = PlanType.FREE;
          return updatedSubscription;
        }
      }
    }

    return subscription;
  }

  async createTrialSubscription(userId: string) {
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + config.subscription.trialDays);

    const subscription = await Subscription.create({
      user_id: userId,
      plan: PlanType.STARTER,
      status: SubscriptionStatus.TRIAL,
      trial_start_date: new Date(),
      trial_end_date: trialEndDate,
      has_used_trial: true,
      amount: 0,
    });

    loggers.subscription.created(userId, 'STARTER (TRIAL)');
    return subscription;
  }

  async upgradePlan(userId: string, newPlan: PlanType, paymentReference?: string) {
    const currentSubscription = await this.getUserSubscription(userId);

    const prices = {
      [PlanType.STARTER]: config.subscription.prices.starter,
      [PlanType.PROFESSIONAL]: config.subscription.prices.professional,
      [PlanType.BUSINESS]: config.subscription.prices.business,
      [PlanType.FREE]: 0,
    };

    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 1);

    await currentSubscription.update({
      plan: newPlan,
      status: SubscriptionStatus.ACTIVE,
      amount: prices[newPlan],
      start_date: startDate,
      end_date: endDate,
      next_billing_date: endDate,
      last_payment: new Date(),
      ...(paymentReference && { payment_method: 'ECOCASH' }),
    });

    loggers.subscription.upgraded(userId, currentSubscription.plan, newPlan);
    return currentSubscription;
  }

  async downgradePlan(userId: string, reason?: string) {
    const currentSubscription = await this.getUserSubscription(userId);

    await currentSubscription.update({
      plan: PlanType.FREE,
      status: SubscriptionStatus.ACTIVE,
      amount: 0,
      end_date: null,
      next_billing_date: null,
    });

    // loggers.subscription.downgraded(userId, currentSubscription.plan, PlanType.FREE, reason);
    return currentSubscription;
  }

  async cancelSubscription(userId: string, reason?: string) {
    const subscription = await this.getUserSubscription(userId);
    
    await subscription.update({
      status: SubscriptionStatus.CANCELLED,
      auto_renew: false,
    });

    loggers.subscription.cancelled(userId, subscription.plan, reason);
    return subscription;
  }

  async expireTrial(userId: string) {
    const subscription = await Subscription.findOne({
      where: { user_id: userId },
    });

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    await subscription.update({
      status: SubscriptionStatus.EXPIRED,
      plan: PlanType.FREE,
      amount: 0,
    });

    loggers.subscription.expired(userId, 'TRIAL');
    return subscription;
  }

  async expireSubscription(userId: string) {
    const currentSubscription = await this.getUserSubscription(userId);

    await currentSubscription.update({
      status: SubscriptionStatus.EXPIRED,
      plan: PlanType.FREE,
      amount: 0,
    });

    loggers.subscription.expired(userId, currentSubscription.plan);
    return currentSubscription;
  }

  async renewSubscription(userId: string, paymentReference: string) {
    const currentSubscription = await this.getUserSubscription(userId);

    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 1);

    await currentSubscription.update({
      status: SubscriptionStatus.ACTIVE,
      start_date: new Date(),
      end_date: endDate,
      next_billing_date: endDate,
      last_payment: new Date(),
    });

    loggers.subscription.paymentSuccess(userId, currentSubscription.amount, currentSubscription.plan);
    return currentSubscription;
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
      [PlanType.FREE]: {
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
      [PlanType.STARTER]: {
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
      [PlanType.PROFESSIONAL]: {
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
      [PlanType.BUSINESS]: {
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
    const updatedSubscription = await Subscription.findOne({
      where: { user_id: userId },
    });

    if (!updatedSubscription) {
      return { allowed: false, reason: 'Subscription not found' };
    }

    // Check subscription status
    if (updatedSubscription.status === SubscriptionStatus.EXPIRED || 
        updatedSubscription.status === SubscriptionStatus.CANCELLED) {
      return { allowed: false, reason: 'Subscription expired or cancelled' };
    }

    // FREE tier - 1 load per month
    if (updatedSubscription.plan === PlanType.FREE) {
      if (updatedSubscription.loads_posted_this_month >= 1) {
        return {
          allowed: false,
          reason: 'Free tier allows 1 load per month',
          remaining: 0,
          limit: 1,
          upgradeTo: PlanType.STARTER,
        };
      }
      return { 
        allowed: true, 
        remaining: 1 - updatedSubscription.loads_posted_this_month, 
        limit: 1 
      };
    }

    // Paid tiers - unlimited loads
    return { allowed: true };
  }

  async canPlaceBid(userId: string): Promise<UsageLimit> {
    const subscription = await this.getUserSubscription(userId);

    // Reset monthly usage if needed
    await this.resetMonthlyUsageIfNeeded(subscription.id);

    // Get updated subscription
    const updatedSubscription = await Subscription.findOne({
      where: { user_id: userId },
    });

    if (!updatedSubscription) {
      return { allowed: false, reason: 'Subscription not found' };
    }

    // Check subscription status
    if (updatedSubscription.status === SubscriptionStatus.EXPIRED || 
        updatedSubscription.status === SubscriptionStatus.CANCELLED) {
      return { allowed: false, reason: 'Subscription expired or cancelled' };
    }

    // FREE tier - 3 bids per month
    if (updatedSubscription.plan === PlanType.FREE) {
      if (updatedSubscription.bids_placed_this_month >= 3) {
        return {
          allowed: false,
          reason: 'Free tier allows 3 bids per month',
          remaining: 0,
          limit: 3,
          upgradeTo: PlanType.STARTER,
        };
      }
      return { 
        allowed: true, 
        remaining: 3 - updatedSubscription.bids_placed_this_month, 
        limit: 3 
      };
    }

    // Paid tiers - unlimited bids
    return { allowed: true };
  }

  async canAddVehicle(userId: string): Promise<UsageLimit> {
    const subscription = await this.getUserSubscription(userId);
    const features = this.getPlanFeatures(subscription.plan);

    const vehicleCount = await Vehicle.count({
      where: { owner_id: userId, is_active: true },
    });

    if (vehicleCount >= features.maxVehicles) {
      const nextTier = subscription.plan === PlanType.FREE || subscription.plan === PlanType.STARTER 
        ? PlanType.PROFESSIONAL 
        : PlanType.BUSINESS;
      
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

    if (subscription.plan !== PlanType.BUSINESS) {
      return {
        allowed: false,
        reason: 'Team management is available on BUSINESS plan only',
        upgradeTo: PlanType.BUSINESS,
      };
    }

    const teamCount = await TeamMember.count({
      where: { business_owner_id: userId, is_active: true },
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

    await subscription.increment('loads_posted_this_month');
  }

  async recordBidPlaced(userId: string) {
    const subscription = await this.getUserSubscription(userId);
    await this.resetMonthlyUsageIfNeeded(subscription.id);

    await subscription.increment('bids_placed_this_month');
  }

  async resetMonthlyUsageIfNeeded(subscriptionId: string) {
    const subscription = await Subscription.findByPk(subscriptionId);

    if (!subscription) return;

    const now = new Date();
    const lastResetDate = subscription.last_reset_date || subscription.start_date || now;

    // Check if it's a new month
    if (
      lastResetDate.getFullYear() !== now.getFullYear() ||
      lastResetDate.getMonth() !== now.getMonth()
    ) {
      await subscription.update({
        loads_posted_this_month: 0,
        bids_placed_this_month: 0,
        last_reset_date: now,
      });

      loggers.info('Monthly usage reset', { subscriptionId });
    }
  }

  // ============================================
  // ANALYTICS
  // ============================================

  async getSubscriptionStats(userId: string) {
    const subscription = await this.getUserSubscription(userId);

    const [totalLoads, totalBids, completedTrips] = await Promise.all([
      Load.count({
        where: { owner_id: userId },
      }),
      Bid.count({
        where: { driver_id: userId },
      }),
      Trip.count({
        where: { driver_id: userId, status: 'COMPLETED' },
      }),
    ]);

    return {
      plan: subscription.plan,
      status: subscription.status,
      loadsPostedThisMonth: subscription.loads_posted_this_month,
      bidsPlacedThisMonth: subscription.bids_placed_this_month,
      totalLoads,
      totalBids,
      completedTrips,
      trialEndsAt: subscription.trial_end_date,
      nextBillingDate: subscription.next_billing_date,
      amount: subscription.amount,
    };
  }

  async getPlanPricing() {
    return {
      [PlanType.FREE]: {
        price: 0,
        currency: 'USD',
        features: this.getPlanFeatures(PlanType.FREE),
      },
      [PlanType.STARTER]: {
        price: config.subscription.prices.starter,
        currency: 'USD',
        features: this.getPlanFeatures(PlanType.STARTER),
      },
      [PlanType.PROFESSIONAL]: {
        price: config.subscription.prices.professional,
        currency: 'USD',
        features: this.getPlanFeatures(PlanType.PROFESSIONAL),
      },
      [PlanType.BUSINESS]: {
        price: config.subscription.prices.business,
        currency: 'USD',
        features: this.getPlanFeatures(PlanType.BUSINESS),
      },
    };
  }

  // ============================================
  // NEW SEQUELIZE-SPECIFIC METHODS
  // ============================================

  async createOrUpdateSubscription(userId: string, data: {
    plan?: PlanType;
    status?: SubscriptionStatus;
    amount?: number;
    startDate?: Date;
    endDate?: Date;
    trialStartDate?: Date;
    trialEndDate?: Date;
    autoRenew?: boolean;
  }) {
    const existingSubscription = await Subscription.findOne({
      where: { user_id: userId },
    });

    if (existingSubscription) {
      const updateData: any = {};
      if (data.plan) updateData.plan = data.plan;
      if (data.status) updateData.status = data.status;
      if (data.amount !== undefined) updateData.amount = data.amount;
      if (data.startDate) updateData.start_date = data.startDate;
      if (data.endDate) updateData.end_date = data.endDate;
      if (data.trialStartDate) updateData.trial_start_date = data.trialStartDate;
      if (data.trialEndDate) updateData.trial_end_date = data.trialEndDate;
      if (data.autoRenew !== undefined) updateData.auto_renew = data.autoRenew;

      await existingSubscription.update(updateData);
      return existingSubscription;
    } else {
      return await Subscription.create({
        user_id: userId,
        plan: data.plan || PlanType.FREE,
        status: data.status || SubscriptionStatus.ACTIVE,
        amount: data.amount || 0,
        start_date: data.startDate,
        end_date: data.endDate,
        trial_start_date: data.trialStartDate,
        trial_end_date: data.trialEndDate,
        auto_renew: data.autoRenew !== undefined ? data.autoRenew : true,
      });
    }
  }

  async getActiveSubscriptionsCount(plan?: PlanType) {
    const whereClause: any = { status: SubscriptionStatus.ACTIVE };
    if (plan) {
      whereClause.plan = plan;
    }

    return await Subscription.count({ where: whereClause });
  }

  async getTrialSubscriptionsAboutToExpire(days = 3) {
    const today = new Date();
    const thresholdDate = new Date(today);
    thresholdDate.setDate(thresholdDate.getDate() + days);

    return await Subscription.findAll({
      where: {
        status: SubscriptionStatus.TRIAL,
        trial_end_date: {
          [Op.between]: [today, thresholdDate],
        },
      },
      include: [{
        association: 'user',
        attributes: ['id', 'first_name', 'last_name', 'email'],
      }],
      order: [['trial_end_date', 'ASC']],
    });
  }

  async getExpiringSubscriptions(days = 7) {
    const today = new Date();
    const thresholdDate = new Date(today);
    thresholdDate.setDate(thresholdDate.getDate() + days);

    return await Subscription.findAll({
      where: {
        status: SubscriptionStatus.ACTIVE,
        end_date: {
          [Op.between]: [today, thresholdDate],
        },
      },
      include: [{
        association: 'user',
        attributes: ['id', 'first_name', 'last_name', 'email'],
      }],
      order: [['end_date', 'ASC']],
    });
  }

  async getSubscriptionUsageAnalytics(userId: string) {
    const subscription = await this.getUserSubscription(userId);
    const features = this.getPlanFeatures(subscription.plan);

    const [vehicleCount, teamMemberCount] = await Promise.all([
      Vehicle.count({
        where: { owner_id: userId, is_active: true },
      }),
      TeamMember.count({
        where: { business_owner_id: userId, is_active: true },
      }),
    ]);

    const loadsPostedThisMonth = subscription.loads_posted_this_month;
    const bidsPlacedThisMonth = subscription.bids_placed_this_month;

    // Calculate usage percentages
    const vehicleUsage = features.maxVehicles === Infinity ? 0 : 
      Math.min(100, (vehicleCount / features.maxVehicles) * 100);
    
    const teamUsage = features.maxTeamMembers === 0 ? 0 :
      Math.min(100, (teamMemberCount / features.maxTeamMembers) * 100);

    return {
      subscription: {
        plan: subscription.plan,
        status: subscription.status,
        startDate: subscription.start_date,
        endDate: subscription.end_date,
      },
      usage: {
        vehicles: {
          count: vehicleCount,
          limit: features.maxVehicles,
          usagePercent: vehicleUsage,
          remaining: features.maxVehicles === Infinity ? Infinity : features.maxVehicles - vehicleCount,
        },
        teamMembers: {
          count: teamMemberCount,
          limit: features.maxTeamMembers,
          usagePercent: teamUsage,
          remaining: features.maxTeamMembers - teamMemberCount,
        },
        monthly: {
          loads: {
            count: loadsPostedThisMonth,
            unlimited: subscription.plan !== PlanType.FREE,
          },
          bids: {
            count: bidsPlacedThisMonth,
            unlimited: subscription.plan !== PlanType.FREE,
          },
        },
      },
      features: features,
    };
  }

  async bulkUpdateSubscriptions(userIds: string[], updateData: {
    plan?: PlanType;
    status?: SubscriptionStatus;
    amount?: number;
    autoRenew?: boolean;
  }) {
    const updateClause: any = {};
    if (updateData.plan) updateClause.plan = updateData.plan;
    if (updateData.status) updateClause.status = updateData.status;
    if (updateData.amount !== undefined) updateClause.amount = updateData.amount;
    if (updateData.autoRenew !== undefined) updateClause.auto_renew = updateData.autoRenew;

    const [affectedRows] = await Subscription.update(updateClause, {
      where: { user_id: { [Op.in]: userIds } },
    });

    loggers.info('Bulk subscription update', {
      userIds,
      updateData,
      affectedRows,
    });

    return { success: true, affectedRows };
  }

  async checkTrialEligibility(userId: string): Promise<{ eligible: boolean; reason?: string }> {
    const user = await User.findByPk(userId);
    if (!user) {
      return { eligible: false, reason: 'User not found' };
    }

    const existingSubscription = await Subscription.findOne({
      where: { user_id: userId },
    });

    if (existingSubscription) {
      if (existingSubscription.has_used_trial) {
        return { eligible: false, reason: 'User has already used their trial' };
      }
      if (existingSubscription.plan !== PlanType.FREE) {
        return { eligible: false, reason: 'User already has a paid plan' };
      }
    }

    // Check if user account is older than 30 days (prevent trial abuse)
    const accountAge = new Date().getTime() - new Date(user.createdAt).getTime();
    const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
    if (accountAge > thirtyDaysInMs) {
      return { eligible: false, reason: 'Account is too old for trial' };
    }

    return { eligible: true };
  }
}

export const subscriptionService = new SubscriptionService();