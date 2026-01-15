export interface CreateBidData {
  loadId: string;
  proposedPrice: number;
  currency?: string;
  message?: string;
  estimatedDuration?: number;
  vehicleId?: string;
  expiresAt?: Date;
}

export interface UpdateBidData {
  proposedPrice?: number;
  message?: string;
  estimatedDuration?: number;
  vehicleId?: string;
  expiresAt?: Date;
}

export interface BidStats {
  total: number;
  pending: number;
  accepted: number;
  rejected: number;
  withdrawn: number;
  acceptanceRate: number;
  averageBidAmount: number;
}

export interface LoadBidStats {
  totalBids: number;
  lowestBid: number;
  highestBid: number;
  averageBid: number;
}

export enum BidStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  WITHDRAWN = 'WITHDRAWN',
}