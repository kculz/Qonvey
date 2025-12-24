// Load Management Service
// Location: backend/src/services/load.service.ts

import prisma from '@/config/database';
import { loggers } from '@/utils/logger';
import { subscriptionService } from '@/services/subscription.service';
import { notificationService } from '@/services/notification.service';
import { LoadStatus, VehicleType, Prisma } from '@prisma/client';
import type { CreateLoadData, LoadFilters } from '@/types/load.types';

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
    const load = await prisma.load.create({
      data: {
        ownerId,
        title: data.title,
        description: data.description,
        cargoType: data.cargoType,
        weight: data.weight,
        volume: data.volume,
        pickupLocation: data.pickupLocation as any,
        deliveryLocation: data.deliveryLocation as any,
        pickupDate: data.pickupDate,
        deliveryDate: data.deliveryDate,
        suggestedPrice: data.suggestedPrice,
        currency: data.currency || 'USD',
        vehicleTypes: data.vehicleTypes,
        images: data.images || [],
        documents: data.documents || [],
        requiresInsurance: data.requiresInsurance || false,
        fragile: data.fragile || false,
        expiresAt: data.expiresAt,
        status: 'DRAFT',
      },
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
    });

    loggers.load.created(load.id, ownerId, load.title);
    return load;
  }

  async updateLoad(loadId: string, ownerId: string, data: Partial<CreateLoadData>) {
    // Verify ownership
    const existingLoad = await prisma.load.findUnique({
      where: { id: loadId },
    });

    if (!existingLoad) {
      throw new Error('Load not found');
    }

    if (existingLoad.ownerId !== ownerId) {
      throw new Error('Unauthorized to update this load');
    }

    // Can't update if already assigned or in transit
    if (['ASSIGNED', 'IN_TRANSIT', 'DELIVERED'].includes(existingLoad.status)) {
      throw new Error('Cannot update load in current status');
    }

    const load = await prisma.load.update({
      where: { id: loadId },
      data: {
        ...(data.title && { title: data.title }),
        ...(data.description && { description: data.description }),
        ...(data.cargoType && { cargoType: data.cargoType }),
        ...(data.weight && { weight: data.weight }),
        ...(data.volume && { volume: data.volume }),
        ...(data.pickupLocation && { pickupLocation: data.pickupLocation as any }),
        ...(data.deliveryLocation && { deliveryLocation: data.deliveryLocation as any }),
        ...(data.pickupDate && { pickupDate: data.pickupDate }),
        ...(data.deliveryDate && { deliveryDate: data.deliveryDate }),
        ...(data.suggestedPrice !== undefined && { suggestedPrice: data.suggestedPrice }),
        ...(data.vehicleTypes && { vehicleTypes: data.vehicleTypes }),
        ...(data.images && { images: data.images }),
        ...(data.documents && { documents: data.documents }),
        ...(data.requiresInsurance !== undefined && { requiresInsurance: data.requiresInsurance }),
        ...(data.fragile !== undefined && { fragile: data.fragile }),
        ...(data.expiresAt && { expiresAt: data.expiresAt }),
      },
    });

    loggers.info('Load updated', { loadId, ownerId });
    return load;
  }

  async publishLoad(loadId: string, ownerId: string) {
    const load = await prisma.load.findUnique({
      where: { id: loadId },
    });

    if (!load) {
      throw new Error('Load not found');
    }

    if (load.ownerId !== ownerId) {
      throw new Error('Unauthorized');
    }

    if (load.status !== 'DRAFT') {
      throw new Error('Load already published');
    }

    const publishedLoad = await prisma.load.update({
      where: { id: loadId },
      data: {
        status: 'OPEN',
        publishedAt: new Date(),
      },
    });

    // Record load posted
    await subscriptionService.recordLoadPosted(ownerId);

    loggers.load.published(loadId, ownerId);

    // Notify relevant drivers (those with saved searches matching this load)
    await this.notifyMatchingDrivers(publishedLoad);

    return publishedLoad;
  }

  async deleteLoad(loadId: string, ownerId: string) {
    const load = await prisma.load.findUnique({
      where: { id: loadId },
      include: { bids: true },
    });

    if (!load) {
      throw new Error('Load not found');
    }

    if (load.ownerId !== ownerId) {
      throw new Error('Unauthorized');
    }

    // Can't delete if already assigned or in transit
    if (['ASSIGNED', 'IN_TRANSIT', 'DELIVERED'].includes(load.status)) {
      throw new Error('Cannot delete load in current status');
    }

    // Delete all bids first
    if (load.bids.length > 0) {
      await prisma.bid.deleteMany({
        where: { loadId },
      });
    }

    await prisma.load.delete({
      where: { id: loadId },
    });

    loggers.load.deleted(loadId, ownerId);
    return { success: true };
  }

  async cancelLoad(loadId: string, ownerId: string, reason?: string) {
    const load = await prisma.load.findUnique({
      where: { id: loadId },
    });

    if (!load) {
      throw new Error('Load not found');
    }

    if (load.ownerId !== ownerId) {
      throw new Error('Unauthorized');
    }

    const cancelledLoad = await prisma.load.update({
      where: { id: loadId },
      data: { status: 'CANCELLED' },
    });

    loggers.info('Load cancelled', { loadId, ownerId, reason });
    return cancelledLoad;
  }

  // ============================================
  // RETRIEVE
  // ============================================

  async getLoad(loadId: string, viewerId?: string) {
    const load = await prisma.load.findUnique({
      where: { id: loadId },
      include: {
        owner: {
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
        bids: {
          where: { status: 'PENDING' },
          include: {
            driver: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                rating: true,
                totalRatings: true,
              },
            },
            vehicle: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        trip: {
          include: {
            driver: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                phoneNumber: true,
                rating: true,
              },
            },
          },
        },
      },
    });

    if (!load) {
      throw new Error('Load not found');
    }

    // Increment view count if not owner
    if (viewerId && viewerId !== load.ownerId) {
      await prisma.load.update({
        where: { id: loadId },
        data: { viewCount: { increment: 1 } },
      });
    }

    return load;
  }

  async getUserLoads(userId: string, status?: LoadStatus) {
    return await prisma.load.findMany({
      where: {
        ownerId: userId,
        ...(status && { status }),
      },
      include: {
        bids: {
          where: { status: 'PENDING' },
          orderBy: { proposedPrice: 'asc' },
        },
        trip: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async searchLoads(filters: LoadFilters, userId?: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const where: Prisma.LoadWhereInput = {
      status: filters.status || 'OPEN',
    };

    // Apply filters
    if (filters.cargoType) {
      where.cargoType = { contains: filters.cargoType, mode: 'insensitive' };
    }

    if (filters.vehicleTypes && filters.vehicleTypes.length > 0) {
      where.vehicleTypes = { hasSome: filters.vehicleTypes };
    }

    if (filters.pickupCity) {
      where.pickupLocation = {
        path: ['city'],
        string_contains: filters.pickupCity,
      };
    }

    if (filters.deliveryCity) {
      where.deliveryLocation = {
        path: ['city'],
        string_contains: filters.deliveryCity,
      };
    }

    if (filters.minWeight) {
      where.weight = { gte: filters.minWeight };
    }

    if (filters.maxWeight) {
      where.weight = { ...where.weight, lte: filters.maxWeight };
    }

    if (filters.suggestedPrice && filters.minPrice) {
      where.suggestedPrice = { gte: filters.minPrice };
    }

    if (filters.suggestedPrice && filters.maxPrice) {
      where.suggestedPrice = { ...where.suggestedPrice, lte: filters.maxPrice };
    }

    if (filters.pickupDateFrom) {
      where.pickupDate = { gte: filters.pickupDateFrom };
    }

    if (filters.pickupDateTo) {
      where.pickupDate = { ...where.pickupDate, lte: filters.pickupDateTo };
    }

    if (filters.searchQuery) {
      where.OR = [
        { title: { contains: filters.searchQuery, mode: 'insensitive' } },
        { description: { contains: filters.searchQuery, mode: 'insensitive' } },
        { cargoType: { contains: filters.searchQuery, mode: 'insensitive' } },
      ];
    }

    // Get user's subscription for sorting
    let orderBy: Prisma.LoadOrderByWithRelationInput[] = [
      { publishedAt: 'desc' },
    ];

    if (userId) {
      const subscription = await subscriptionService.getUserSubscription(userId);
      const features = subscriptionService.getPlanFeatures(subscription.plan);

      // Apply priority sorting based on subscription
      if (features.topPlacement) {
        // Business tier sees featured loads first
        orderBy = [{ status: 'asc' }, { publishedAt: 'desc' }];
      }
    }

    const [loads, total] = await Promise.all([
      prisma.load.findMany({
        where,
        include: {
          owner: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              companyName: true,
              rating: true,
              subscription: {
                select: {
                  plan: true,
                },
              },
            },
          },
          bids: {
            where: { status: 'PENDING' },
            select: { id: true },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.load.count({ where }),
    ]);

    return {
      loads,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  // ============================================
  // LOAD TEMPLATES
  // ============================================

  async createLoadTemplate(userId: string, data: CreateLoadData, name: string) {
    return await prisma.loadTemplate.create({
      data: {
        userId,
        name,
        description: data.description,
        cargoType: data.cargoType,
        weight: data.weight,
        volume: data.volume,
        pickupLocation: data.pickupLocation as any,
        deliveryLocation: data.deliveryLocation as any,
        vehicleTypes: data.vehicleTypes,
      },
    });
  }

  async getUserTemplates(userId: string) {
    return await prisma.loadTemplate.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteTemplate(templateId: string, userId: string) {
    const template = await prisma.loadTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template || template.userId !== userId) {
      throw new Error('Template not found or unauthorized');
    }

    return await prisma.loadTemplate.delete({
      where: { id: templateId },
    });
  }

  async createLoadFromTemplate(userId: string, templateId: string, additionalData: Partial<CreateLoadData>) {
    const template = await prisma.loadTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template || template.userId !== userId) {
      throw new Error('Template not found or unauthorized');
    }

    const loadData: CreateLoadData = {
      title: additionalData.title || `${template.cargoType} Delivery`,
      description: template.description || '',
      cargoType: template.cargoType,
      weight: template.weight || 0,
      volume: template.volume,
      pickupLocation: template.pickupLocation as any,
      deliveryLocation: template.deliveryLocation as any,
      pickupDate: additionalData.pickupDate || new Date(),
      deliveryDate: additionalData.deliveryDate,
      suggestedPrice: additionalData.suggestedPrice,
      vehicleTypes: template.vehicleTypes,
      ...additionalData,
    };

    return await this.createLoad(userId, loadData);
  }

  // ============================================
  // SAVED SEARCHES
  // ============================================

  async createSavedSearch(userId: string, name: string, filters: LoadFilters, notifyOnNew = true) {
    return await prisma.savedSearch.create({
      data: {
        userId,
        name,
        filters: filters as any,
        notifyOnNew,
      },
    });
  }

  async getUserSavedSearches(userId: string) {
    return await prisma.savedSearch.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteSavedSearch(searchId: string, userId: string) {
    const search = await prisma.savedSearch.findUnique({
      where: { id: searchId },
    });

    if (!search || search.userId !== userId) {
      throw new Error('Saved search not found or unauthorized');
    }

    return await prisma.savedSearch.delete({
      where: { id: searchId },
    });
  }

  // ============================================
  // HELPERS
  // ============================================

  private async notifyMatchingDrivers(load: any) {
    // Find drivers with saved searches matching this load
    const savedSearches = await prisma.savedSearch.findMany({
      where: { notifyOnNew: true },
      include: { user: true },
    });

    for (const search of savedSearches) {
      const filters = search.filters as LoadFilters;
      let matches = true;

      // Check if load matches search criteria
      if (filters.cargoType && !load.cargoType.includes(filters.cargoType)) {
        matches = false;
      }

      if (filters.vehicleTypes && filters.vehicleTypes.length > 0) {
        const hasMatchingVehicle = load.vehicleTypes.some((vt: VehicleType) => 
          filters.vehicleTypes?.includes(vt)
        );
        if (!hasMatchingVehicle) matches = false;
      }

      if (matches) {
        await notificationService.sendPushNotification(search.userId, {
          title: 'New Load Available',
          body: `${load.title} - ${load.pickupLocation.city} to ${load.deliveryLocation.city}`,
          type: 'NEW_LOAD',
          data: { loadId: load.id },
        });
      }
    }
  }

  async getLoadStats(userId: string) {
    const [total, open, assigned, completed, cancelled] = await Promise.all([
      prisma.load.count({ where: { ownerId: userId } }),
      prisma.load.count({ where: { ownerId: userId, status: 'OPEN' } }),
      prisma.load.count({ where: { ownerId: userId, status: 'ASSIGNED' } }),
      prisma.load.count({ where: { ownerId: userId, status: 'DELIVERED' } }),
      prisma.load.count({ where: { ownerId: userId, status: 'CANCELLED' } }),
    ]);

    return { total, open, assigned, completed, cancelled };
  }
}

export const loadService = new LoadService();