// backend/src/types/vehicle.types.ts

export enum VehicleType {
  PICKUP = 'PICKUP',
  SMALL_TRUCK = 'SMALL_TRUCK',
  MEDIUM_TRUCK = 'MEDIUM_TRUCK',
  LARGE_TRUCK = 'LARGE_TRUCK',
  FLATBED = 'FLATBED',
  REFRIGERATED = 'REFRIGERATED',
  CONTAINER = 'CONTAINER'
}

export interface CreateVehicleData {
  type: VehicleType;
  make: string;
  model: string;
  year: number;
  licensePlate: string;
  color?: string;
  capacity: number;
  volumeCapacity?: number;
  images?: string[];
  insurance?: string;
  registration?: string;
}

export interface UpdateVehicleData {
  type?: VehicleType;
  make?: string;
  model?: string;
  year?: number;
  color?: string;
  capacity?: number;
  volumeCapacity?: number;
  images?: string[];
  insurance?: string;
  registration?: string;
  isActive?: boolean;
}

export interface VehicleResponse {
  id: string;
  ownerId: string;
  type: VehicleType;
  make: string;
  model: string;
  year: number;
  licensePlate: string;
  color?: string;
  capacity: number;
  volumeCapacity?: number;
  images: string[];
  insurance?: string;
  registration?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  owner?: any;
  bids?: any[];
}

export interface VehicleStats {
  totalBids: number;
  acceptedBids: number;
  completedTrips: number;
  totalEarnings: number;
  acceptanceRate: number;
}

export interface UserVehicleStats {
  totalVehicles: number;
  activeVehicles: number;
  inactiveVehicles: number;
}

export interface VehicleValidationResult {
  valid: boolean;
  errors?: string[];
}

export interface VehicleSearchFilters {
  type?: VehicleType;
  minCapacity?: number;
  maxCapacity?: number;
  ownerId?: string;
  isActive?: boolean;
}

export interface VehiclePerformanceMetrics {
  totalTrips: number;
  totalRevenue: number;
  averageTripDuration: number;
  monthlyData: Array<{
    month: Date;
    trip_count: number;
    monthly_revenue: number;
  }>;
  trips: any[];
}

export interface BulkUpdateResult {
  success: boolean;
  updated: number;
  failed?: Array<{ vehicleId: string; reason: string }>;
}