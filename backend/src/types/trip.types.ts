export interface LocationUpdate {
  lat: number;
  lng: number;
  timestamp: Date;
  address?: string;
  speed?: number;
  bearing?: number;
  accuracy?: number;
}

export interface TripUpdateData {
  proofOfDelivery?: string;
  signature?: string;
  paymentMethod?: string;
  notes?: string;
}

export interface TripResponse {
  id: string;
  loadId: string;
  bidId: string;
  driverId: string;
  status: string;
  startTime?: Date;
  endTime?: Date;
  currentLocation?: LocationUpdate;
  route: LocationUpdate[];
  agreedPrice: number;
  currency: string;
  paymentMethod?: string;
  proofOfPickup?: string;
  proofOfDelivery?: string;
  signature?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  load?: any;
  driver?: any;
  bid?: any;
  review?: any;
}

export interface TripStats {
  total: number;
  scheduled: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  completionRate: number;
  totalEarnings?: number;
  averageDuration: number;
}

export interface DriverEarnings {
  trips: any[];
  totalEarnings: number;
  totalTrips: number;
}

export interface RouteResponse {
  route: LocationUpdate[];
  currentLocation?: LocationUpdate;
}

export interface TripFilter {
  status?: string;
  startDate?: Date;
  endDate?: Date;
  driverId?: string;
  ownerId?: string;
}