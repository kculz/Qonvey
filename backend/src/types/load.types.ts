export interface CreateLoadData {
  title: string;
  description: string;
  cargoType: string;
  weight: number;
  volume?: number;
  pickupLocation: {
    address: string;
    lat: number;
    lng: number;
    city: string;
    province: string;
  };
  deliveryLocation: {
    address: string;
    lat: number;
    lng: number;
    city: string;
    province: string;
  };
  pickupDate: Date;
  deliveryDate?: Date;
  suggestedPrice?: number;
  currency?: string;
  vehicleTypes: string[];
  images?: string[];
  documents?: string[];
  requiresInsurance?: boolean;
  fragile?: boolean;
  expiresAt?: Date;
}

export interface LoadFilters {
  status?: string;
  cargoType?: string;
  vehicleTypes?: string[];
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

export interface LoadStats {
  total: number;
  open: number;
  assigned: number;
  completed: number;
  cancelled: number;
}

export interface LoadResponse {
  id: string;
  title: string;
  description: string;
  cargoType: string;
  weight: number;
  volume?: number;
  pickupLocation: any;
  deliveryLocation: any;
  pickupDate: Date;
  deliveryDate?: Date;
  suggestedPrice?: number;
  currency: string;
  status: string;
  vehicleTypes: string[];
  images: string[];
  documents: string[];
  requiresInsurance: boolean;
  fragile: boolean;
  expiresAt?: Date;
  viewCount: number;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  ownerId: string;
  owner?: any;
  bids?: any[];
  trip?: any;
}