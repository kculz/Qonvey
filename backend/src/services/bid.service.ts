// Bid Management Service
// Location: backend/src/services/bid.service.ts

import prisma from '@/config/database';
import { loggers } from '@/utils/logger';
import { subscriptionService } from '@/services/subscription.service';
import { notificationService } from '@/services/notification.service';
import { BidStatus, Prisma } from '@prisma/client';
import type { CreateBidData } from '@/types/bid.types';

class BidService {
  // ============================================
  // CREATE & UPDATE
  // ============================================

  async createBid(driverId: string, data: CreateBidData) {
    // Check if user can place bid
    const canBid = await subscriptionService.canPlaceBid(driverId);
    if (!canBid.allowed) {
      throw new Error(canBid.reason || 'Cannot place bid');
    }

    // Verify load exists and is open
    const load = await prisma.load.findUnique({
      where: { id: data.loadId },
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phoneNumber: true,
          },
        },
      },
    });

    if (!load) {
      throw new Error('Load not found');
    }

    if (load.status !== 'OPEN') {
      throw new Error('Load is no longer accepting bids');
    }

    if (load.ownerId === driverId) {
      throw new Error('Cannot bid on your own load');
    }

    // Check if driver already has a pending bid on this load
    const existingBid = await prisma.bid.findFirst({
      where: {
        loadId: data.loadId,
        driverId,
        status: 'PENDING',
      },
    });

    if (existingBid) {
      throw new Error('You already have a pending bid on this load');
    }

    // Verify vehicle if provided
    if (data.vehicleId) {
      const vehicle = await prisma.vehicle.findUnique({
        where: { id: data.vehicleId },
      });

      if (!vehicle || vehicle.ownerId !== driverId || !vehicle.isActive) {
        throw new Error('Invalid vehicle');
      }

      // Check if vehicle type matches load requirements
      if (!load.vehicleTypes.includes(vehicle.type)) {
        throw new Error('Vehicle type does not match load requirements');
      }
    }

    // Create bid
    const bid = await prisma.bid.create({
      data: {
        loadId: data.loadId,
        driverId,
        proposedPrice: data.proposedPrice,
        currency: data.currency || 'USD',
        message: data.message,
        estimatedDuration: data.estimatedDuration,
        vehicleId: data.vehicleId,
        expiresAt: data.expiresAt,
        status: 'PENDING',
      },
      include: {
        driver: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            rating: true,
            totalRatings: true,
            phoneVerified: true,
          },
        },
        vehicle: true,
      },
    });

    // Record bid placed
    await subscriptionService.recordBidPlaced(driverId);

    loggers.bid.placed(bid.id, data.loadId, driverId, data.proposedPrice);

    // Notify load owner
    await notificationService.notifyNewBid(
      load.ownerId,
      load.title,
      data.proposedPrice,
      `${bid.driver.firstName} ${bid.driver.lastName}`
    );

    return bid;
  }

  async updateBid(bidId: string, driverId: string, data: Partial<CreateBidData>) {
    const existingBid = await prisma.bid.findUnique({
      where: { id: bidId },
      include: { load: true },
    });

    if (!existingBid) {
      throw new Error('Bid not found');
    }

    if (existingBid.driverId !== driverId) {
      throw new Error('Unauthorized to update this bid');
    }

    if (existingBid.status !== 'PENDING') {
      throw new Error('Cannot update bid in current status');
    }

    if (existingBid.load.status !== 'OPEN') {
      throw new Error('Load is no longer accepting bid updates');
    }

    const bid = await prisma.bid.update({
      where: { id: bidId },
      data: {
        ...(data.proposedPrice && { proposedPrice: data.proposedPrice }),
        ...(data.message && { message: data.message }),
        ...(data.estimatedDuration && { estimatedDuration: data.estimatedDuration }),
        ...(data.vehicleId && { vehicleId: data.vehicleId }),
        ...(data.expiresAt && { expiresAt: data.expiresAt }),
      },
      include: {
        driver: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            rating: true,
          },
        },
        vehicle: true,
      },
    });

    loggers.info('Bid updated', { bidId, driverId });
    return bid;
  }

  async withdrawBid(bidId: string, driverId: string) {
    const bid = await prisma.bid.findUnique({
      where: { id: bidId },
    });

    if (!bid) {
      throw new Error('Bid not found');
    }

    if (bid.driverId !== driverId) {
      throw new Error('Unauthorized');
    }

    if (bid.status !== 'PENDING') {
      throw new Error('Cannot withdraw bid in current status');
    }

    const withdrawnBid = await prisma.bid.update({
      where: { id: bidId },
      data: { status: 'WITHDRAWN' },
    });

    loggers.info('Bid withdrawn', { bidId, driverId });
    return withdrawnBid;
  }

  // ============================================
  // ACCEPT & REJECT (Cargo Owner)
  // ============================================

  async acceptBid(bidId: string, loadOwnerId: string) {
    const bid = await prisma.bid.findUnique({
      where: { id: bidId },
      include: {
        load: {
          include: {
            owner: true,
          },
        },
        driver: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phoneNumber: true,
            email: true,
          },
        },
      },
    });

    if (!bid) {
      throw new Error('Bid not found');
    }

    if (bid.load.ownerId !== loadOwnerId) {
      throw new Error('Unauthorized');
    }

    if (bid.status !== 'PENDING') {
      throw new Error('Bid is no longer pending');
    }

    if (bid.load.status !== 'OPEN') {
      throw new Error('Load is not open for accepting bids');
    }

    // Use transaction to ensure consistency
    const result = await prisma.$transaction(async (tx) => {
      // Accept the bid
      const acceptedBid = await tx.bid.update({
        where: { id: bidId },
        data: { status: 'ACCEPTED' },
      });

      // Reject all other pending bids on this load
      await tx.bid.updateMany({
        where: {
          loadId: bid.loadId,
          id: { not: bidId },
          status: 'PENDING',
        },
        data: { status: 'REJECTED' },
      });

      // Update load status to ASSIGNED
      await tx.load.update({
        where: { id: bid.loadId },
        data: { status: 'ASSIGNED' },
      });

      // Create trip
      const trip = await tx.trip.create({
        data: {
          loadId: bid.loadId,
          bidId: bid.id,
          driverId: bid.driverId,
          agreedPrice: bid.proposedPrice,
          currency: bid.currency,
          status: 'SCHEDULED',
        },
      });

      return { acceptedBid, trip };
    });

    loggers.bid.accepted(bidId, bid.loadId, bid.driverId);

    // Notify driver
    await notificationService.notifyBidAccepted(bid.driverId, bid.load.title);

    return result;
  }

  async rejectBid(bidId: string, loadOwnerId: string, reason?: string) {
    const bid = await prisma.bid.findUnique({
      where: { id: bidId },
      include: {
        load: true,
      },
    });

    if (!bid) {
      throw new Error('Bid not found');
    }

    if (bid.load.ownerId !== loadOwnerId) {
      throw new Error('Unauthorized');
    }

    if (bid.status !== 'PENDING') {
      throw new Error('Bid is not pending');
    }

    const rejectedBid = await prisma.bid.update({
      where: { id: bidId },
      data: { status: 'REJECTED' },
    });

    loggers.bid.rejected(bidId, bid.loadId, reason);
    return rejectedBid;
  }

  // ============================================
  // RETRIEVE
  // ============================================

  async getBid(bidId: string) {
    const bid = await prisma.bid.findUnique({
      where: { id: bidId },
      include: {
        load: {
          include: {
            owner: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                companyName: true,
                rating: true,
              },
            },
          },
        },
        driver: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            companyName: true,
            rating: true,
            totalRatings: true,
            phoneVerified: true,
            emailVerified: true,
          },
        },
        vehicle: true,
        trip: true,
      },
    });

    if (!bid) {
      throw new Error('Bid not found');
    }

    return bid;
  }

  async getLoadBids(loadId: string, loadOwnerId?: string) {
    // Verify load exists
    const load = await prisma.load.findUnique({
      where: { id: loadId },
    });

    if (!load) {
      throw new Error('Load not found');
    }

    // Only load owner can see all bids
    if (loadOwnerId && load.ownerId !== loadOwnerId) {
      throw new Error('Unauthorized to view bids');
    }

    return await prisma.bid.findMany({
      where: {
        loadId,
        status: 'PENDING',
      },
      include: {
        driver: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            rating: true,
            totalRatings: true,
            phoneVerified: true,
          },
        },
        vehicle: true,
      },
      orderBy: [
        { proposedPrice: 'asc' },
        { createdAt: 'asc' },
      ],
    });
  }

  async getUserBids(driverId: string, status?: BidStatus) {
    return await prisma.bid.findMany({
      where: {
        driverId,
        ...(status && { status }),
      },
      include: {
        load: {
          include: {
            owner: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                companyName: true,
                rating: true,
              },
            },
          },
        },
        vehicle: true,
        trip: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getUserReceivedBids(ownerId: string) {
    return await prisma.bid.findMany({
      where: {
        load: {
          ownerId,
        },
        status: 'PENDING',
      },
      include: {
        load: {
          select: {
            id: true,
            title: true,
            pickupLocation: true,
            deliveryLocation: true,
            pickupDate: true,
          },
        },
        driver: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            rating: true,
            totalRatings: true,
            phoneVerified: true,
          },
        },
        vehicle: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ============================================
  // ANALYTICS
  // ============================================

  async getBidStats(driverId: string) {
    const [total, pending, accepted, rejected, withdrawn] = await Promise.all([
      prisma.bid.count({ where: { driverId } }),
      prisma.bid.count({ where: { driverId, status: 'PENDING' } }),
      prisma.bid.count({ where: { driverId, status: 'ACCEPTED' } }),
      prisma.bid.count({ where: { driverId, status: 'REJECTED' } }),
      prisma.bid.count({ where: { driverId, status: 'WITHDRAWN' } }),
    ]);

    const acceptanceRate = total > 0 ? (accepted / total) * 100 : 0;

    // Get average bid amount
    const avgBid = await prisma.bid.aggregate({
      where: { driverId, status: { in: ['PENDING', 'ACCEPTED'] } },
      _avg: { proposedPrice: true },
    });

    return {
      total,
      pending,
      accepted,
      rejected,
      withdrawn,
      acceptanceRate: Math.round(acceptanceRate),
      averageBidAmount: avgBid._avg.proposedPrice || 0,
    };
  }

  async getLoadBidStats(loadId: string) {
    const [total, lowest, highest, average] = await Promise.all([
      prisma.bid.count({ where: { loadId, status: 'PENDING' } }),
      prisma.bid.findFirst({
        where: { loadId, status: 'PENDING' },
        orderBy: { proposedPrice: 'asc' },
        select: { proposedPrice: true },
      }),
      prisma.bid.findFirst({
        where: { loadId, status: 'PENDING' },
        orderBy: { proposedPrice: 'desc' },
        select: { proposedPrice: true },
      }),
      prisma.bid.aggregate({
        where: { loadId, status: 'PENDING' },
        _avg: { proposedPrice: true },
      }),
    ]);

    return {
      totalBids: total,
      lowestBid: lowest?.proposedPrice || 0,
      highestBid: highest?.proposedPrice || 0,
      averageBid: average._avg.proposedPrice || 0,
    };
  }

  // ============================================
  // HELPERS
  // ============================================

  async expireBids() {
    const expiredBids = await prisma.bid.updateMany({
      where: {
        status: 'PENDING',
        expiresAt: {
          lte: new Date(),
        },
      },
      data: { status: 'REJECTED' },
    });

    if (expiredBids.count > 0) {
      loggers.info(`Expired ${expiredBids.count} bids`);
    }

    return expiredBids;
  }

  async getBidHistory(driverId: string, limit = 10) {
    return await prisma.bid.findMany({
      where: {
        driverId,
        status: { in: ['ACCEPTED', 'REJECTED'] },
      },
      include: {
        load: {
          select: {
            id: true,
            title: true,
            pickupLocation: true,
            deliveryLocation: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });
  }

  async canBidOnLoad(driverId: string, loadId: string): Promise<{ allowed: boolean; reason?: string }> {
    // Check subscription limit
    const canBid = await subscriptionService.canPlaceBid(driverId);
    if (!canBid.allowed) {
      return canBid;
    }

    // Check if load exists and is open
    const load = await prisma.load.findUnique({
      where: { id: loadId },
    });

    if (!load) {
      return { allowed: false, reason: 'Load not found' };
    }

    if (load.status !== 'OPEN') {
      return { allowed: false, reason: 'Load is not accepting bids' };
    }

    if (load.ownerId === driverId) {
      return { allowed: false, reason: 'Cannot bid on your own load' };
    }

    // Check existing bid
    const existingBid = await prisma.bid.findFirst({
      where: {
        loadId,
        driverId,
        status: 'PENDING',
      },
    });

    if (existingBid) {
      return { allowed: false, reason: 'You already have a pending bid on this load' };
    }

    return { allowed: true };
  }
}

export const bidService = new BidService();