// Vehicle Management Service - Sequelize Version
// Location: backend/src/services/vehicle.service.ts

import { Op, Sequelize } from 'sequelize';
import { loggers } from '@/utils/logger';
import { subscriptionService } from './subscription.service';
import type { CreateVehicleData, UpdateVehicleData } from '@/types/vehicle.types';
import Vehicle from '@/models/vehicle.model';
import User from '@/models/user.model';
import Bid from '@/models/bid.model';
import Trip from '@/models/trip.model';
import Load from '@/models/load.model';

// VehicleType enum (from your Prisma schema)
export enum VehicleType {
  PICKUP = 'PICKUP',
  SMALL_TRUCK = 'SMALL_TRUCK',
  MEDIUM_TRUCK = 'MEDIUM_TRUCK',
  LARGE_TRUCK = 'LARGE_TRUCK',
  FLATBED = 'FLATBED',
  REFRIGERATED = 'REFRIGERATED',
  CONTAINER = 'CONTAINER'
}

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
    const existingVehicle = await Vehicle.findOne({
      where: { license_plate: data.licensePlate.toUpperCase() },
    });

    if (existingVehicle) {
      throw new Error('License plate already registered');
    }

    // Validate year
    const currentYear = new Date().getFullYear();
    if (data.year < 1900 || data.year > currentYear + 1) {
      throw new Error('Invalid vehicle year');
    }

    const vehicle = await Vehicle.create({
      owner_id: ownerId,
      type: data.type,
      make: data.make,
      model: data.model,
      year: data.year,
      license_plate: data.licensePlate.toUpperCase(),
      color: data.color,
      capacity: data.capacity,
      volume_capacity: data.volumeCapacity,
      images: data.images || [],
      insurance: data.insurance,
      registration: data.registration,
      is_active: true,
    });

    loggers.info('Vehicle created', { vehicleId: vehicle.id, ownerId });
    return vehicle;
  }

  async updateVehicle(vehicleId: string, ownerId: string, data: UpdateVehicleData) {
    const existingVehicle = await Vehicle.findByPk(vehicleId);

    if (!existingVehicle) {
      throw new Error('Vehicle not found');
    }

    if (existingVehicle.owner_id !== ownerId) {
      throw new Error('Unauthorized');
    }

    // Validate year if provided
    if (data.year) {
      const currentYear = new Date().getFullYear();
      if (data.year < 1900 || data.year > currentYear + 1) {
        throw new Error('Invalid vehicle year');
      }
    }

    const updateData: any = {};
    if (data.type) updateData.type = data.type;
    if (data.make) updateData.make = data.make;
    if (data.model) updateData.model = data.model;
    if (data.year) updateData.year = data.year;
    if (data.color) updateData.color = data.color;
    if (data.capacity) updateData.capacity = data.capacity;
    if (data.volumeCapacity !== undefined) updateData.volume_capacity = data.volumeCapacity;
    if (data.images) updateData.images = data.images;
    if (data.insurance) updateData.insurance = data.insurance;
    if (data.registration) updateData.registration = data.registration;
    if (data.isActive !== undefined) updateData.is_active = data.isActive;

    await existingVehicle.update(updateData);

    loggers.info('Vehicle updated', { vehicleId, ownerId });
    return existingVehicle;
  }

  async deleteVehicle(vehicleId: string, ownerId: string) {
    const vehicle = await Vehicle.findByPk(vehicleId, {
      include: [{
        association: 'bids',
        where: { status: 'PENDING' },
        required: false, // Use required: false to get vehicle even if no bids
      }],
    });

    if (!vehicle) {
      throw new Error('Vehicle not found');
    }

    if (vehicle.owner_id !== ownerId) {
      throw new Error('Unauthorized');
    }

    // Check if vehicle has pending bids
    if (vehicle.bids && vehicle.bids.length > 0) {
      throw new Error('Cannot delete vehicle with pending bids. Please withdraw bids first.');
    }

    await vehicle.destroy();

    loggers.info('Vehicle deleted', { vehicleId, ownerId });
    return { success: true };
  }

  async deactivateVehicle(vehicleId: string, ownerId: string) {
    const vehicle = await Vehicle.findByPk(vehicleId);

    if (!vehicle) {
      throw new Error('Vehicle not found');
    }

    if (vehicle.owner_id !== ownerId) {
      throw new Error('Unauthorized');
    }

    await vehicle.update({ is_active: false });
    return vehicle;
  }

  async activateVehicle(vehicleId: string, ownerId: string) {
    const vehicle = await Vehicle.findByPk(vehicleId);

    if (!vehicle) {
      throw new Error('Vehicle not found');
    }

    if (vehicle.owner_id !== ownerId) {
      throw new Error('Unauthorized');
    }

    // Check if user can activate (subscription limit)
    const canAdd = await subscriptionService.canAddVehicle(ownerId);
    if (!canAdd.allowed) {
      throw new Error(canAdd.reason || 'Cannot activate vehicle');
    }

    await vehicle.update({ is_active: true });
    return vehicle;
  }

  // ============================================
  // RETRIEVE
  // ============================================

  async getVehicle(vehicleId: string) {
    const vehicle = await Vehicle.findByPk(vehicleId, {
      include: [
        {
          association: 'owner',
          attributes: ['id', 'first_name', 'last_name', 'company_name', 'phone_number', 'rating'],
        },
        {
          association: 'bids',
          where: { status: 'PENDING' },
          required: false,
          attributes: ['id', 'load_id', 'proposed_price'],
        },
      ],
    });

    if (!vehicle) {
      throw new Error('Vehicle not found');
    }

    return vehicle;
  }

  async getUserVehicles(userId: string, activeOnly = false) {
    const whereClause: any = { owner_id: userId };
    if (activeOnly) {
      whereClause.is_active = true;
    }

    return await Vehicle.findAll({
      where: whereClause,
      include: [{
        association: 'bids',
        where: { status: 'PENDING' },
        required: false,
        attributes: ['id'],
      }],
      order: [
        ['is_active', 'DESC'],
        ['created_at', 'DESC'],
      ],
    });
  }

  async searchVehicles(filters: {
    type?: VehicleType;
    minCapacity?: number;
    maxCapacity?: number;
    ownerId?: string;
  }) {
    const whereClause: any = { is_active: true };
    
    if (filters.type) whereClause.type = filters.type;
    if (filters.minCapacity) whereClause.capacity = { [Op.gte]: filters.minCapacity };
    if (filters.maxCapacity) whereClause.capacity = { ...whereClause.capacity, [Op.lte]: filters.maxCapacity };
    if (filters.ownerId) whereClause.owner_id = filters.ownerId;

    return await Vehicle.findAll({
      where: whereClause,
      include: [{
        association: 'owner',
        attributes: ['id', 'first_name', 'last_name', 'company_name', 'rating'],
      }],
      order: [['created_at', 'DESC']],
    });
  }

  // ============================================
  // VEHICLE DOCUMENTS
  // ============================================

  async uploadInsurance(vehicleId: string, ownerId: string, insuranceUrl: string) {
    const vehicle = await Vehicle.findByPk(vehicleId);

    if (!vehicle) {
      throw new Error('Vehicle not found');
    }

    if (vehicle.owner_id !== ownerId) {
      throw new Error('Unauthorized');
    }

    await vehicle.update({ insurance: insuranceUrl });
    return vehicle;
  }

  async uploadRegistration(vehicleId: string, ownerId: string, registrationUrl: string) {
    const vehicle = await Vehicle.findByPk(vehicleId);

    if (!vehicle) {
      throw new Error('Vehicle not found');
    }

    if (vehicle.owner_id !== ownerId) {
      throw new Error('Unauthorized');
    }

    await vehicle.update({ registration: registrationUrl });
    return vehicle;
  }

  async uploadImages(vehicleId: string, ownerId: string, imageUrls: string[]) {
    const vehicle = await Vehicle.findByPk(vehicleId);

    if (!vehicle) {
      throw new Error('Vehicle not found');
    }

    if (vehicle.owner_id !== ownerId) {
      throw new Error('Unauthorized');
    }

    // Append new images to existing ones
    const updatedImages = [...vehicle.images, ...imageUrls];

    await vehicle.update({ images: updatedImages });
    return vehicle;
  }

  async removeImage(vehicleId: string, ownerId: string, imageUrl: string) {
    const vehicle = await Vehicle.findByPk(vehicleId);

    if (!vehicle) {
      throw new Error('Vehicle not found');
    }

    if (vehicle.owner_id !== ownerId) {
      throw new Error('Unauthorized');
    }

    const updatedImages = vehicle.images.filter(img => img !== imageUrl);

    await vehicle.update({ images: updatedImages });
    return vehicle;
  }

  // ============================================
  // ANALYTICS
  // ============================================

  async getVehicleStats(vehicleId: string) {
    const vehicle = await Vehicle.findByPk(vehicleId);

    if (!vehicle) {
      throw new Error('Vehicle not found');
    }

    const [totalBids, acceptedBids, completedTrips] = await Promise.all([
      Bid.count({
        where: { vehicle_id: vehicleId },
      }),
      Bid.count({
        where: { 
          vehicle_id: vehicleId, 
          status: 'ACCEPTED' 
        },
      }),
      Trip.count({
        where: {
          '$bid.vehicle_id$': vehicleId,
          status: 'COMPLETED',
        },
        include: [{
          association: 'bid',
          where: { vehicle_id: vehicleId },
          required: true,
        }],
      }),
    ]);

    // Calculate total earnings
    const earnings = await Trip.findOne({
      attributes: [
        [Sequelize.fn('SUM', Sequelize.col('agreed_price')), 'total']
      ],
      where: {
        '$bid.vehicle_id$': vehicleId,
        status: 'COMPLETED',
      },
      include: [{
        association: 'bid',
        where: { vehicle_id: vehicleId },
        required: true,
      }],
      raw: true,
    }) as any;

    const totalEarnings = earnings?.total || 0;

    return {
      totalBids,
      acceptedBids,
      completedTrips,
      totalEarnings,
      acceptanceRate: totalBids > 0 ? Math.round((acceptedBids / totalBids) * 100) : 0,
    };
  }

  async getUserVehicleStats(userId: string) {
    const [vehicles, activeVehicles] = await Promise.all([
      Vehicle.count({
        where: { owner_id: userId },
      }),
      Vehicle.count({
        where: { 
          owner_id: userId, 
          is_active: true 
        },
      }),
    ]);

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
    const vehicle = await Vehicle.findByPk(vehicleId);

    if (!vehicle) {
      throw new Error('Vehicle not found');
    }

    if (!vehicle.is_active) {
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
    const load = await Load.findByPk(loadId);

    if (!load) {
      throw new Error('Load not found');
    }

    // Check if vehicle type matches load requirements
    if (!load.vehicle_types.includes(vehicle.type)) {
      throw new Error('Vehicle type does not match load requirements');
    }

    // Check if vehicle capacity is sufficient
    if (vehicle.capacity < load.weight) {
      throw new Error('Vehicle capacity insufficient for this load');
    }

    return { valid: true };
  }

  async getAvailableVehiclesForLoad(loadId: string, driverId: string) {
    const load = await Load.findByPk(loadId);

    if (!load) {
      throw new Error('Load not found');
    }

    return await Vehicle.findAll({
      where: {
        owner_id: driverId,
        is_active: true,
        type: { [Op.in]: load.vehicle_types },
        capacity: { [Op.gte]: load.weight },
      },
      order: [['created_at', 'DESC']],
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
    const vehicle = await Vehicle.findByPk(vehicleId);

    if (!vehicle) {
      throw new Error('Vehicle not found');
    }

    return await Trip.findAll({
      where: {
        '$bid.vehicle_id$': vehicleId,
        status: { [Op.in]: ['COMPLETED', 'CANCELLED'] },
      },
      include: [
        {
          association: 'bid',
          where: { vehicle_id: vehicleId },
          required: true,
        },
        {
          association: 'load',
          attributes: ['id', 'title', 'pickup_location', 'delivery_location', 'weight'],
        },
      ],
      order: [['created_at', 'DESC']],
      limit,
    });
  }

  // ============================================
  // NEW SEQUELIZE-SPECIFIC METHODS
  // ============================================

  async getVehicleWithDetails(vehicleId: string) {
    const vehicle = await Vehicle.findByPk(vehicleId, {
      include: [
        {
          association: 'owner',
          attributes: ['id', 'first_name', 'last_name', 'company_name', 'phone_number', 'email', 'rating'],
        },
        {
          association: 'bids',
          include: [{
            association: 'load',
            attributes: ['id', 'title', 'pickup_location', 'delivery_location', 'status'],
          }],
        },
      ],
    });

    if (!vehicle) {
      throw new Error('Vehicle not found');
    }

    return vehicle;
  }

  async updateVehicleLicensePlate(vehicleId: string, ownerId: string, newLicensePlate: string) {
    const vehicle = await Vehicle.findByPk(vehicleId);

    if (!vehicle) {
      throw new Error('Vehicle not found');
    }

    if (vehicle.owner_id !== ownerId) {
      throw new Error('Unauthorized');
    }

    // Check if new license plate already exists
    const existingVehicle = await Vehicle.findOne({
      where: { 
        license_plate: newLicensePlate.toUpperCase(),
        id: { [Op.ne]: vehicleId }
      },
    });

    if (existingVehicle) {
      throw new Error('License plate already in use by another vehicle');
    }

    await vehicle.update({ license_plate: newLicensePlate.toUpperCase() });
    loggers.info('Vehicle license plate updated', { vehicleId, oldPlate: vehicle.license_plate, newPlate: newLicensePlate });
    return vehicle;
  }

  async getVehicleMaintenanceHistory(vehicleId: string, limit = 10) {
    // Assuming you have a Maintenance model/table
    const vehicle = await Vehicle.findByPk(vehicleId);

    if (!vehicle) {
      throw new Error('Vehicle not found');
    }

    // This would query a maintenance table if it exists
    // For now, return an empty array as placeholder
    return [];
  }

  async bulkUpdateVehicleStatus(vehicleIds: string[], ownerId: string, status: boolean) {
    // Verify all vehicles belong to the owner
    const vehicles = await Vehicle.findAll({
      where: {
        id: { [Op.in]: vehicleIds },
        owner_id: ownerId,
      },
    });

    if (vehicles.length !== vehicleIds.length) {
      throw new Error('Some vehicles not found or unauthorized');
    }

    await Vehicle.update(
      { is_active: status },
      { 
        where: { 
          id: { [Op.in]: vehicleIds },
          owner_id: ownerId,
        } 
      }
    );

    loggers.info('Bulk vehicle status update', { 
      vehicleIds, 
      ownerId, 
      status,
      count: vehicleIds.length 
    });

    return { success: true, updated: vehicleIds.length };
  }

  async getVehiclesByType(type: VehicleType) {
    return await Vehicle.findAll({
      where: {
        type,
        is_active: true,
      },
      include: [{
        association: 'owner',
        attributes: ['id', 'first_name', 'last_name', 'company_name', 'rating'],
      }],
      order: [['created_at', 'DESC']],
    });
  }

  async getVehiclePerformanceMetrics(vehicleId: string, startDate?: Date, endDate?: Date) {
    const vehicle = await Vehicle.findByPk(vehicleId);

    if (!vehicle) {
      throw new Error('Vehicle not found');
    }

    const whereClause: any = {
      '$bid.vehicle_id$': vehicleId,
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
      include: [{
        association: 'bid',
        where: { vehicle_id: vehicleId },
        required: true,
      }],
      attributes: [
        'id',
        'agreed_price',
        'start_time',
        'end_time',
        'load_id',
      ],
      order: [['end_time', 'DESC']],
    });

    // Calculate metrics
    const totalTrips = trips.length;
    const totalRevenue = trips.reduce((sum, trip) => sum + trip.agreed_price, 0);
    
    // Calculate average trip duration
    let totalDuration = 0;
    trips.forEach(trip => {
      if (trip.start_time && trip.end_time) {
        const duration = new Date(trip.end_time).getTime() - new Date(trip.start_time).getTime();
        totalDuration += duration;
      }
    });
    
    const avgDuration = totalTrips > 0 ? Math.floor(totalDuration / totalTrips / 1000 / 60) : 0; // in minutes

    // Get monthly data
    const monthlyData = await Trip.findAll({
      where: whereClause,
      include: [{
        association: 'bid',
        where: { vehicle_id: vehicleId },
        required: true,
      }],
      attributes: [
        [Sequelize.fn('DATE_TRUNC', 'month', Sequelize.col('end_time')), 'month'],
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'trip_count'],
        [Sequelize.fn('SUM', Sequelize.col('agreed_price')), 'monthly_revenue'],
      ],
      group: ['month'],
      order: [['month', 'DESC']],
      raw: true,
    });

    return {
      totalTrips,
      totalRevenue,
      averageTripDuration: avgDuration,
      monthlyData,
      trips: trips.slice(0, 5), // Return last 5 trips
    };
  }
}

export const vehicleService = new VehicleService();