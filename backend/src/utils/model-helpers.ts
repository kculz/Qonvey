import { Op } from 'sequelize';
import models from '../models';

export class ModelHelpers {
  // User helpers
  static async findUserByPhone(phoneNumber: string) {
    return models.User.findOne({
      where: { phone_number: phoneNumber },
      include: [
        {
          model: models.Subscription,
          as: 'subscription',
        },
      ],
    });
  }

  static async updateUserRating(userId: string) {
    const reviews = await models.Review.findAll({
      where: { receiver_id: userId },
      attributes: ['rating'],
    });

    if (reviews.length === 0) return;

    const total = reviews.reduce((sum, review) => sum + review.rating, 0);
    const average = total / reviews.length;

    await models.User.update(
      {
        rating: average,
        total_ratings: reviews.length,
      },
      { where: { id: userId } }
    );
  }

  // Load helpers
  static async searchLoads(filters: any, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    const whereClause: any = {};

    if (filters.status) whereClause.status = filters.status;
    if (filters.cargo_type) whereClause.cargo_type = filters.cargo_type;
    if (filters.vehicle_types && filters.vehicle_types.length > 0) {
      whereClause.vehicle_types = { [Op.overlap]: filters.vehicle_types };
    }
    if (filters.min_weight) whereClause.weight = { [Op.gte]: filters.min_weight };
    if (filters.max_weight) whereClause.weight = { ...whereClause.weight, [Op.lte]: filters.max_weight };
    if (filters.pickup_date_from) whereClause.pickup_date = { [Op.gte]: filters.pickup_date_from };
    if (filters.pickup_date_to) whereClause.pickup_date = { ...whereClause.pickup_date, [Op.lte]: filters.pickup_date_to };

    const { count, rows } = await models.Load.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: models.User,
          as: 'owner',
          attributes: ['id', 'first_name', 'last_name', 'rating'],
        },
        {
          model: models.Bid,
          as: 'bids',
          attributes: ['id', 'proposed_price', 'status'],
        },
      ],
      order: [['created_at', 'DESC']],
      offset,
      limit,
    });

    return {
      total: count,
      page,
      totalPages: Math.ceil(count / limit),
      data: rows,
    };
  }

  // Subscription helpers
  static async checkSubscriptionLimits(userId: string) {
    const user = await models.User.findByPk(userId, {
      include: [{ model: models.Subscription, as: 'subscription' }],
    });

    if (!user || !user.subscription) {
      throw new Error('User or subscription not found');
    }

    const { subscription } = user;

    // Check if needs monthly reset
    const now = new Date();
    const lastReset = subscription.last_reset_date || subscription.start_date;
    
    if (lastReset) {
      const nextMonth = new Date(lastReset);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      
      if (now >= nextMonth) {
        // Reset monthly counters
        await subscription.update({
          loads_posted_this_month: 0,
          bids_placed_this_month: 0,
          last_reset_date: now,
        });
      }
    }

    return subscription;
  }

  // Trip helpers
  static async updateTripLocation(tripId: string, lat: number, lng: number) {
    const trip = await models.Trip.findByPk(tripId);
    
    if (!trip) throw new Error('Trip not found');
    
    const currentLocation = {
      lat,
      lng,
      timestamp: new Date(),
    };

    const route = trip.route || [];
    route.push(currentLocation);

    await trip.update({
      current_location: currentLocation,
      route,
    });

    // Update load status if not already in transit
    if (trip.status !== 'IN_PROGRESS') {
      await trip.update({ status: 'IN_PROGRESS' });
      await models.Load.update(
        { status: 'IN_TRANSIT' },
        { where: { id: trip.load_id } }
      );
    }

    return trip;
  }
}