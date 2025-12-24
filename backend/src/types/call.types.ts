// Re-export Prisma enums for convenience
export { CallStatus, CallType } from '@prisma/client';

export interface InitiateCallData {
  receiverId: string;
  type: CallType;
  loadId?: string;
  bidId?: string;
}

export interface CallResponse {
  callId: string;
  status: CallStatus;
  caller: any;
  receiver: any;
  type: CallType;
  duration?: number;
  startedAt?: Date;
  endedAt?: Date;
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

