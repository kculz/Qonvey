import { TripStatus, PaymentMethod } from '@prisma/client';

export interface LocationUpdate {
  lat: number;
  lng: number;
  timestamp: Date;
}

export interface TripUpdateData {
  status?: TripStatus;
  currentLocation?: LocationUpdate;
  startTime?: Date;
  endTime?: Date;
  paymentMethod?: PaymentMethod;
  proofOfPickup?: string;
  proofOfDelivery?: string;
  signature?: string;
  notes?: string;
}
