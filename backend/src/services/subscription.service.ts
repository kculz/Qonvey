import prisma from '../config/database';

class SubscriptionService {
  async canPostLoad(userId: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { subscription: true },
    });

    if (!user || !user.subscription) {
      return false;
    }

    const subscription = user.subscription;

    // Check if subscription is active (or trial)
    if (subscription.status === 'EXPIRED' || subscription.status === 'CANCELLED') {
      return false;
    }

    // If the user is on FREE plan, check usage
    if (subscription.plan === 'FREE') {
      // Check if it's a new month, then reset usage
      await this.resetMonthlyUsageIfNeeded(subscription);

      // Check if they have posted a load this month
      if (subscription.loadsPostedThisMonth >= 1) {
        return false;
      }
    }

    // For STARTER and above, unlimited loads
    return true;
  }

  async recordLoadPosted(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { subscription: true },
    });

    if (!user || !user.subscription) {
      throw new Error('User or subscription not found');
    }

    const subscription = user.subscription;

    // Reset monthly usage if needed
    await this.resetMonthlyUsageIfNeeded(subscription);

    // Increment the loads posted this month
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        loadsPostedThisMonth: { increment: 1 },
      },
    });
  }

  async resetMonthlyUsageIfNeeded(subscription: any) {
    const now = new Date();
    const lastResetDate = subscription.lastResetDate || subscription.startDate || now;

    // Check if it's a new month (comparing year and month)
    if (
      lastResetDate.getFullYear() !== now.getFullYear() ||
      lastResetDate.getMonth() !== now.getMonth()
    ) {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          loadsPostedThisMonth: 0,
          bidsPlacedThisMonth: 0,
          lastResetDate: now,
        },
      });
    }
  }
}

export const subscriptionService = new SubscriptionService();