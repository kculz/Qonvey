// Trip Management Service
// Location: backend/src/services/trip.service.ts

import prisma from '@/config/database';
import { loggers } from '@/utils/logger';
import { notificationService } from '@/services/notification.service';
import { TripStatus, PaymentMethod } from '@prisma/client';
import type { LocationUpdate, TripUpdateData } from '@/types/trip.types';

class TripService {
  // ============================================
  // TRIP LIFECYCLE
  // ============================================

  async startTrip(tripId: string, driverId: string, currentLocation?: LocationUpdate) {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        load: {
          include: {
            owner: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                phoneNumber: true,
              },
            },
          },
        },
        driver: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!trip) {
      throw new Error('Trip not found');
    }

    if (trip.driverId !== driverId) {
      throw new Error('Unauthorized');
    }

    if (trip.status !== 'SCHEDULED') {
      throw new Error('Trip cannot be started in current status');
    }

    const updatedTrip = await prisma.trip.update({
      where: { id: tripId },
      data: {
        status: 'IN_PROGRESS',
        startTime: new Date(),
        ...(currentLocation && {
          currentLocation: currentLocation as any,
          route: [currentLocation],
        }),
      },
    });

    // Update load status
    await prisma.load.update({
      where: { id: trip.loadId },
      data: { status: 'IN_TRANSIT' },
    });

    loggers.trip.started(tripId, driverId, trip.loadId);

    // Notify cargo owner
    await notificationService.notifyTripStarted(
      trip.load.ownerId,
      trip.load.title,
      `${trip.driver.firstName} ${trip.driver.lastName}`
    );

    return updatedTrip;
  }

  async updateLocation(tripId: string, driverId: string, location: LocationUpdate) {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
    });

    if (!trip) {
      throw new Error('Trip not found');
    }

    if (trip.driverId !== driverId) {
      throw new Error('Unauthorized');
    }

    if (trip.status !== 'IN_PROGRESS') {
      throw new Error('Can only update location for trips in progress');
    }

    // Add location to route
    const currentRoute = (trip.route as any[]) || [];
    const updatedRoute = [...currentRoute, location];

    const updatedTrip = await prisma.trip.update({
      where: { id: tripId },
      data: {
        currentLocation: location as any,
        route: updatedRoute as any,
      },
    });

    return updatedTrip;
  }

  async uploadProofOfPickup(tripId: string, driverId: string, imageUrl: string) {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
    });

    if (!trip) {
      throw new Error('Trip not found');
    }

    if (trip.driverId !== driverId) {
      throw new Error('Unauthorized');
    }

    if (trip.status !== 'IN_PROGRESS') {
      throw new Error('Can only upload proof of pickup for trips in progress');
    }

    const updatedTrip = await prisma.trip.update({
      where: { id: tripId },
      data: { proofOfPickup: imageUrl },
    });

    loggers.info('Proof of pickup uploaded', { tripId, driverId });
    return updatedTrip;
  }

  async uploadProofOfDelivery(tripId: string, driverId: string, imageUrl: string, signature?: string) {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
    });

    if (!trip) {
      throw new Error('Trip not found');
    }

    if (trip.driverId !== driverId) {
      throw new Error('Unauthorized');
    }

    if (trip.status !== 'IN_PROGRESS') {
      throw new Error('Can only upload proof of delivery for trips in progress');
    }

    const updatedTrip = await prisma.trip.update({
      where: { id: tripId },
      data: {
        proofOfDelivery: imageUrl,
        ...(signature && { signature }),
      },
    });

    loggers.info('Proof of delivery uploaded', { tripId, driverId });
    return updatedTrip;
  }

  async completeTrip(tripId: string, driverId: string, data: TripUpdateData) {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        load: {
          include: {
            owner: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    if (!trip) {
      throw new Error('Trip not found');
    }

    if (trip.driverId !== driverId) {
      throw new Error('Unauthorized');
    }

    if (trip.status !== 'IN_PROGRESS') {
      throw new Error('Trip is not in progress');
    }

    // Require proof of delivery
    if (!data.proofOfDelivery && !trip.proofOfDelivery) {
      throw new Error('Proof of delivery is required');
    }

    const duration = trip.startTime 
      ? Math.floor((new Date().getTime() - trip.startTime.getTime()) / 1000 / 60) // minutes
      : 0;

    const completedTrip = await prisma.$transaction(async (tx) => {
      // Update trip
      const updated = await tx.trip.update({
        where: { id: tripId },
        data: {
          status: 'COMPLETED',
          endTime: new Date(),
          paymentMethod: data.paymentMethod,
          notes: data.notes,
          ...(data.proofOfDelivery && { proofOfDelivery: data.proofOfDelivery }),
          ...(data.signature && { signature: data.signature }),
        },
      });

      // Update load status
      await tx.load.update({
        where: { id: trip.loadId },
        data: { status: 'DELIVERED' },
      });

      return updated;
    });

    loggers.trip.completed(tripId, driverId, duration);

    // Notify cargo owner
    await notificationService.notifyTripCompleted(
      trip.load.ownerId,
      trip.load.title
    );

    return completedTrip;
  }

  async cancelTrip(tripId: string, userId: string, reason: string) {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        load: true,
        driver: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!trip) {
      throw new Error('Trip not found');
    }

    // Only driver or cargo owner can cancel
    if (trip.driverId !== userId && trip.load.ownerId !== userId) {
      throw new Error('Unauthorized');
    }

    if (trip.status === 'COMPLETED') {
      throw new Error('Cannot cancel completed trip');
    }

    const cancelledTrip = await prisma.$transaction(async (tx) => {
      // Update trip
      const updated = await tx.trip.update({
        where: { id: tripId },
        data: {
          status: 'CANCELLED',
          notes: reason,
        },
      });

      // Update load status back to OPEN
      await tx.load.update({
        where: { id: trip.loadId },
        data: { status: 'OPEN' },
      });

      // Update bid status back to PENDING
      await tx.bid.update({
        where: { id: trip.bidId },
        data: { status: 'PENDING' },
      });

      return updated;
    });

    loggers.trip.cancelled(tripId, reason);

    // Notify the other party
    const notifyUserId = userId === trip.driverId ? trip.load.ownerId : trip.driverId;
    await notificationService.sendPushNotification(notifyUserId, {
      title: 'Trip Cancelled',
      body: `Trip for "${trip.load.title}" has been cancelled. Reason: ${reason}`,
      type: 'TRIP_CANCELLED',
      data: { tripId, reason },
    });

    return cancelledTrip;
  }

  // ============================================
  // RETRIEVE
  // ============================================

  async getTrip(tripId: string) {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        load: {
          include: {
            owner: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                companyName: true,
                phoneNumber: true,
                email: true,
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
            phoneNumber: true,
            email: true,
            rating: true,
            totalRatings: true,
          },
        },
        bid: {
          include: {
            vehicle: true,
          },
        },
        review: true,
      },
    });

    if (!trip) {
      throw new Error('Trip not found');
    }

    return trip;
  }

  async getUserTrips(userId: string, status?: TripStatus, role: 'driver' | 'owner' = 'driver') {
    if (role === 'driver') {
      return await prisma.trip.findMany({
        where: {
          driverId: userId,
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
                  phoneNumber: true,
                },
              },
            },
          },
          bid: {
            include: {
              vehicle: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    } else {
      // Get trips for loads owned by this user
      return await prisma.trip.findMany({
        where: {
          load: {
            ownerId: userId,
          },
          ...(status && { status }),
        },
        include: {
          load: true,
          driver: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phoneNumber: true,
              rating: true,
            },
          },
          bid: {
            include: {
              vehicle: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    }
  }

  async getActiveTrips(driverId: string) {
    return await prisma.trip.findMany({
      where: {
        driverId,
        status: { in: ['SCHEDULED', 'IN_PROGRESS'] },
      },
      include: {
        load: {
          include: {
            owner: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                phoneNumber: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getTripRoute(tripId: string) {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      select: {
        route: true,
        currentLocation: true,
      },
    });

    if (!trip) {
      throw new Error('Trip not found');
    }

    return {
      route: trip.route || [],
      currentLocation: trip.currentLocation,
    };
  }

  // ============================================
  // ANALYTICS
  // ============================================

  async getTripStats(userId: string, role: 'driver' | 'owner' = 'driver') {
    const whereClause = role === 'driver' 
      ? { driverId: userId }
      : { load: { ownerId: userId } };

    const [total, scheduled, inProgress, completed, cancelled] = await Promise.all([
      prisma.trip.count({ where: whereClause }),
      prisma.trip.count({ where: { ...whereClause, status: 'SCHEDULED' } }),
      prisma.trip.count({ where: { ...whereClause, status: 'IN_PROGRESS' } }),
      prisma.trip.count({ where: { ...whereClause, status: 'COMPLETED' } }),
      prisma.trip.count({ where: { ...whereClause, status: 'CANCELLED' } }),
    ]);

    // Calculate total earnings (for drivers)
    let totalEarnings = 0;
    if (role === 'driver') {
      const earnings = await prisma.trip.aggregate({
        where: { driverId: userId, status: 'COMPLETED' },
        _sum: { agreedPrice: true },
      });
      totalEarnings = earnings._sum.agreedPrice || 0;
    }

    // Calculate average trip duration
    const tripsWithDuration = await prisma.trip.findMany({
      where: {
        ...whereClause,
        status: 'COMPLETED',
        startTime: { not: null },
        endTime: { not: null },
      },
      select: {
        startTime: true,
        endTime: true,
      },
    });

    let avgDuration = 0;
    if (tripsWithDuration.length > 0) {
      const totalDuration = tripsWithDuration.reduce((sum, trip) => {
        if (trip.startTime && trip.endTime) {
          const duration = trip.endTime.getTime() - trip.startTime.getTime();
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
    return await prisma.trip.findMany({
      where: {
        OR: [
          { driverId: userId },
          { load: { ownerId: userId } },
        ],
        status: { in: ['COMPLETED', 'CANCELLED'] },
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
        driver: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            rating: true,
          },
        },
        review: true,
      },
      orderBy: { endTime: 'desc' },
      take: limit,
    });
  }

  // ============================================
  // PAYMENT TRACKING
  // ============================================

  async updatePaymentMethod(tripId: string, userId: string, paymentMethod: PaymentMethod) {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: { load: true },
    });

    if (!trip) {
      throw new Error('Trip not found');
    }

    // Only driver or cargo owner can update payment method
    if (trip.driverId !== userId && trip.load.ownerId !== userId) {
      throw new Error('Unauthorized');
    }

    return await prisma.trip.update({
      where: { id: tripId },
      data: { paymentMethod },
    });
  }

  async markPaymentCompleted(tripId: string, userId: string, paymentMethod: PaymentMethod) {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: { load: true },
    });

    if (!trip) {
      throw new Error('Trip not found');
    }

    if (trip.status !== 'COMPLETED') {
      throw new Error('Trip must be completed before marking payment');
    }

    return await prisma.trip.update({
      where: { id: tripId },
      data: {
        paymentMethod,
        notes: trip.notes 
          ? `${trip.notes}\nPayment completed via ${paymentMethod}`
          : `Payment completed via ${paymentMethod}`,
      },
    });
  }

  // ============================================
  // HELPERS
  // ============================================

  async canStartTrip(tripId: string, driverId: string): Promise<{ allowed: boolean; reason?: string }> {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
    });

    if (!trip) {
      return { allowed: false, reason: 'Trip not found' };
    }

    if (trip.driverId !== driverId) {
      return { allowed: false, reason: 'Unauthorized' };
    }

    if (trip.status !== 'SCHEDULED') {
      return { allowed: false, reason: 'Trip cannot be started in current status' };
    }

    // Check if pickup date is today or past
    const load = await prisma.load.findUnique({
      where: { id: trip.loadId },
    });

    if (load && load.pickupDate > new Date()) {
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

    return await prisma.trip.findMany({
      where: {
        driverId,
        status: 'SCHEDULED',
        load: {
          pickupDate: {
            gte: new Date(),
            lte: futureDate,
          },
        },
      },
      include: {
        load: {
          include: {
            owner: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                phoneNumber: true,
              },
            },
          },
        },
      },
      orderBy: { load: { pickupDate: 'asc' } },
    });
  }
}

export const tripService = new TripService();