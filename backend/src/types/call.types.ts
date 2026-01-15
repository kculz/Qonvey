export interface InitiateCallData {
  receiverId: string;
  type: 'AUDIO' | 'VIDEO';
  loadId?: string;
  bidId?: string;
}

export interface CallResponse {
  id: string;
  callerId: string;
  receiverId: string;
  type: string;
  status: string;
  loadId?: string;
  bidId?: string;
  startedAt?: Date;
  endedAt?: Date;
  duration?: number;
  createdAt: Date;
  updatedAt: Date;
  caller?: any;
  receiver?: any;
}

export interface CallHistoryResponse {
  calls: any[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

export interface CallStats {
  total: number;
  answered: number;
  missed: number;
  rejected: number;
  totalDuration: number;
  averageDuration: number;
}

export interface ActiveCall {
  id: string;
  callerId: string;
  receiverId: string;
  type: string;
  status: string;
  createdAt: Date;
  caller: {
    id: string;
    firstName: string;
    lastName: string;
    profileImage?: string;
  };
  receiver: {
    id: string;
    firstName: string;
    lastName: string;
    profileImage?: string;
  };
}