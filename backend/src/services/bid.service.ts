// backend/src/services/bid.service.ts

import { Op } from 'sequelize';
import { loggers } from '../utils/logger';
import { subscriptionService } from './subscription.service';
import { notificationService } from './notification.service';
import { sequelize } from '../models';
import type { CreateBidData } from '../types/bid.types';
import Load from '@/models/load.model';
import Bid from '@/models/bid.model';
import Vehicle from '@/models/vehicle.model';
import Trip from '@/models/trip.model';

export enum BidStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  WITHDRAWN = 'WITHDRAWN',
}

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
    const load = await Load.findOne({
      where: { id: data.loadId },
      include: [{
        association: 'owner',
        attributes: ['id', 'first_name', 'last_name', 'email', 'phone_number'],
      }],
    });

    if (!load) {
      throw new Error('Load not found');
    }

    if (load.status !== 'OPEN') {
      throw new Error('Load is no longer accepting bids');
    }

    if (load.owner_id === driverId) {
      throw new Error('Cannot bid on your own load');
    }

    // Check if driver already has a pending bid on this load
    const existingBid = await Bid.findOne({
      where: {
        load_id: data.loadId,
        driver_id: driverId,
        status: 'PENDING',
      },
    });

    if (existingBid) {
      throw new Error('You already have a pending bid on this load');
    }

    // Verify vehicle if provided
    if (data.vehicleId) {
      const vehicle = await Vehicle.findOne({
        where: { id: data.vehicleId },
      });

      if (!vehicle || vehicle.owner_id !== driverId || !vehicle.is_active) {
        throw new Error('Invalid vehicle');
      }

      // Check if vehicle type matches load requirements
      if (!load.vehicle_types.includes(vehicle.type)) {
        throw new Error('Vehicle type does not match load requirements');
      }
    }

    // Create bid
    const bid = await Bid.create({
      load_id: data.loadId,
      driver_id: driverId,
      proposed_price: data.proposedPrice,
      currency: data.currency || 'USD',
      message: data.message,
      estimated_duration: data.estimatedDuration,
      vehicle_id: data.vehicleId,
      expires_at: data.expiresAt,
      status: 'PENDING',
    } as any);

    // Fetch bid with relationships
    const bidWithRelations = await Bid.findByPk(bid.id, {
      include: [
        {
          association: 'driver',
          attributes: ['id', 'first_name', 'last_name', 'rating', 'total_ratings', 'phone_verified'],
        },
        {
          association: 'vehicle',
        },
      ],
    });

    if (!bidWithRelations) {
      throw new Error('Failed to create bid');
    }

    // Record bid placed
    await subscriptionService.recordBidPlaced(driverId);

    loggers.bid.placed(bid.id, data.loadId, driverId, data.proposedPrice);

    // Notify load owner
    await notificationService.notifyNewBid(
      load.owner_id,
      load.title,
      data.proposedPrice,
      `${bidWithRelations.driver.first_name} ${bidWithRelations.driver.last_name}`
    );

    return bidWithRelations;
  }

  async updateBid(bidId: string, driverId: string, data: Partial<CreateBidData>) {
    const existingBid = await Bid.findOne({
      where: { id: bidId },
      include: [{
        association: 'load',
      }],
    });

    if (!existingBid) {
      throw new Error('Bid not found');
    }

    if (existingBid.driver_id !== driverId) {
      throw new Error('Unauthorized to update this bid');
    }

    if (existingBid.status !== 'PENDING') {
      throw new Error('Cannot update bid in current status');
    }

    if (existingBid.load.status !== 'OPEN') {
      throw new Error('Load is no longer accepting bid updates');
    }

    const updateData: any = {};
    if (data.proposedPrice !== undefined) updateData.proposed_price = data.proposedPrice;
    if (data.message !== undefined) updateData.message = data.message;
    if (data.estimatedDuration !== undefined) updateData.estimated_duration = data.estimatedDuration;
    if (data.vehicleId !== undefined) updateData.vehicle_id = data.vehicleId;
    if (data.expiresAt !== undefined) updateData.expires_at = data.expiresAt;

    await existingBid.update(updateData);

    // Fetch updated bid with relationships
    const updatedBid = await Bid.findByPk(bidId, {
      include: [
        {
          association: 'driver',
          attributes: ['id', 'first_name', 'last_name', 'rating'],
        },
        {
          association: 'vehicle',
        },
      ],
    });

    if (!updatedBid) {
      throw new Error('Bid not found after update');
    }

    loggers.info('Bid updated', { bidId, driverId });
    return updatedBid;
  }

  async withdrawBid(bidId: string, driverId: string) {
    const bid = await Bid.findByPk(bidId);

    if (!bid) {
      throw new Error('Bid not found');
    }

    if (bid.driver_id !== driverId) {
      throw new Error('Unauthorized');
    }

    if (bid.status !== 'PENDING') {
      throw new Error('Cannot withdraw bid in current status');
    }

    await bid.update({ status: 'WITHDRAWN' });
    loggers.info('Bid withdrawn', { bidId, driverId });
    return bid;
  }

  // ============================================
  // ACCEPT & REJECT (Cargo Owner)
  // ============================================

  async acceptBid(bidId: string, loadOwnerId: string) {
    const bid = await Bid.findOne({
      where: { id: bidId },
      include: [
        {
          association: 'load',
          include: [{
            association: 'owner',
          }],
        },
        {
          association: 'driver',
          attributes: ['id', 'first_name', 'last_name', 'phone_number', 'email'],
        },
      ],
    });

    if (!bid) {
      throw new Error('Bid not found');
    }

    if (bid.load.owner_id !== loadOwnerId) {
      throw new Error('Unauthorized');
    }

    if (bid.status !== 'PENDING') {
      throw new Error('Bid is no longer pending');
    }

    if (bid.load.status !== 'OPEN') {
      throw new Error('Load is not open for accepting bids');
    }

    // Use transaction to ensure consistency
    const transaction = await sequelize.transaction();

    try {
      // Accept the bid
      await bid.update({ status: 'ACCEPTED' }, { transaction });

      // Reject all other pending bids on this load
      await Bid.update(
        { status: 'REJECTED' },
        {
          where: {
            load_id: bid.load_id,
            id: { [Op.ne]: bidId },
            status: 'PENDING',
          },
          transaction,
        }
      );

      // Update load status to ASSIGNED
      await Load.update(
        { status: 'ASSIGNED' },
        {
          where: { id: bid.load_id },
          transaction,
        }
      );

      // Create trip
      const trip = await Trip.create({
        load_id: bid.load_id,
        bid_id: bid.id,
        driver_id: bid.driver_id,
        agreed_price: bid.proposed_price,
        currency: bid.currency,
        status: 'SCHEDULED',
      } as any, { transaction });

      await transaction.commit();

      loggers.bid.accepted(bidId, bid.load_id, bid.driver_id);

      // Notify driver
      await notificationService.notifyBidAccepted(bid.driver_id, bid.load.title);

      return { acceptedBid: bid, trip };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async rejectBid(bidId: string, loadOwnerId: string, reason?: string) {
    const bid = await Bid.findOne({
      where: { id: bidId },
      include: [{
        association: 'load',
      }],
    });

    if (!bid) {
      throw new Error('Bid not found');
    }

    if (bid.load.owner_id !== loadOwnerId) {
      throw new Error('Unauthorized');
    }

    if (bid.status !== 'PENDING') {
      throw new Error('Bid is not pending');
    }

    await bid.update({ status: 'REJECTED' });
    loggers.bid.rejected(bidId, bid.load_id, reason);
    return bid;
  }

  // ============================================
  // RETRIEVE
  // ============================================

  async getBid(bidId: string) {
    const bid = await Bid.findByPk(bidId, {
      include: [
        {
          association: 'load',
          include: [{
            association: 'owner',
            attributes: ['id', 'first_name', 'last_name', 'company_name', 'rating'],
          }],
        },
        {
          association: 'driver',
          attributes: ['id', 'first_name', 'last_name', 'company_name', 'rating', 'total_ratings', 'phone_verified', 'email_verified'],
        },
        {
          association: 'vehicle',
        },
        {
          association: 'trip',
        },
      ],
    });

    if (!bid) {
      throw new Error('Bid not found');
    }

    return bid;
  }

  async getLoadBids(loadId: string, loadOwnerId?: string) {
    // Verify load exists
    const load = await Load.findByPk(loadId);

    if (!load) {
      throw new Error('Load not found');
    }

    // Only load owner can see all bids
    if (loadOwnerId && load.owner_id !== loadOwnerId) {
      throw new Error('Unauthorized to view bids');
    }

    return await Bid.findAll({
      where: {
        load_id: loadId,
        status: 'PENDING',
      },
      include: [
        {
          association: 'driver',
          attributes: ['id', 'first_name', 'last_name', 'rating', 'total_ratings', 'phone_verified'],
        },
        {
          association: 'vehicle',
        },
      ],
      order: [
        ['proposed_price', 'ASC'],
        ['created_at', 'ASC'],
      ],
    });
  }

  async getUserBids(driverId: string, status?: BidStatus) {
    const whereClause: any = { driver_id: driverId };
    if (status) {
      whereClause.status = status;
    }

    return await Bid.findAll({
      where: whereClause,
      include: [
        {
          association: 'load',
          include: [{
            association: 'owner',
            attributes: ['id', 'first_name', 'last_name', 'company_name', 'rating'],
          }],
        },
        {
          association: 'vehicle',
        },
        {
          association: 'trip',
        },
      ],
      order: [['created_at', 'DESC']],
    });
  }

  async getUserReceivedBids(ownerId: string) {
    return await Bid.findAll({
      where: {
        '$load.owner_id$': ownerId,
        status: 'PENDING',
      },
      include: [
        {
          association: 'load',
          attributes: ['id', 'title', 'pickup_location', 'delivery_location', 'pickup_date'],
        },
        {
          association: 'driver',
          attributes: ['id', 'first_name', 'last_name', 'rating', 'total_ratings', 'phone_verified'],
        },
        {
          association: 'vehicle',
        },
      ],
      order: [['created_at', 'DESC']],
    });
  }

  // ============================================
  // ANALYTICS
  // ============================================

  async getBidStats(driverId: string) {
    const [
      total,
      pending,
      accepted,
      rejected,
      withdrawn
    ] = await Promise.all([
      Bid.count({ where: { driver_id: driverId } }),
      Bid.count({ where: { driver_id: driverId, status: 'PENDING' } }),
      Bid.count({ where: { driver_id: driverId, status: 'ACCEPTED' } }),
      Bid.count({ where: { driver_id: driverId, status: 'REJECTED' } }),
      Bid.count({ where: { driver_id: driverId, status: 'WITHDRAWN' } }),
    ]);

    const acceptanceRate = total > 0 ? (accepted / total) * 100 : 0;

    // Get average bid amount
    const avgBid = await Bid.findOne({
      attributes: [
        [sequelize.fn('AVG', sequelize.col('proposed_price')), 'average'],
      ],
      where: { 
        driver_id: driverId, 
        status: { [Op.in]: ['PENDING', 'ACCEPTED'] } 
      },
      raw: true,
    }) as { average: number | null } | null;

    return {
      total,
      pending,
      accepted,
      rejected,
      withdrawn,
      acceptanceRate: Math.round(acceptanceRate),
      averageBidAmount: avgBid?.average || 0,
    };
  }

  async getLoadBidStats(loadId: string) {
    const [total, bids] = await Promise.all([
      Bid.count({ where: { load_id: loadId, status: 'PENDING' } }),
      Bid.findAll({
        where: { load_id: loadId, status: 'PENDING' },
        attributes: ['proposed_price'],
        raw: true,
      }),
    ]);

    if (total === 0) {
      return {
        totalBids: 0,
        lowestBid: 0,
        highestBid: 0,
        averageBid: 0,
      };
    }

    const prices = bids.map(bid => bid.proposed_price);
    const lowestBid = Math.min(...prices);
    const highestBid = Math.max(...prices);
    const averageBid = prices.reduce((sum, price) => sum + price, 0) / prices.length;

    return {
      totalBids: total,
      lowestBid,
      highestBid,
      averageBid,
    };
  }

  // ============================================
  // HELPERS
  // ============================================

  async expireBids() {
    const expiredBids = await Bid.update(
      { status: 'REJECTED' },
      {
        where: {
          status: 'PENDING',
          expires_at: {
            [Op.lte]: new Date(),
          },
        },
      }
    );

    if (expiredBids[0] > 0) {
      loggers.info(`Expired ${expiredBids[0]} bids`);
    }

    return expiredBids[0];
  }

  async getBidHistory(driverId: string, limit = 10) {
    return await Bid.findAll({
      where: {
        driver_id: driverId,
        status: { [Op.in]: ['ACCEPTED', 'REJECTED'] },
      },
      include: [{
        association: 'load',
        attributes: ['id', 'title', 'pickup_location', 'delivery_location'],
      }],
      order: [['updated_at', 'DESC']],
      limit,
    });
  }

  async canBidOnLoad(driverId: string, loadId: string): Promise<{ allowed: boolean; reason?: string }> {
    // Check subscription limit
    const canBid = await subscriptionService.canPlaceBid(driverId);
    if (!canBid.allowed) {
      return canBid;
    }

    // Check if load exists and is open
    const load = await Load.findByPk(loadId);

    if (!load) {
      return { allowed: false, reason: 'Load not found' };
    }

    if (load.status !== 'OPEN') {
      return { allowed: false, reason: 'Load is not accepting bids' };
    }

    if (load.owner_id === driverId) {
      return { allowed: false, reason: 'Cannot bid on your own load' };
    }

    // Check existing bid
    const existingBid = await Bid.findOne({
      where: {
        load_id: loadId,
        driver_id: driverId,
        status: 'PENDING',
      },
    });

    if (existingBid) {
      return { allowed: false, reason: 'You already have a pending bid on this load' };
    }

    return { allowed: true };
  }

  // ============================================
  // NEW METHODS FOR SEQUELIZE
  // ============================================

  async getActiveBidCount(driverId: string): Promise<number> {
    return Bid.count({
      where: {
        driver_id: driverId,
        status: 'PENDING',
      },
    });
  }

  async getBidWithDriver(bidId: string) {
    return Bid.findByPk(bidId, {
      include: [{
        association: 'driver',
        attributes: ['id', 'first_name', 'last_name', 'phone_number', 'email', 'rating'],
      }],
    });
  }

  async updateBidStatus(bidId: string, status: BidStatus) {
    const bid = await Bid.findByPk(bidId);
    
    if (!bid) {
      throw new Error('Bid not found');
    }

    await bid.update({ status });
    return bid;
  }
}

export const bidService = new BidService();