// Review & Rating Service - Sequelize Version
// Location: backend/src/services/review.service.ts

import { Op, Sequelize } from 'sequelize';
import { loggers } from '@/utils/logger';
import type { CreateReviewData } from '@/types/review.types';
import Review from '@/models/review.model';
import Trip from '@/models/trip.model';
import Load from '@/models/load.model';
import User from '@/models/user.model';

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
    const trip = await Trip.findByPk(data.tripId, {
      include: [
        {
          association: 'load',
        },
        {
          association: 'review',
        },
      ],
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
    if (authorId === trip.load.owner_id) {
      // Cargo owner reviewing driver
      receiverId = trip.driver_id;
    } else if (authorId === trip.driver_id) {
      // Driver reviewing cargo owner
      receiverId = trip.load.owner_id;
    } else {
      throw new Error('Unauthorized to review this trip');
    }

    // Create review
    const review = await Review.create({
      trip_id: data.tripId,
      author_id: authorId,
      receiver_id: receiverId,
      rating: data.rating,
      comment: data.comment,
    });

    // Load review with author and receiver details
    const reviewWithDetails = await Review.findByPk(review.id, {
      include: [
        {
          association: 'author',
          attributes: ['id', 'first_name', 'last_name'],
        },
        {
          association: 'receiver',
          attributes: ['id', 'first_name', 'last_name'],
        },
      ],
    });

    // Update receiver's rating
    await this.updateUserRating(receiverId);

    loggers.info('Review created', {
      reviewId: review.id,
      authorId,
      receiverId,
      rating: data.rating,
    });

    return reviewWithDetails;
  }

  // ============================================
  // UPDATE USER RATING
  // ============================================

  private async updateUserRating(userId: string) {
    // Get all reviews for this user
    const reviews = await Review.findAll({
      where: { receiver_id: userId },
      attributes: ['rating'],
    });

    if (reviews.length === 0) {
      return;
    }

    // Calculate average rating
    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = totalRating / reviews.length;

    // Update user's rating
    await User.update(
      {
        rating: Math.round(averageRating * 10) / 10, // Round to 1 decimal
        total_ratings: reviews.length,
      },
      {
        where: { id: userId },
      }
    );

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
    const review = await Review.findByPk(reviewId, {
      include: [
        {
          association: 'trip',
          include: [{
            association: 'load',
            attributes: ['id', 'title', 'pickup_location', 'delivery_location'],
          }],
        },
        {
          association: 'author',
          attributes: ['id', 'first_name', 'last_name', 'company_name', 'profile_image'],
        },
        {
          association: 'receiver',
          attributes: ['id', 'first_name', 'last_name', 'company_name', 'rating'],
        },
      ],
    });

    if (!review) {
      throw new Error('Review not found');
    }

    return review;
  }

  async getUserReviews(userId: string, page = 1, limit = 20) {
    const offset = (page - 1) * limit;

    const { rows: reviews, count: total } = await Review.findAndCountAll({
      where: { receiver_id: userId },
      include: [
        {
          association: 'author',
          attributes: ['id', 'first_name', 'last_name', 'company_name', 'profile_image'],
        },
        {
          association: 'trip',
          include: [{
            association: 'load',
            attributes: ['title', 'pickup_location', 'delivery_location'],
          }],
        },
      ],
      order: [['created_at', 'DESC']],
      offset,
      limit,
    });

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
    return await Review.findAll({
      where: { author_id: userId },
      include: [
        {
          association: 'receiver',
          attributes: ['id', 'first_name', 'last_name', 'company_name'],
        },
        {
          association: 'trip',
          include: [{
            association: 'load',
            attributes: ['title'],
          }],
        },
      ],
      order: [['created_at', 'DESC']],
    });
  }

  async getTripReview(tripId: string) {
    return await Review.findOne({
      where: { trip_id: tripId },
      include: [
        {
          association: 'author',
          attributes: ['id', 'first_name', 'last_name', 'company_name', 'profile_image'],
        },
        {
          association: 'receiver',
          attributes: ['id', 'first_name', 'last_name', 'company_name'],
        },
      ],
    });
  }

  // ============================================
  // REVIEW ANALYTICS
  // ============================================

async getUserRatingBreakdown(userId: string) {
  const reviews = await Review.findAll({
    where: { receiver_id: userId },
    attributes: ['rating'],
    raw: true,
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

  // Initialize breakdown with all possible ratings
  const breakdown: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };

  // Count ratings by star
  reviews.forEach((review: { rating: number }) => {
    const rating = review.rating as keyof typeof breakdown;
    if (rating in breakdown) {
      breakdown[rating]++;
    }
  });

  const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
  const averageRating = totalRating / reviews.length;

  return {
    totalReviews: reviews.length,
    averageRating: Math.round(averageRating * 10) / 10,
    breakdown,
  };
}

  async getRecentReviews(userId: string, limit = 5) {
    return await Review.findAll({
      where: { receiver_id: userId },
      include: [
        {
          association: 'author',
          attributes: ['id', 'first_name', 'last_name', 'profile_image'],
        },
      ],
      order: [['created_at', 'DESC']],
      limit,
    });
  }

  // ============================================
  // PENDING REVIEWS
  // ============================================

  async getPendingReviews(userId: string) {
    // Find completed trips where user hasn't reviewed yet
    const completedTrips = await Trip.findAll({
      where: {
        [Op.or]: [
          { driver_id: userId },
          { '$load.owner_id$': userId },
        ],
        status: 'COMPLETED',
        '$review.id$': null, // No review exists
      },
      include: [
        {
          association: 'load',
          include: [{
            association: 'owner',
            attributes: ['id', 'first_name', 'last_name', 'company_name'],
          }],
        },
        {
          association: 'driver',
          attributes: ['id', 'first_name', 'last_name', 'company_name'],
        },
        {
          association: 'review',
          required: false, // Use required: false to include trips without reviews
        },
      ],
      order: [['end_time', 'DESC']],
    });

    return completedTrips
      .filter(trip => !trip.review) // Ensure no review exists
      .map(trip => {
        const isDriver = trip.driver_id === userId;
        return {
          tripId: trip.id,
          loadTitle: trip.load.title,
          completedAt: trip.end_time,
          reviewFor: isDriver
            ? {
                id: trip.load.owner_id,
                name: `${trip.load.owner.first_name} ${trip.load.owner.last_name}`,
                companyName: trip.load.owner.company_name,
                role: 'Cargo Owner',
              }
            : {
                id: trip.driver_id,
                name: `${trip.driver.first_name} ${trip.driver.last_name}`,
                companyName: trip.driver.company_name,
                role: 'Driver',
              },
        };
      });
  }

  // ============================================
  // VALIDATION
  // ============================================

  async canReviewTrip(userId: string, tripId: string): Promise<{ allowed: boolean; reason?: string }> {
    const trip = await Trip.findByPk(tripId, {
      include: [
        {
          association: 'load',
        },
        {
          association: 'review',
        },
      ],
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

    if (userId !== trip.driver_id && userId !== trip.load.owner_id) {
      return { allowed: false, reason: 'Unauthorized to review this trip' };
    }

    return { allowed: true };
  }

  // ============================================
  // HELPERS
  // ============================================

  async getTopRatedUsers(role?: 'DRIVER' | 'CARGO_OWNER', limit = 10) {
    const whereClause: any = {
      total_ratings: { [Op.gt]: 0 },
      status: 'ACTIVE',
    };

    if (role) {
      whereClause.role = role;
    }

    return await User.findAll({
      where: whereClause,
      attributes: [
        'id',
        'first_name',
        'last_name',
        'company_name',
        'profile_image',
        'rating',
        'total_ratings',
        'role',
      ],
      order: [
        ['rating', 'DESC'],
        ['total_ratings', 'DESC'],
      ],
      limit,
    });
  }

  async getUserReviewStats(userId: string) {
    const [reviewsReceived, reviewsGiven, breakdown] = await Promise.all([
      Review.count({ where: { receiver_id: userId } }),
      Review.count({ where: { author_id: userId } }),
      this.getUserRatingBreakdown(userId),
    ]);

    // Calculate response rate (reviews given / trips completed)
    const completedTrips = await Trip.count({
      where: {
        [Op.or]: [
          { driver_id: userId },
          { '$load.owner_id$': userId },
        ],
        status: 'COMPLETED',
      },
      include: [{
        association: 'load',
        where: { owner_id: userId },
        required: false,
      }],
      distinct: true,
      col: 'Trip.id',
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

  // ============================================
  // NEW SEQUELIZE-SPECIFIC METHODS
  // ============================================

  async getReviewWithDetails(reviewId: string) {
    const review = await Review.findByPk(reviewId, {
      include: [
        {
          association: 'trip',
          include: [
            {
              association: 'load',
              attributes: ['id', 'title', 'pickup_location', 'delivery_location', 'weight'],
            },
            {
              association: 'driver',
              attributes: ['id', 'first_name', 'last_name'],
            },
          ],
        },
        {
          association: 'author',
          attributes: ['id', 'first_name', 'last_name', 'profile_image', 'rating'],
        },
        {
          association: 'receiver',
          attributes: ['id', 'first_name', 'last_name', 'profile_image', 'rating'],
        },
      ],
    });

    if (!review) {
      throw new Error('Review not found');
    }

    return review;
  }

  async updateReview(reviewId: string, authorId: string, data: { rating?: number; comment?: string }) {
    const review = await Review.findByPk(reviewId);

    if (!review) {
      throw new Error('Review not found');
    }

    if (review.author_id !== authorId) {
      throw new Error('Unauthorized to update this review');
    }

    // Check if rating is being updated
    const isRatingUpdated = data.rating !== undefined && data.rating !== review.rating;

    const updateData: any = {};
    if (data.rating !== undefined) {
      if (data.rating < 1 || data.rating > 5) {
        throw new Error('Rating must be between 1 and 5');
      }
      updateData.rating = data.rating;
    }
    if (data.comment !== undefined) {
      updateData.comment = data.comment;
    }

    await review.update(updateData);

    // If rating was updated, recalculate receiver's average rating
    if (isRatingUpdated) {
      await this.updateUserRating(review.receiver_id);
    }

    loggers.info('Review updated', { reviewId, authorId });
    return review;
  }

  async deleteReview(reviewId: string, userId: string) {
    const review = await Review.findByPk(reviewId);

    if (!review) {
      throw new Error('Review not found');
    }

    // Only author can delete their review
    if (review.author_id !== userId) {
      throw new Error('Unauthorized to delete this review');
    }

    const receiverId = review.receiver_id;
    await review.destroy();

    // Recalculate receiver's rating after deletion
    await this.updateUserRating(receiverId);

    loggers.info('Review deleted', { reviewId, userId });
    return { success: true };
  }

  async getReviewsByTripIds(tripIds: string[]) {
    return await Review.findAll({
      where: {
        trip_id: { [Op.in]: tripIds },
      },
      include: [
        {
          association: 'author',
          attributes: ['id', 'first_name', 'last_name', 'profile_image'],
        },
      ],
      order: [['created_at', 'DESC']],
    });
  }

  async getMonthlyReviewStats(userId: string, months = 6) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const monthlyStats = await Review.findAll({
      where: {
        receiver_id: userId,
        created_at: {
          [Op.gte]: startDate,
          [Op.lte]: endDate,
        },
      },
      attributes: [
        [Sequelize.fn('DATE_TRUNC', 'month', Sequelize.col('created_at')), 'month'],
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'review_count'],
        [Sequelize.fn('AVG', Sequelize.col('rating')), 'average_rating'],
      ],
      group: ['month'],
      order: [['month', 'DESC']],
      raw: true,
    });

    return monthlyStats;
  }

  async getReviewSummary(userId: string) {
    const [reviewsReceived, reviewsGiven] = await Promise.all([
      Review.findAll({
        where: { receiver_id: userId },
        attributes: ['rating', 'comment', 'created_at'],
        order: [['created_at', 'DESC']],
        limit: 10,
      }),
      Review.findAll({
        where: { author_id: userId },
        include: [{
          association: 'receiver',
          attributes: ['id', 'first_name', 'last_name', 'profile_image'],
        }],
        order: [['created_at', 'DESC']],
        limit: 10,
      }),
    ]);

    const ratingBreakdown = await this.getUserRatingBreakdown(userId);

    return {
      reviewsReceived: {
        total: ratingBreakdown.totalReviews,
        average: ratingBreakdown.averageRating,
        recent: reviewsReceived,
        breakdown: ratingBreakdown.breakdown,
      },
      reviewsGiven: {
        total: reviewsGiven.length,
        recent: reviewsGiven,
      },
    };
  }

  async searchReviews(filters: {
    userId?: string;
    minRating?: number;
    maxRating?: number;
    startDate?: Date;
    endDate?: Date;
    hasComment?: boolean;
  }) {
    const whereClause: any = {};

    if (filters.userId) {
      whereClause.receiver_id = filters.userId;
    }
    if (filters.minRating) {
      whereClause.rating = { [Op.gte]: filters.minRating };
    }
    if (filters.maxRating) {
      whereClause.rating = { ...whereClause.rating, [Op.lte]: filters.maxRating };
    }
    if (filters.startDate) {
      whereClause.created_at = { [Op.gte]: filters.startDate };
    }
    if (filters.endDate) {
      whereClause.created_at = { ...whereClause.created_at, [Op.lte]: filters.endDate };
    }
    if (filters.hasComment !== undefined) {
      if (filters.hasComment) {
        // Check that comment is not null AND not empty string
        whereClause.comment = {
          [Op.and]: [
            { [Op.ne]: null },
            { [Op.ne]: '' }
          ]
        };
      } else {
        // Check that comment is null OR empty string
        whereClause.comment = {
          [Op.or]: [
            { [Op.eq]: null },
            { [Op.eq]: '' }
          ]
        };
      }
    }

    return await Review.findAll({
      where: whereClause,
      include: [
        {
          association: 'author',
          attributes: ['id', 'first_name', 'last_name', 'profile_image', 'rating'],
        },
        {
          association: 'trip',
          include: [{
            association: 'load',
            attributes: ['title'],
          }],
        },
      ],
      order: [['created_at', 'DESC']],
    });
  }
}

export const reviewService = new ReviewService();