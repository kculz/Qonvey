import { VehicleType } from '@prisma/client';

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

export interface VehicleFilters {
  type?: VehicleType;
  make?: string;
  minCapacity?: number;
  maxCapacity?: number;
  isActive?: boolean;
}

