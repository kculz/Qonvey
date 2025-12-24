// Review & Rating Service
// Location: backend/src/services/review.service.ts

import prisma from '@/config/database';
import { loggers } from '@/utils/logger';
import type { CreateReviewData } from '@/types/review.types';

class ReviewService {
  // ============================================
  // CREATE REVIEW
  // ============================================

  async createReview(authorId: string, data: CreateReviewData) {
    // Validate rating
    if (data.rating < 1 || data.rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    // Get trip details
    const trip = await prisma.trip.findUnique({
      where: { id: data.tripId },
      include: {
        load: true,
        review: true,
      },
    });

    if (!trip) {
      throw new Error('Trip not found');
    }

    // Check if trip is completed
    if (trip.status !== 'COMPLETED') {
      throw new Error('Can only review completed trips');
    }

    // Check if review already exists
    if (trip.review) {
      throw new Error('Trip has already been reviewed');
    }

    // Determine who is being reviewed
    let receiverId: string;
    if (authorId === trip.load.ownerId) {
      // Cargo owner reviewing driver
      receiverId = trip.driverId;
    } else if (authorId === trip.driverId) {
      // Driver reviewing cargo owner
      receiverId = trip.load.ownerId;
    } else {
      throw new Error('Unauthorized to review this trip');
    }

    // Create review
    const review = await prisma.review.create({
      data: {
        tripId: data.tripId,
        authorId,
        receiverId,
        rating: data.rating,
        comment: data.comment,
      },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        receiver: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Update receiver's rating
    await this.updateUserRating(receiverId);

    loggers.info('Review created', {
      reviewId: review.id,
      authorId,
      receiverId,
      rating: data.rating,
    });

    return review;
  }

  // ============================================
  // UPDATE USER RATING
  // ============================================

  private async updateUserRating(userId: string) {
    // Get all reviews for this user
    const reviews = await prisma.review.findMany({
      where: { receiverId: userId },
      select: { rating: true },
    });

    if (reviews.length === 0) {
      return;
    }

    // Calculate average rating
    const totalRating = reviews.reduce((sum: number, review: { rating: number }) => sum + review.rating, 0);
    const averageRating = totalRating / reviews.length;

    // Update user's rating
    await prisma.user.update({
      where: { id: userId },
      data: {
        rating: Math.round(averageRating * 10) / 10, // Round to 1 decimal
        totalRatings: reviews.length,
      },
    });

    loggers.info('User rating updated', {
      userId,
      rating: averageRating,
      totalReviews: reviews.length,
    });
  }

  // ============================================
  // RETRIEVE REVIEWS
  // ============================================

  async getReview(reviewId: string) {
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      include: {
        trip: {
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
        },
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            companyName: true,
            profileImage: true,
          },
        },
        receiver: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            companyName: true,
            rating: true,
          },
        },
      },
    });

    if (!review) {
      throw new Error('Review not found');
    }

    return review;
  }

  async getUserReviews(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where: { receiverId: userId },
        include: {
          author: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              companyName: true,
              profileImage: true,
            },
          },
          trip: {
            select: {
              id: true,
              load: {
                select: {
                  title: true,
                  pickupLocation: true,
                  deliveryLocation: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.review.count({
        where: { receiverId: userId },
      }),
    ]);

    return {
      reviews,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getUserReviewsGiven(userId: string) {
    return await prisma.review.findMany({
      where: { authorId: userId },
      include: {
        receiver: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            companyName: true,
          },
        },
        trip: {
          select: {
            id: true,
            load: {
              select: {
                title: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getTripReview(tripId: string) {
    return await prisma.review.findUnique({
      where: { tripId },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            companyName: true,
            profileImage: true,
          },
        },
        receiver: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            companyName: true,
          },
        },
      },
    });
  }

  // ============================================
  // REVIEW ANALYTICS
  // ============================================

  async getUserRatingBreakdown(userId: string) {
    const reviews = await prisma.review.findMany({
      where: { receiverId: userId },
      select: { rating: true },
    });

    if (reviews.length === 0) {
      return {
        totalReviews: 0,
        averageRating: 0,
        breakdown: {
          5: 0,
          4: 0,
          3: 0,
          2: 0,
          1: 0,
        },
      };
    }

    // Count ratings by star
    const breakdown = reviews.reduce(
      (acc: Record<number, number>, review: { rating: number }) => {
        acc[review.rating as keyof typeof acc]++;
        return acc;
      },
      { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } as Record<number, number>
    );

    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    / 10;
    const averageRating = totalRating / reviews.length;

    return {
      totalReviews: reviews.length,
      averageRating: Math.round(averageRating * 10) / 10,
      breakdown,
    };
  }

  async getRecentReviews(userId: string, limit = 5) {
    return await prisma.review.findMany({
      where: { receiverId: userId },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profileImage: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  // ============================================
  // PENDING REVIEWS
  // ============================================

  async getPendingReviews(userId: string) {
    // Find completed trips where user hasn't reviewed yet
    const completedTrips = await prisma.trip.findMany({
      where: {
        OR: [
          { driverId: userId },
          { load: { ownerId: userId } },
        ],
        status: 'COMPLETED',
        review: null,
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
          },
        },
      },
      orderBy: { endTime: 'desc' },
    });

    return completedTrips.map(trip => {
      const isDriver = trip.driverId === userId;
      return {
        tripId: trip.id,
        loadTitle: trip.load.title,
        completedAt: trip.endTime,
        reviewFor: isDriver
          ? {
              id: trip.load.ownerId,
              name: `${trip.load.owner.firstName} ${trip.load.owner.lastName}`,
              companyName: trip.load.owner.companyName,
              role: 'Cargo Owner',
            }
          : {
              id: trip.driverId,
              name: `${trip.driver.firstName} ${trip.driver.lastName}`,
              companyName: trip.driver.companyName,
              role: 'Driver',
            },
      };
    });
  }

  // ============================================
  // VALIDATION
  // ============================================

  async canReviewTrip(userId: string, tripId: string): Promise<{ allowed: boolean; reason?: string }> {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        load: true,
        review: true,
      },
    });

    if (!trip) {
      return { allowed: false, reason: 'Trip not found' };
    }

    if (trip.status !== 'COMPLETED') {
      return { allowed: false, reason: 'Trip must be completed before reviewing' };
    }

    if (trip.review) {
      return { allowed: false, reason: 'Trip has already been reviewed' };
    }

    if (userId !== trip.driverId && userId !== trip.load.ownerId) {
      return { allowed: false, reason: 'Unauthorized to review this trip' };
    }

    return { allowed: true };
  }

  // ============================================
  // HELPERS
  // ============================================

  async getTopRatedUsers(role?: 'DRIVER' | 'CARGO_OWNER', limit = 10) {
    return await prisma.user.findMany({
      where: {
        ...(role && { role }),
        totalRatings: { gt: 0 },
        status: 'ACTIVE',
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        companyName: true,
        profileImage: true,
        rating: true,
        totalRatings: true,
        role: true,
      },
      orderBy: [
        { rating: 'desc' },
        { totalRatings: 'desc' },
      ],
      take: limit,
    });
  }

  async getUserReviewStats(userId: string) {
    const [reviewsReceived, reviewsGiven, breakdown] = await Promise.all([
      prisma.review.count({ where: { receiverId: userId } }),
      prisma.review.count({ where: { authorId: userId } }),
      this.getUserRatingBreakdown(userId),
    ]);

    // Calculate response rate (reviews given / trips completed)
    const completedTrips = await prisma.trip.count({
      where: {
        OR: [
          { driverId: userId },
          { load: { ownerId: userId } },
        ],
        status: 'COMPLETED',
      },
    });

    const responseRate = completedTrips > 0
      ? Math.round((reviewsGiven / completedTrips) * 100)
      : 0;

    return {
      reviewsReceived,
      reviewsGiven,
      responseRate,
      ...breakdown,
    };
  }
}

export const reviewService = new ReviewService();