// backend/src/services/trip.service.ts

import { Op } from 'sequelize';
import { loggers } from '../utils/logger';
import { notificationService } from './notification.service';
import { sequelize } from '../models';
import type { LocationUpdate, TripUpdateData } from '../types/trip.types';
import Trip from '@/models/trip.model';
import Load from '@/models/load.model';
import Bid from '@/models/bid.model';

export enum TripStatus {
  SCHEDULED = 'SCHEDULED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum PaymentMethod {
  CASH = 'CASH',
  ECOCASH = 'ECOCASH',
  ONEMONEY = 'ONEMONEY',
  BANK_TRANSFER = 'BANK_TRANSFER',
  CARD = 'CARD',
}

class TripService {
  // ============================================
  // TRIP LIFECYCLE
  // ============================================

  async startTrip(tripId: string, driverId: string, currentLocation?: LocationUpdate) {
    const trip = await Trip.findByPk(tripId, {
      include: [
        {
          association: 'load',
          include: [{
            association: 'owner',
            attributes: ['id', 'first_name', 'last_name', 'phone_number'],
          }],
        },
        {
          association: 'driver',
          attributes: ['id', 'first_name', 'last_name'],
        },
      ],
    });

    if (!trip) {
      throw new Error('Trip not found');
    }

    if (trip.driver_id !== driverId) {
      throw new Error('Unauthorized');
    }

    if (trip.status !== 'SCHEDULED') {
      throw new Error('Trip cannot be started in current status');
    }

    const updateData: any = {
      status: 'IN_PROGRESS',
      start_time: new Date(),
    };

    if (currentLocation) {
      updateData.current_location = currentLocation;
      updateData.route = [currentLocation];
    }

    await trip.update(updateData);

    // Update load status
    await Load.update(
      { status: 'IN_TRANSIT' },
      { where: { id: trip.load_id } }
    );

    loggers.trip.started(tripId, driverId, trip.load_id);

    // Notify cargo owner
    await notificationService.notifyTripStarted(
      trip.load.owner_id,
      trip.load.title,
      `${trip.driver.first_name} ${trip.driver.last_name}`
    );

    return trip;
  }

  async updateLocation(tripId: string, driverId: string, location: LocationUpdate) {
    const trip = await Trip.findByPk(tripId);

    if (!trip) {
      throw new Error('Trip not found');
    }

    if (trip.driver_id !== driverId) {
      throw new Error('Unauthorized');
    }

    if (trip.status !== 'IN_PROGRESS') {
      throw new Error('Can only update location for trips in progress');
    }

    // Add location to route
    const currentRoute = trip.route || [];
    const updatedRoute = [...currentRoute, location];

    await trip.update({
      current_location: location,
      route: updatedRoute,
    });

    return trip;
  }

  async uploadProofOfPickup(tripId: string, driverId: string, imageUrl: string) {
    const trip = await Trip.findByPk(tripId);

    if (!trip) {
      throw new Error('Trip not found');
    }

    if (trip.driver_id !== driverId) {
      throw new Error('Unauthorized');
    }

    if (trip.status !== 'IN_PROGRESS') {
      throw new Error('Can only upload proof of pickup for trips in progress');
    }

    await trip.update({ proof_of_pickup: imageUrl });
    loggers.info('Proof of pickup uploaded', { tripId, driverId });
    return trip;
  }

  async uploadProofOfDelivery(tripId: string, driverId: string, imageUrl: string, signature?: string) {
    const trip = await Trip.findByPk(tripId);

    if (!trip) {
      throw new Error('Trip not found');
    }

    if (trip.driver_id !== driverId) {
      throw new Error('Unauthorized');
    }

    if (trip.status !== 'IN_PROGRESS') {
      throw new Error('Can only upload proof of delivery for trips in progress');
    }

    const updateData: any = { proof_of_delivery: imageUrl };
    if (signature) updateData.signature = signature;

    await trip.update(updateData);
    loggers.info('Proof of delivery uploaded', { tripId, driverId });
    return trip;
  }

  async completeTrip(tripId: string, driverId: string, data: TripUpdateData) {
    const trip = await Trip.findByPk(tripId, {
      include: [{
        association: 'load',
        include: [{
          association: 'owner',
          attributes: ['id', 'first_name', 'last_name'],
        }],
      }],
    });

    if (!trip) {
      throw new Error('Trip not found');
    }

    if (trip.driver_id !== driverId) {
      throw new Error('Unauthorized');
    }

    if (trip.status !== 'IN_PROGRESS') {
      throw new Error('Trip is not in progress');
    }

    // Require proof of delivery
    if (!data.proofOfDelivery && !trip.proof_of_delivery) {
      throw new Error('Proof of delivery is required');
    }

    const duration = trip.start_time 
      ? Math.floor((new Date().getTime() - trip.start_time.getTime()) / 1000 / 60) // minutes
      : 0;

    const transaction = await sequelize.transaction();

    try {
      // Update trip
      const updateData: any = {
        status: 'COMPLETED',
        end_time: new Date(),
        ...(data.paymentMethod && { payment_method: data.paymentMethod }),
        ...(data.notes && { notes: data.notes }),
        ...(data.proofOfDelivery && { proof_of_delivery: data.proofOfDelivery }),
        ...(data.signature && { signature: data.signature }),
      };

      await trip.update(updateData, { transaction });

      // Update load status
      await Load.update(
        { status: 'DELIVERED' },
        { where: { id: trip.load_id }, transaction }
      );

      await transaction.commit();

      loggers.trip.completed(tripId, driverId, duration);

      // Notify cargo owner
      if (trip.load && trip.load.owner_id) {
        await notificationService.notifyTripCompleted(
          trip.load.owner_id,
          trip.load.title
        );
      }

      return trip;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async cancelTrip(tripId: string, userId: string, reason: string) {
    const trip = await Trip.findByPk(tripId, {
      include: [
        {
          association: 'load',
        },
        {
          association: 'driver',
          attributes: ['id', 'first_name', 'last_name'],
        },
      ],
    });

    if (!trip) {
      throw new Error('Trip not found');
    }

    // Only driver or cargo owner can cancel
    if (trip.driver_id !== userId && trip.load.owner_id !== userId) {
      throw new Error('Unauthorized');
    }

    if (trip.status === 'COMPLETED') {
      throw new Error('Cannot cancel completed trip');
    }

    const transaction = await sequelize.transaction();

    try {
      // Update trip
      await trip.update({
        status: 'CANCELLED',
        notes: reason,
      }, { transaction });

      // Update load status back to OPEN
      await Load.update(
        { status: 'OPEN' },
        { where: { id: trip.load_id }, transaction }
      );

      // Update bid status back to PENDING
      await Bid.update(
        { status: 'PENDING' },
        { where: { id: trip.bid_id }, transaction }
      );

      await transaction.commit();

      loggers.trip.cancelled(tripId, reason);

      // Notify the other party
      const notifyUserId = userId === trip.driver_id ? trip.load.owner_id : trip.driver_id;
      if (notifyUserId) {
        await notificationService.sendPushNotification(notifyUserId, {
          title: 'Trip Cancelled',
          body: `Trip for "${trip.load.title}" has been cancelled. Reason: ${reason}`,
          type: 'TRIP_CANCELLED',
          data: { tripId, reason },
        });
      }

      return trip;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  // ============================================
  // RETRIEVE
  // ============================================

  async getTrip(tripId: string) {
    const trip = await Trip.findByPk(tripId, {
      include: [
        {
          association: 'load',
          include: [{
            association: 'owner',
            attributes: ['id', 'first_name', 'last_name', 'company_name', 'phone_number', 'email', 'rating'],
          }],
        },
        {
          association: 'driver',
          attributes: ['id', 'first_name', 'last_name', 'company_name', 'phone_number', 'email', 'rating', 'total_ratings'],
        },
        {
          association: 'bid',
          include: [{
            association: 'vehicle',
          }],
        },
        {
          association: 'review',
        },
      ],
    });

    if (!trip) {
      throw new Error('Trip not found');
    }

    return trip;
  }

  async getUserTrips(userId: string, status?: TripStatus, role: 'driver' | 'owner' = 'driver') {
    if (role === 'driver') {
      const whereClause: any = { driver_id: userId };
      if (status) {
        whereClause.status = status;
      }

      return await Trip.findAll({
        where: whereClause,
        include: [
          {
            association: 'load',
            include: [{
              association: 'owner',
              attributes: ['id', 'first_name', 'last_name', 'company_name', 'phone_number'],
            }],
          },
          {
            association: 'bid',
            include: [{
              association: 'vehicle',
            }],
          },
        ],
        order: [['created_at', 'DESC']],
      });
    } else {
      // Get trips for loads owned by this user
      const whereClause: any = {
        '$load.owner_id$': userId,
      };
      if (status) {
        whereClause.status = status;
      }

      return await Trip.findAll({
        where: whereClause,
        include: [
          {
            association: 'load',
          },
          {
            association: 'driver',
            attributes: ['id', 'first_name', 'last_name', 'phone_number', 'rating'],
          },
          {
            association: 'bid',
            include: [{
              association: 'vehicle',
            }],
          },
        ],
        order: [['created_at', 'DESC']],
      });
    }
  }

  async getActiveTrips(driverId: string) {
    return await Trip.findAll({
      where: {
        driver_id: driverId,
        status: { [Op.in]: ['SCHEDULED', 'IN_PROGRESS'] },
      },
      include: [
        {
          association: 'load',
          include: [{
            association: 'owner',
            attributes: ['id', 'first_name', 'last_name', 'phone_number'],
          }],
        },
      ],
      order: [['created_at', 'DESC']],
    });
  }

  async getTripRoute(tripId: string) {
    const trip = await Trip.findByPk(tripId, {
      attributes: ['route', 'current_location'],
    });

    if (!trip) {
      throw new Error('Trip not found');
    }

    return {
      route: trip.route || [],
      currentLocation: trip.current_location,
    };
  }

  // ============================================
  // ANALYTICS
  // ============================================

  async getTripStats(userId: string, role: 'driver' | 'owner' = 'driver') {
    let whereClause: any;

    if (role === 'driver') {
      whereClause = { driver_id: userId };
    } else {
      whereClause = { '$load.owner_id$': userId };
    }

    const [
      total,
      scheduled,
      inProgress,
      completed,
      cancelled
    ] = await Promise.all([
      Trip.count({ where: whereClause }),
      Trip.count({ where: { ...whereClause, status: 'SCHEDULED' } }),
      Trip.count({ where: { ...whereClause, status: 'IN_PROGRESS' } }),
      Trip.count({ where: { ...whereClause, status: 'COMPLETED' } }),
      Trip.count({ where: { ...whereClause, status: 'CANCELLED' } }),
    ]);

    // Calculate total earnings (for drivers)
    let totalEarnings = 0;
    if (role === 'driver') {
      const earnings = await Trip.findOne({
        attributes: [
          [sequelize.fn('SUM', sequelize.col('agreed_price')), 'total']
        ],
        where: { driver_id: userId, status: 'COMPLETED' },
        raw: true,
      }) as { total: number } | null;
      totalEarnings = earnings?.total || 0;
    }

    // Calculate average trip duration
    const tripsWithDuration = await Trip.findAll({
      where: {
        ...whereClause,
        status: 'COMPLETED',
        start_time: { [Op.ne]: null },
        end_time: { [Op.ne]: null },
      },
      attributes: ['start_time', 'end_time'],
      raw: true,
    });

    let avgDuration = 0;
    if (tripsWithDuration.length > 0) {
      const totalDuration = tripsWithDuration.reduce((sum, trip) => {
        if (trip.start_time && trip.end_time) {
          const duration = new Date(trip.end_time).getTime() - new Date(trip.start_time).getTime();
          return sum + duration;
        }
        return sum;
      }, 0);
      avgDuration = Math.floor(totalDuration / tripsWithDuration.length / 1000 / 60); // minutes
    }

    return {
      total,
      scheduled,
      inProgress,
      completed,
      cancelled,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      ...(role === 'driver' && { totalEarnings }),
      averageDuration: avgDuration,
    };
  }

  async getTripHistory(userId: string, limit = 20) {
    return await Trip.findAll({
      where: {
        [Op.or]: [
          { driver_id: userId },
          { '$load.owner_id$': userId },
        ],
        status: { [Op.in]: ['COMPLETED', 'CANCELLED'] },
      },
      include: [
        {
          association: 'load',
          attributes: ['id', 'title', 'pickup_location', 'delivery_location'],
        },
        {
          association: 'driver',
          attributes: ['id', 'first_name', 'last_name', 'rating'],
        },
        {
          association: 'review',
        },
      ],
      order: [['end_time', 'DESC']],
      limit,
    });
  }

  // ============================================
  // PAYMENT TRACKING
  // ============================================

  async updatePaymentMethod(tripId: string, userId: string, paymentMethod: PaymentMethod) {
    const trip = await Trip.findByPk(tripId, {
      include: [{
        association: 'load',
      }],
    });

    if (!trip) {
      throw new Error('Trip not found');
    }

    // Only driver or cargo owner can update payment method
    if (trip.driver_id !== userId && trip.load.owner_id !== userId) {
      throw new Error('Unauthorized');
    }

    await trip.update({ payment_method: paymentMethod });
    return trip;
  }

  async markPaymentCompleted(tripId: string, userId: string, paymentMethod: PaymentMethod) {
    const trip = await Trip.findByPk(tripId, {
      include: [{
        association: 'load',
      }],
    });

    if (!trip) {
      throw new Error('Trip not found');
    }

    if (trip.status !== 'COMPLETED') {
      throw new Error('Trip must be completed before marking payment');
    }

    const notes = trip.notes 
      ? `${trip.notes}\nPayment completed via ${paymentMethod}`
      : `Payment completed via ${paymentMethod}`;

    await trip.update({
      payment_method: paymentMethod,
      notes,
    });

    return trip;
  }

  // ============================================
  // HELPERS
  // ============================================

  async canStartTrip(tripId: string, driverId: string): Promise<{ allowed: boolean; reason?: string }> {
    const trip = await Trip.findByPk(tripId);

    if (!trip) {
      return { allowed: false, reason: 'Trip not found' };
    }

    if (trip.driver_id !== driverId) {
      return { allowed: false, reason: 'Unauthorized' };
    }

    if (trip.status !== 'SCHEDULED') {
      return { allowed: false, reason: 'Trip cannot be started in current status' };
    }

    // Check if pickup date is today or past
    const load = await Load.findByPk(trip.load_id);

    if (load && load.pickup_date > new Date()) {
      return { 
        allowed: false, 
        reason: 'Trip cannot be started before scheduled pickup date' 
      };
    }

    return { allowed: true };
  }

  async getUpcomingTrips(driverId: string, days = 7) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    return await Trip.findAll({
      where: {
        driver_id: driverId,
        status: 'SCHEDULED',
        '$load.pickup_date$': {
          [Op.gte]: new Date(),
          [Op.lte]: futureDate,
        },
      },
      include: [
        {
          association: 'load',
          include: [{
            association: 'owner',
            attributes: ['id', 'first_name', 'last_name', 'phone_number'],
          }],
        },
      ],
      order: [['$load.pickup_date$', 'ASC']],
    });
  }

  // ============================================
  // NEW METHODS FOR SEQUELIZE
  // ============================================

  async getTripWithDetails(tripId: string) {
    return await Trip.findByPk(tripId, {
      include: [
        {
          association: 'load',
          include: [
            {
              association: 'owner',
              attributes: ['id', 'first_name', 'last_name', 'phone_number', 'email'],
            },
          ],
        },
        {
          association: 'driver',
          attributes: ['id', 'first_name', 'last_name', 'phone_number', 'rating'],
        },
        {
          association: 'bid',
          include: [
            {
              association: 'vehicle',
            },
          ],
        },
      ],
    });
  }

  async updateTripNotes(tripId: string, userId: string, notes: string) {
    const trip = await Trip.findByPk(tripId, {
      include: [{
        association: 'load',
      }],
    });

    if (!trip) {
      throw new Error('Trip not found');
    }

    if (trip.driver_id !== userId && trip.load.owner_id !== userId) {
      throw new Error('Unauthorized');
    }

    await trip.update({ notes });
    return trip;
  }

  async getTodayTrips(userId: string, role: 'driver' | 'owner' = 'driver') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (role === 'driver') {
      return await Trip.findAll({
        where: {
          driver_id: userId,
          status: { [Op.in]: ['SCHEDULED', 'IN_PROGRESS'] },
          '$load.pickup_date$': {
            [Op.gte]: today,
            [Op.lt]: tomorrow,
          },
        },
        include: [
          {
            association: 'load',
            include: [{
              association: 'owner',
              attributes: ['id', 'first_name', 'last_name'],
            }],
          },
        ],
        order: [['$load.pickup_date$', 'ASC']],
      });
    } else {
      return await Trip.findAll({
        where: {
          '$load.owner_id$': userId,
          status: { [Op.in]: ['SCHEDULED', 'IN_PROGRESS'] },
          '$load.pickup_date$': {
            [Op.gte]: today,
            [Op.lt]: tomorrow,
          },
        },
        include: [
          {
            association: 'load',
          },
          {
            association: 'driver',
            attributes: ['id', 'first_name', 'last_name'],
          },
        ],
        order: [['$load.pickup_date$', 'ASC']],
      });
    }
  }

  async getDriverEarnings(driverId: string, startDate?: Date, endDate?: Date) {
    const whereClause: any = {
      driver_id: driverId,
      status: 'COMPLETED',
    };

    if (startDate) {
      whereClause.end_time = { [Op.gte]: startDate };
    }
    if (endDate) {
      whereClause.end_time = { ...whereClause.end_time, [Op.lte]: endDate };
    }

    const trips = await Trip.findAll({
      where: whereClause,
      attributes: ['id', 'agreed_price', 'currency', 'end_time', 'load_id'],
      include: [{
        association: 'load',
        attributes: ['id', 'title'],
      }],
      order: [['end_time', 'DESC']],
    });

    const totalEarnings = trips.reduce((sum, trip) => sum + trip.agreed_price, 0);

    return {
      trips,
      totalEarnings,
      totalTrips: trips.length,
    };
  }
}

export const tripService = new TripService();