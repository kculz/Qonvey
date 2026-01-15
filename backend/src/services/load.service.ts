// backend/src/services/load.service.ts

import { Op } from 'sequelize';
import { loggers } from '../utils/logger';
import { subscriptionService } from './subscription.service';
import { notificationService } from './notification.service';
import type { CreateLoadData, LoadFilters } from '../types/load.types';
import Load from '@/models/load.model';
import Bid from '@/models/bid.model';
import LoadTemplate from '@/models/load-template.model';
import SavedSearch from '@/models/saved-search.model';

export enum LoadStatus {
  DRAFT = 'DRAFT',
  OPEN = 'OPEN',
  BIDDING_CLOSED = 'BIDDING_CLOSED',
  ASSIGNED = 'ASSIGNED',
  IN_TRANSIT = 'IN_TRANSIT',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

export enum VehicleType {
  PICKUP = 'PICKUP',
  SMALL_TRUCK = 'SMALL_TRUCK',
  MEDIUM_TRUCK = 'MEDIUM_TRUCK',
  LARGE_TRUCK = 'LARGE_TRUCK',
  FLATBED = 'FLATBED',
  REFRIGERATED = 'REFRIGERATED',
  CONTAINER = 'CONTAINER',
}

class LoadService {
  // ============================================
  // CREATE & UPDATE
  // ============================================

  async createLoad(ownerId: string, data: CreateLoadData) {
    // Check if user can post load
    const canPost = await subscriptionService.canPostLoad(ownerId);
    if (!canPost.allowed) {
      throw new Error(canPost.reason || 'Cannot post load');
    }

    // Create load as draft
    const load = await Load.create({
      owner_id: ownerId,
      title: data.title,
      description: data.description,
      cargo_type: data.cargoType,
      weight: data.weight,
      volume: data.volume,
      pickup_location: data.pickupLocation,
      delivery_location: data.deliveryLocation,
      pickup_date: data.pickupDate,
      delivery_date: data.deliveryDate,
      suggested_price: data.suggestedPrice,
      currency: data.currency || 'USD',
      vehicle_types: data.vehicleTypes,
      images: data.images || [],
      documents: data.documents || [],
      requires_insurance: data.requiresInsurance || false,
      fragile: data.fragile || false,
      expires_at: data.expiresAt,
      status: 'DRAFT',
    } as any);

    // Fetch load with owner relationship
    const loadWithOwner = await Load.findByPk(load.id, {
      include: [{
        association: 'owner',
        attributes: ['id', 'first_name', 'last_name', 'company_name', 'rating'],
      }],
    });

    if (!loadWithOwner) {
      throw new Error('Failed to create load');
    }

    loggers.load.created(load.id, ownerId, load.title);
    return loadWithOwner;
  }

  async updateLoad(loadId: string, ownerId: string, data: Partial<CreateLoadData>) {
    // Verify ownership
    const existingLoad = await Load.findByPk(loadId);

    if (!existingLoad) {
      throw new Error('Load not found');
    }

    if (existingLoad.owner_id !== ownerId) {
      throw new Error('Unauthorized to update this load');
    }

    // Can't update if already assigned or in transit
    if (['ASSIGNED', 'IN_TRANSIT', 'DELIVERED'].includes(existingLoad.status)) {
      throw new Error('Cannot update load in current status');
    }

    const updateData: any = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.cargoType !== undefined) updateData.cargo_type = data.cargoType;
    if (data.weight !== undefined) updateData.weight = data.weight;
    if (data.volume !== undefined) updateData.volume = data.volume;
    if (data.pickupLocation !== undefined) updateData.pickup_location = data.pickupLocation;
    if (data.deliveryLocation !== undefined) updateData.delivery_location = data.deliveryLocation;
    if (data.pickupDate !== undefined) updateData.pickup_date = data.pickupDate;
    if (data.deliveryDate !== undefined) updateData.delivery_date = data.deliveryDate;
    if (data.suggestedPrice !== undefined) updateData.suggested_price = data.suggestedPrice;
    if (data.vehicleTypes !== undefined) updateData.vehicle_types = data.vehicleTypes;
    if (data.images !== undefined) updateData.images = data.images;
    if (data.documents !== undefined) updateData.documents = data.documents;
    if (data.requiresInsurance !== undefined) updateData.requires_insurance = data.requiresInsurance;
    if (data.fragile !== undefined) updateData.fragile = data.fragile;
    if (data.expiresAt !== undefined) updateData.expires_at = data.expiresAt;

    await existingLoad.update(updateData);
    loggers.info('Load updated', { loadId, ownerId });
    return existingLoad;
  }

  async publishLoad(loadId: string, ownerId: string) {
    const load = await Load.findByPk(loadId);

    if (!load) {
      throw new Error('Load not found');
    }

    if (load.owner_id !== ownerId) {
      throw new Error('Unauthorized');
    }

    if (load.status !== 'DRAFT') {
      throw new Error('Load already published');
    }

    await load.update({
      status: 'OPEN',
      published_at: new Date(),
    });

    // Record load posted
    await subscriptionService.recordLoadPosted(ownerId);

    loggers.load.published(loadId, ownerId);

    // Notify relevant drivers (those with saved searches matching this load)
    await this.notifyMatchingDrivers(load);

    return load;
  }

  async deleteLoad(loadId: string, ownerId: string) {
    const load = await Load.findByPk(loadId, {
      include: [{
        association: 'bids',
      }],
    });

    if (!load) {
      throw new Error('Load not found');
    }

    if (load.owner_id !== ownerId) {
      throw new Error('Unauthorized');
    }

    // Can't delete if already assigned or in transit
    if (['ASSIGNED', 'IN_TRANSIT', 'DELIVERED'].includes(load.status)) {
      throw new Error('Cannot delete load in current status');
    }

    // Delete all bids first
    if (load.bids && load.bids.length > 0) {
      await Bid.destroy({
        where: { load_id: loadId },
      });
    }

    await load.destroy();
    loggers.load.deleted(loadId, ownerId);
    return { success: true };
  }

  async cancelLoad(loadId: string, ownerId: string, reason?: string) {
    const load = await Load.findByPk(loadId);

    if (!load) {
      throw new Error('Load not found');
    }

    if (load.owner_id !== ownerId) {
      throw new Error('Unauthorized');
    }

    await load.update({ status: 'CANCELLED' });
    loggers.info('Load cancelled', { loadId, ownerId, reason });
    return load;
  }

  // ============================================
  // RETRIEVE
  // ============================================

  async getLoad(loadId: string, viewerId?: string) {
    const load = await Load.findByPk(loadId, {
      include: [
        {
          association: 'owner',
          attributes: ['id', 'first_name', 'last_name', 'company_name', 'rating', 'total_ratings', 'phone_verified', 'email_verified'],
        },
        {
          association: 'bids',
          where: { status: 'PENDING' },
          required: false,
          include: [
            {
              association: 'driver',
              attributes: ['id', 'first_name', 'last_name', 'rating', 'total_ratings'],
            },
            {
              association: 'vehicle',
            },
          ],
        },
        {
          association: 'trip',
          include: [{
            association: 'driver',
            attributes: ['id', 'first_name', 'last_name', 'phone_number', 'rating'],
          }],
        },
      ],
    });

    if (!load) {
      throw new Error('Load not found');
    }

    // Increment view count if not owner
    if (viewerId && viewerId !== load.owner_id) {
      await load.increment('view_count');
    }

    return load;
  }

  async getUserLoads(userId: string, status?: LoadStatus) {
    const whereClause: any = { owner_id: userId };
    if (status) {
      whereClause.status = status;
    }

    return await Load.findAll({
      where: whereClause,
      include: [
        {
          association: 'bids',
          where: { status: 'PENDING' },
          required: false,
        },
        {
          association: 'trip',
        },
      ],
      order: [['created_at', 'DESC']],
    });
  }

  async searchLoads(filters: LoadFilters, userId?: string, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    const whereClause: any = {
      status: filters.status || 'OPEN',
    };

    // Apply filters
    if (filters.cargoType) {
      whereClause.cargo_type = { [Op.iLike]: `%${filters.cargoType}%` };
    }

    if (filters.vehicleTypes && filters.vehicleTypes.length > 0) {
      whereClause.vehicle_types = { [Op.overlap]: filters.vehicleTypes };
    }

    if (filters.pickupCity) {
      whereClause['$pickup_location.city$'] = { [Op.iLike]: `%${filters.pickupCity}%` };
    }

    if (filters.deliveryCity) {
      whereClause['$delivery_location.city$'] = { [Op.iLike]: `%${filters.deliveryCity}%` };
    }

    if (filters.minWeight) {
      whereClause.weight = { [Op.gte]: filters.minWeight };
    }

    if (filters.maxWeight) {
      whereClause.weight = { ...whereClause.weight, [Op.lte]: filters.maxWeight };
    }

    if (filters.minPrice) {
      whereClause.suggested_price = { [Op.gte]: filters.minPrice };
    }

    if (filters.maxPrice) {
      whereClause.suggested_price = { ...whereClause.suggested_price, [Op.lte]: filters.maxPrice };
    }

    if (filters.pickupDateFrom) {
      whereClause.pickup_date = { [Op.gte]: filters.pickupDateFrom };
    }

    if (filters.pickupDateTo) {
      whereClause.pickup_date = { ...whereClause.pickup_date, [Op.lte]: filters.pickupDateTo };
    }

    if (filters.searchQuery) {
      whereClause[Op.or] = [
        { title: { [Op.iLike]: `%${filters.searchQuery}%` } },
        { description: { [Op.iLike]: `%${filters.searchQuery}%` } },
        { cargo_type: { [Op.iLike]: `%${filters.searchQuery}%` } },
      ];
    }

    // Get user's subscription for sorting
    let order: any[] = [['published_at', 'DESC']];

    if (userId) {
      const subscription = await subscriptionService.getUserSubscription(userId);
      const features = subscriptionService.getPlanFeatures(subscription.plan);

      // Apply priority sorting based on subscription
      if (features.topPlacement) {
        // Business tier sees featured loads first
        order = [['status', 'ASC'], ['published_at', 'DESC']];
      }
    }

    const { count, rows: loads } = await Load.findAndCountAll({
      where: whereClause,
      include: [
        {
          association: 'owner',
          attributes: ['id', 'first_name', 'last_name', 'company_name', 'rating'],
          include: [{
            association: 'subscription',
            attributes: ['plan'],
          }],
        },
        {
          association: 'bids',
          where: { status: 'PENDING' },
          required: false,
          attributes: ['id'],
        },
      ],
      order,
      offset,
      limit,
    });

    return {
      loads,
      pagination: {
        total: count,
        page,
        limit,
        pages: Math.ceil(count / limit),
      },
    };
  }

  // ============================================
  // LOAD TEMPLATES
  // ============================================

  async createLoadTemplate(userId: string, data: CreateLoadData, name: string) {
    return await LoadTemplate.create({
      user_id: userId,
      name,
      description: data.description,
      cargo_type: data.cargoType,
      weight: data.weight,
      volume: data.volume,
      pickup_location: data.pickupLocation,
      delivery_location: data.deliveryLocation,
      vehicle_types: data.vehicleTypes,
    } as any);
  }

  async getUserTemplates(userId: string) {
    return await LoadTemplate.findAll({
      where: { user_id: userId },
      order: [['created_at', 'DESC']],
    });
  }

  async deleteTemplate(templateId: string, userId: string) {
    const template = await LoadTemplate.findByPk(templateId);

    if (!template || template.user_id !== userId) {
      throw new Error('Template not found or unauthorized');
    }

    await template.destroy();
    return template;
  }

  async createLoadFromTemplate(userId: string, templateId: string, additionalData: Partial<CreateLoadData>) {
    const template = await LoadTemplate.findByPk(templateId);

    if (!template || template.user_id !== userId) {
      throw new Error('Template not found or unauthorized');
    }

    const loadData: CreateLoadData = {
      title: additionalData.title || `${template.cargo_type} Delivery`,
      description: template.description || '',
      cargoType: template.cargo_type,
      weight: template.weight || 0,
      volume: template.volume,
      pickupLocation: template.pickup_location as any,
      deliveryLocation: template.delivery_location as any,
      pickupDate: additionalData.pickupDate || new Date(),
      deliveryDate: additionalData.deliveryDate,
      suggestedPrice: additionalData.suggestedPrice,
      vehicleTypes: template.vehicle_types,
      ...additionalData,
    };

    return await this.createLoad(userId, loadData);
  }

  // ============================================
  // SAVED SEARCHES
  // ============================================

  async createSavedSearch(userId: string, name: string, filters: LoadFilters, notifyOnNew = true) {
    return await SavedSearch.create({
      user_id: userId,
      name,
      filters: filters as any,
      notify_on_new: notifyOnNew,
    } as any);
  }

  async getUserSavedSearches(userId: string) {
    return await SavedSearch.findAll({
      where: { user_id: userId },
      order: [['created_at', 'DESC']],
    });
  }

  async deleteSavedSearch(searchId: string, userId: string) {
    const search = await SavedSearch.findByPk(searchId);

    if (!search || search.user_id !== userId) {
      throw new Error('Saved search not found or unauthorized');
    }

    await search.destroy();
    return search;
  }

  // ============================================
  // HELPERS
  // ============================================

  private async notifyMatchingDrivers(load: any) {
    // Find drivers with saved searches matching this load
    const savedSearches = await SavedSearch.findAll({
      where: { notify_on_new: true },
      include: [{
        association: 'user',
      }],
    });

    for (const search of savedSearches) {
      const filters = search.filters as LoadFilters;
      let matches = true;

      // Check if load matches search criteria
      if (filters.cargoType && !load.cargo_type.includes(filters.cargoType)) {
        matches = false;
      }

      if (filters.vehicleTypes && filters.vehicleTypes.length > 0) {
        const hasMatchingVehicle = load.vehicle_types.some((vt: VehicleType) => 
          filters.vehicleTypes?.includes(vt)
        );
        if (!hasMatchingVehicle) matches = false;
      }

      if (matches) {
        await notificationService.sendPushNotification(search.user_id, {
          title: 'New Load Available',
          body: `${load.title} - ${load.pickup_location.city} to ${load.delivery_location.city}`,
          type: 'NEW_LOAD',
          data: { loadId: load.id },
        });
      }
    }
  }

  async getLoadStats(userId: string) {
    const [
      total,
      open,
      assigned,
      completed,
      cancelled
    ] = await Promise.all([
      Load.count({ where: { owner_id: userId } }),
      Load.count({ where: { owner_id: userId, status: 'OPEN' } }),
      Load.count({ where: { owner_id: userId, status: 'ASSIGNED' } }),
      Load.count({ where: { owner_id: userId, status: 'DELIVERED' } }),
      Load.count({ where: { owner_id: userId, status: 'CANCELLED' } }),
    ]);

    return { total, open, assigned, completed, cancelled };
  }

  // ============================================
  // NEW METHODS FOR SEQUELIZE
  // ============================================

  async getFeaturedLoads(limit = 10) {
    return await Load.findAll({
      where: {
        status: 'OPEN',
      },
      include: [
        {
          association: 'owner',
          attributes: ['id', 'first_name', 'last_name', 'company_name', 'rating'],
        },
      ],
      order: [['view_count', 'DESC']],
      limit,
    });
  }

  async getNearbyLoads(lat: number, lng: number, radiusKm = 50, limit = 20) {
    // This is a simplified implementation
    // In production, you'd use PostGIS for proper geospatial queries
    return await Load.findAll({
      where: {
        status: 'OPEN',
      },
      include: [
        {
          association: 'owner',
          attributes: ['id', 'first_name', 'last_name'],
        },
      ],
      limit,
    });
  }

  async updateLoadStatus(loadId: string, status: LoadStatus) {
    const load = await Load.findByPk(loadId);
    
    if (!load) {
      throw new Error('Load not found');
    }

    await load.update({ status });
    return load;
  }
}

export const loadService = new LoadService();