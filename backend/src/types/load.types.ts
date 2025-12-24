import { LoadStatus, VehicleType } from '@prisma/client';

export interface LocationData {
  address: string;
  lat: number;
  lng: number;
  city: string;
  province?: string;
}

export interface CreateLoadData {
  title: string;
  description: string;
  cargoType: string;
  weight: number;
  volume?: number;
  pickupLocation: LocationData;
  deliveryLocation: LocationData;
  pickupDate: Date;
  deliveryDate?: Date;
  suggestedPrice?: number;
  currency?: string;
  vehicleTypes: VehicleType[];
  images?: string[];
  documents?: string[];
  requiresInsurance?: boolean;
  fragile?: boolean;
  expiresAt?: Date;
}

export interface LoadFilters {
  status?: LoadStatus;
  cargoType?: string;
  vehicleTypes?: VehicleType[];
  pickupCity?: string;
  deliveryCity?: string;
  minWeight?: number;
  maxWeight?: number;
  minPrice?: number;
  maxPrice?: number;
  pickupDateFrom?: Date;
  pickupDateTo?: Date;
  searchQuery?: string;
}

export interface LoadSearchResponse {
  loads: any[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

