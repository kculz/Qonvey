// Vehicle Management Service
// Location: backend/src/services/vehicle.service.ts

import prisma from '@/config/database';
import { loggers } from '@/utils/logger';
import { subscriptionService } from './subscription.service';
import { VehicleType } from '@prisma/client';
import type { CreateVehicleData, UpdateVehicleData } from '@/types/vehicle.types';

class VehicleService {
  // ============================================
  // CREATE & UPDATE
  // ============================================

  async createVehicle(ownerId: string, data: CreateVehicleData) {
    // Check if user can add vehicle
    const canAdd = await subscriptionService.canAddVehicle(ownerId);
    if (!canAdd.allowed) {
      throw new Error(canAdd.reason || 'Cannot add vehicle');
    }

    // Check if license plate already exists
    const existingVehicle = await prisma.vehicle.findUnique({
      where: { licensePlate: data.licensePlate.toUpperCase() },
    });

    if (existingVehicle) {
      throw new Error('License plate already registered');
    }

    // Validate year
    const currentYear = new Date().getFullYear();
    if (data.year < 1900 || data.year > currentYear + 1) {
      throw new Error('Invalid vehicle year');
    }

    const vehicle = await prisma.vehicle.create({
      data: {
        ownerId,
        type: data.type,
        make: data.make,
        model: data.model,
        year: data.year,
        licensePlate: data.licensePlate.toUpperCase(),
        color: data.color,
        capacity: data.capacity,
        volumeCapacity: data.volumeCapacity,
        images: data.images || [],
        insurance: data.insurance,
        registration: data.registration,
        isActive: true,
      },
    });

    loggers.info('Vehicle created', { vehicleId: vehicle.id, ownerId });
    return vehicle;
  }

  async updateVehicle(vehicleId: string, ownerId: string, data: UpdateVehicleData) {
    const existingVehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!existingVehicle) {
      throw new Error('Vehicle not found');
    }

    if (existingVehicle.ownerId !== ownerId) {
      throw new Error('Unauthorized');
    }

    // Validate year if provided
    if (data.year) {
      const currentYear = new Date().getFullYear();
      if (data.year < 1900 || data.year > currentYear + 1) {
        throw new Error('Invalid vehicle year');
      }
    }

    const vehicle = await prisma.vehicle.update({
      where: { id: vehicleId },
      data: {
        ...(data.type && { type: data.type }),
        ...(data.make && { make: data.make }),
        ...(data.model && { model: data.model }),
        ...(data.year && { year: data.year }),
        ...(data.color && { color: data.color }),
        ...(data.capacity && { capacity: data.capacity }),
        ...(data.volumeCapacity !== undefined && { volumeCapacity: data.volumeCapacity }),
        ...(data.images && { images: data.images }),
        ...(data.insurance && { insurance: data.insurance }),
        ...(data.registration && { registration: data.registration }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });

    loggers.info('Vehicle updated', { vehicleId, ownerId });
    return vehicle;
  }

  async deleteVehicle(vehicleId: string, ownerId: string) {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: {
        bids: {
          where: {
            status: 'PENDING',
          },
        },
      },
    });

    if (!vehicle) {
      throw new Error('Vehicle not found');
    }

    if (vehicle.ownerId !== ownerId) {
      throw new Error('Unauthorized');
    }

    // Check if vehicle has pending bids
    if (vehicle.bids.length > 0) {
      throw new Error('Cannot delete vehicle with pending bids. Please withdraw bids first.');
    }

    await prisma.vehicle.delete({
      where: { id: vehicleId },
    });

    loggers.info('Vehicle deleted', { vehicleId, ownerId });
    return { success: true };
  }

  async deactivateVehicle(vehicleId: string, ownerId: string) {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!vehicle) {
      throw new Error('Vehicle not found');
    }

    if (vehicle.ownerId !== ownerId) {
      throw new Error('Unauthorized');
    }

    return await prisma.vehicle.update({
      where: { id: vehicleId },
      data: { isActive: false },
    });
  }

  async activateVehicle(vehicleId: string, ownerId: string) {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!vehicle) {
      throw new Error('Vehicle not found');
    }

    if (vehicle.ownerId !== ownerId) {
      throw new Error('Unauthorized');
    }

    // Check if user can activate (subscription limit)
    const canAdd = await subscriptionService.canAddVehicle(ownerId);
    if (!canAdd.allowed) {
      throw new Error(canAdd.reason || 'Cannot activate vehicle');
    }

    return await prisma.vehicle.update({
      where: { id: vehicleId },
      data: { isActive: true },
    });
  }

  // ============================================
  // RETRIEVE
  // ============================================

  async getVehicle(vehicleId: string) {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            companyName: true,
            phoneNumber: true,
            rating: true,
          },
        },
        bids: {
          where: { status: 'PENDING' },
          select: {
            id: true,
            loadId: true,
            proposedPrice: true,
          },
        },
      },
    });

    if (!vehicle) {
      throw new Error('Vehicle not found');
    }

    return vehicle;
  }

  async getUserVehicles(userId: string, activeOnly = false) {
    return await prisma.vehicle.findMany({
      where: {
        ownerId: userId,
        ...(activeOnly && { isActive: true }),
      },
      include: {
        bids: {
          where: { status: 'PENDING' },
          select: {
            id: true,
          },
        },
      },
      orderBy: [
        { isActive: 'desc' },
        { createdAt: 'desc' },
      ],
    });
  }

  async searchVehicles(filters: {
    type?: VehicleType;
    minCapacity?: number;
    maxCapacity?: number;
    ownerId?: string;
  }) {
    return await prisma.vehicle.findMany({
      where: {
        isActive: true,
        ...(filters.type && { type: filters.type }),
        ...(filters.minCapacity && { capacity: { gte: filters.minCapacity } }),
        ...(filters.maxCapacity && { capacity: { lte: filters.maxCapacity } }),
        ...(filters.ownerId && { ownerId: filters.ownerId }),
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
      orderBy: { createdAt: 'desc' },
    });
  }

  // ============================================
  // VEHICLE DOCUMENTS
  // ============================================

  async uploadInsurance(vehicleId: string, ownerId: string, insuranceUrl: string) {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!vehicle) {
      throw new Error('Vehicle not found');
    }

    if (vehicle.ownerId !== ownerId) {
      throw new Error('Unauthorized');
    }

    return await prisma.vehicle.update({
      where: { id: vehicleId },
      data: { insurance: insuranceUrl },
    });
  }

  async uploadRegistration(vehicleId: string, ownerId: string, registrationUrl: string) {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!vehicle) {
      throw new Error('Vehicle not found');
    }

    if (vehicle.ownerId !== ownerId) {
      throw new Error('Unauthorized');
    }

    return await prisma.vehicle.update({
      where: { id: vehicleId },
      data: { registration: registrationUrl },
    });
  }

  async uploadImages(vehicleId: string, ownerId: string, imageUrls: string[]) {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!vehicle) {
      throw new Error('Vehicle not found');
    }

    if (vehicle.ownerId !== ownerId) {
      throw new Error('Unauthorized');
    }

    // Append new images to existing ones
    const updatedImages = [...vehicle.images, ...imageUrls];

    return await prisma.vehicle.update({
      where: { id: vehicleId },
      data: { images: updatedImages },
    });
  }

  async removeImage(vehicleId: string, ownerId: string, imageUrl: string) {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!vehicle) {
      throw new Error('Vehicle not found');
    }

    if (vehicle.ownerId !== ownerId) {
      throw new Error('Unauthorized');
    }

    const updatedImages = vehicle.images.filter(img => img !== imageUrl);

    return await prisma.vehicle.update({
      where: { id: vehicleId },
      data: { images: updatedImages },
    });
  }

  // ============================================
  // ANALYTICS
  // ============================================

  async getVehicleStats(vehicleId: string) {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!vehicle) {
      throw new Error('Vehicle not found');
    }

    const [totalBids, acceptedBids, completedTrips] = await Promise.all([
      prisma.bid.count({
        where: { vehicleId },
      }),
      prisma.bid.count({
        where: { vehicleId, status: 'ACCEPTED' },
      }),
      prisma.trip.count({
        where: {
          bid: { vehicleId },
          status: 'COMPLETED',
        },
      }),
    ]);

    // Calculate total earnings
    const earnings = await prisma.trip.aggregate({
      where: {
        bid: { vehicleId },
        status: 'COMPLETED',
      },
      _sum: { agreedPrice: true },
    });

    return {
      totalBids,
      acceptedBids,
      completedTrips,
      totalEarnings: earnings._sum.agreedPrice || 0,
      acceptanceRate: totalBids > 0 ? Math.round((acceptedBids / totalBids) * 100) : 0,
    };
  }

  async getUserVehicleStats(userId: string) {
    const vehicles = await prisma.vehicle.count({
      where: { ownerId: userId },
    });

    const activeVehicles = await prisma.vehicle.count({
      where: { ownerId: userId, isActive: true },
    });

    return {
      totalVehicles: vehicles,
      activeVehicles,
      inactiveVehicles: vehicles - activeVehicles,
    };
  }

  // ============================================
  // VALIDATION
  // ============================================

  async validateVehicleForBid(vehicleId: string, loadId: string) {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!vehicle) {
      throw new Error('Vehicle not found');
    }

    if (!vehicle.isActive) {
      throw new Error('Vehicle is not active');
    }

    // Check if vehicle has required documents
    if (!vehicle.insurance) {
      throw new Error('Vehicle insurance document required');
    }

    if (!vehicle.registration) {
      throw new Error('Vehicle registration document required');
    }

    // Get load to check vehicle type requirements
    const load = await prisma.load.findUnique({
      where: { id: loadId },
    });

    if (!load) {
      throw new Error('Load not found');
    }

    // Check if vehicle type matches load requirements
    if (!load.vehicleTypes.includes(vehicle.type)) {
      throw new Error('Vehicle type does not match load requirements');
    }

    // Check if vehicle capacity is sufficient
    if (vehicle.capacity < load.weight) {
      throw new Error('Vehicle capacity insufficient for this load');
    }

    return { valid: true };
  }

  async getAvailableVehiclesForLoad(loadId: string, driverId: string) {
    const load = await prisma.load.findUnique({
      where: { id: loadId },
    });

    if (!load) {
      throw new Error('Load not found');
    }

    return await prisma.vehicle.findMany({
      where: {
        ownerId: driverId,
        isActive: true,
        type: { in: load.vehicleTypes },
        capacity: { gte: load.weight },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ============================================
  // HELPERS
  // ============================================

  getVehicleTypeDescription(type: VehicleType): string {
    const descriptions: Record<VehicleType, string> = {
      PICKUP: 'Pickup Truck - Light cargo transport',
      SMALL_TRUCK: 'Small Truck - Up to 3 tons',
      MEDIUM_TRUCK: 'Medium Truck - 3-7 tons',
      LARGE_TRUCK: 'Large Truck - 7+ tons',
      FLATBED: 'Flatbed - Open platform for oversized loads',
      REFRIGERATED: 'Refrigerated Truck - Temperature controlled',
      CONTAINER: 'Container Truck - 20ft/40ft containers',
    };

    return descriptions[type] || type;
  }

  async getVehicleUsageHistory(vehicleId: string, limit = 20) {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!vehicle) {
      throw new Error('Vehicle not found');
    }

    return await prisma.trip.findMany({
      where: {
        bid: { vehicleId },
        status: { in: ['COMPLETED', 'CANCELLED'] },
      },
      include: {
        load: {
          select: {
            id: true,
            title: true,
            pickupLocation: true,
            deliveryLocation: true,
            weight: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}

export const vehicleService = new VehicleService();