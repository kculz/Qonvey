// Call Management Service
// Location: backend/src/services/call.service.ts

import prisma from '@/config/database';
import { loggers } from '@/utils/logger';
import { notificationService } from '@/services/notification.service';
import { CallStatus, CallType } from '@prisma/client';
import type {
  InitiateCallData,
  CallResponse,
  CallHistoryResponse,
  CallStats,
} from '@/types/call.types';

class CallService {
  // ============================================
  // INITIATE & MANAGE CALLS
  // ============================================

  async initiateCall(callerId: string, data: InitiateCallData) {
    // Verify users exist
    const [caller, receiver] = await Promise.all([
      prisma.user.findUnique({ where: { id: callerId } }),
      prisma.user.findUnique({ where: { id: data.receiverId } }),
    ]);

    if (!caller || !receiver) {
      throw new Error('Caller or receiver not found');
    }

    if (callerId === data.receiverId) {
      throw new Error('Cannot call yourself');
    }

    // Check if there's an active call between these users
    const activeCall = await prisma.call.findFirst({
      where: {
        OR: [
          { callerId, receiverId: data.receiverId, status: { in: [CallStatus.INITIATED, CallStatus.RINGING, CallStatus.ANSWERED] } },
          { callerId: data.receiverId, receiverId: callerId, status: { in: [CallStatus.INITIATED, CallStatus.RINGING, CallStatus.ANSWERED] } },
        ],
      },
    });

    if (activeCall) {
      throw new Error('There is already an active call between these users');
    }

    // Create call
    const call = await prisma.call.create({
      data: {
        callerId,
        receiverId: data.receiverId,
        type: data.type,
        status: CallStatus.INITIATED,
        loadId: data.loadId,
        bidId: data.bidId,
      },
      include: {
        caller: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profileImage: true,
            phoneNumber: true,
          },
        },
        receiver: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profileImage: true,
            phoneNumber: true,
          },
        },
      },
    });

    loggers.info('Call initiated', { callId: call.id, callerId, receiverId: data.receiverId });

    // Send push notification to receiver
    await notificationService.sendPushNotification(data.receiverId, {
      title: `Incoming ${data.type === CallType.VIDEO ? 'Video' : 'Audio'} Call`,
      body: `${caller.firstName} ${caller.lastName} is calling you`,
      type: 'INCOMING_CALL',
      data: {
        callId: call.id,
        callerId,
        type: data.type,
        loadId: data.loadId,
        bidId: data.bidId,
      },
    });

    return call;
  }

  async answerCall(callId: string, receiverId: string) {
    const call = await prisma.call.findUnique({
      where: { id: callId },
      include: {
        caller: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profileImage: true,
          },
        },
        receiver: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profileImage: true,
          },
        },
      },
    });

    if (!call) {
      throw new Error('Call not found');
    }

    if (call.receiverId !== receiverId) {
      throw new Error('Unauthorized to answer this call');
    }

    if (call.status !== CallStatus.INITIATED && call.status !== CallStatus.RINGING) {
      throw new Error('Call cannot be answered in current status');
    }

    const updatedCall = await prisma.call.update({
      where: { id: callId },
      data: {
        status: CallStatus.ANSWERED,
        startedAt: new Date(),
      },
      include: {
        caller: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profileImage: true,
          },
        },
        receiver: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profileImage: true,
          },
        },
      },
    });

    loggers.info('Call answered', { callId, receiverId });

    // Notify caller that call was answered
    await notificationService.sendPushNotification(call.callerId, {
      title: 'Call Answered',
      body: `${call.receiver.firstName} ${call.receiver.lastName} answered your call`,
      type: 'CALL_ANSWERED',
      data: { callId },
    });

    return updatedCall;
  }

  async rejectCall(callId: string, receiverId: string) {
    const call = await prisma.call.findUnique({
      where: { id: callId },
    });

    if (!call) {
      throw new Error('Call not found');
    }

    if (call.receiverId !== receiverId) {
      throw new Error('Unauthorized to reject this call');
    }

    if (call.status === CallStatus.ENDED || call.status === CallStatus.CANCELLED) {
      throw new Error('Call already ended');
    }

    const updatedCall = await prisma.call.update({
      where: { id: callId },
      data: {
        status: CallStatus.REJECTED,
        endedAt: new Date(),
      },
    });

    loggers.info('Call rejected', { callId, receiverId });

    return updatedCall;
  }

  async endCall(callId: string, userId: string) {
    const call = await prisma.call.findUnique({
      where: { id: callId },
    });

    if (!call) {
      throw new Error('Call not found');
    }

    if (call.callerId !== userId && call.receiverId !== userId) {
      throw new Error('Unauthorized to end this call');
    }

    if (call.status === CallStatus.ENDED || call.status === CallStatus.CANCELLED) {
      throw new Error('Call already ended');
    }

    // Calculate duration if call was answered
    let duration: number | undefined;
    if (call.startedAt) {
      const endTime = new Date();
      duration = Math.floor((endTime.getTime() - call.startedAt.getTime()) / 1000);
    }

    const updatedCall = await prisma.call.update({
      where: { id: callId },
      data: {
        status: CallStatus.ENDED,
        endedAt: new Date(),
        duration,
      },
    });

    loggers.info('Call ended', { callId, userId, duration });

    return updatedCall;
  }

  async cancelCall(callId: string, callerId: string) {
    const call = await prisma.call.findUnique({
      where: { id: callId },
    });

    if (!call) {
      throw new Error('Call not found');
    }

    if (call.callerId !== callerId) {
      throw new Error('Unauthorized to cancel this call');
    }

    if (call.status === CallStatus.ENDED || call.status === CallStatus.CANCELLED || call.status === CallStatus.ANSWERED) {
      throw new Error('Call cannot be cancelled in current status');
    }

    const updatedCall = await prisma.call.update({
      where: { id: callId },
      data: {
        status: CallStatus.CANCELLED,
        endedAt: new Date(),
      },
    });

    loggers.info('Call cancelled', { callId, callerId });

    return updatedCall;
  }

  async updateCallStatus(callId: string, status: CallStatus) {
    const call = await prisma.call.update({
      where: { id: callId },
      data: { status },
    });

    return call;
  }

  // ============================================
  // RETRIEVE CALLS
  // ============================================

  async getCall(callId: string, userId: string) {
    const call = await prisma.call.findUnique({
      where: { id: callId },
      include: {
        caller: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profileImage: true,
            phoneNumber: true,
          },
        },
        receiver: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profileImage: true,
            phoneNumber: true,
          },
        },
      },
    });

    if (!call) {
      throw new Error('Call not found');
    }

    if (call.callerId !== userId && call.receiverId !== userId) {
      throw new Error('Unauthorized');
    }

    return call;
  }

  async getCallHistory(userId: string, page = 1, limit = 50): Promise<CallHistoryResponse> {
    const skip = (page - 1) * limit;

    const [calls, total] = await Promise.all([
      prisma.call.findMany({
        where: {
          OR: [
            { callerId: userId },
            { receiverId: userId },
          ],
        },
        include: {
          caller: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profileImage: true,
            },
          },
          receiver: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profileImage: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.call.count({
        where: {
          OR: [
            { callerId: userId },
            { receiverId: userId },
          ],
        },
      }),
    ]);

    return {
      calls,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getActiveCalls(userId: string) {
    return await prisma.call.findMany({
      where: {
        OR: [
          { callerId: userId },
          { receiverId: userId },
        ],
        status: { in: [CallStatus.INITIATED, CallStatus.RINGING, CallStatus.ANSWERED] },
      },
      include: {
        caller: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profileImage: true,
          },
        },
        receiver: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profileImage: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getCallsWithUser(userId: string, otherUserId: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;

    const [calls, total] = await Promise.all([
      prisma.call.findMany({
        where: {
          OR: [
            { callerId: userId, receiverId: otherUserId },
            { callerId: otherUserId, receiverId: userId },
          ],
        },
        include: {
          caller: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profileImage: true,
            },
          },
          receiver: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profileImage: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.call.count({
        where: {
          OR: [
            { callerId: userId, receiverId: otherUserId },
            { callerId: otherUserId, receiverId: userId },
          ],
        },
      }),
    ]);

    return {
      calls,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  // ============================================
  // ANALYTICS
  // ============================================

  async getCallStats(userId: string): Promise<CallStats> {
    const [total, answered, missed, rejected] = await Promise.all([
      prisma.call.count({
        where: {
          OR: [
            { callerId: userId },
            { receiverId: userId },
          ],
        },
      }),
      prisma.call.count({
        where: {
          OR: [
            { callerId: userId, status: CallStatus.ENDED },
            { receiverId: userId, status: CallStatus.ENDED },
          ],
          startedAt: { not: null },
        },
      }),
      prisma.call.count({
        where: {
          receiverId: userId,
          status: CallStatus.MISSED,
        },
      }),
      prisma.call.count({
        where: {
          receiverId: userId,
          status: CallStatus.REJECTED,
        },
      }),
    ]);

    // Calculate total duration
    const callsWithDuration = await prisma.call.findMany({
      where: {
        OR: [
          { callerId: userId },
          { receiverId: userId },
        ],
        status: CallStatus.ENDED,
        duration: { not: null },
      },
      select: { duration: true },
    });

    const totalDuration = callsWithDuration.reduce((sum, call) => sum + (call.duration || 0), 0);
    const averageDuration = answered > 0 ? Math.floor(totalDuration / answered) : 0;

    return {
      total,
      answered,
      missed,
      rejected,
      totalDuration,
      averageDuration,
    };
  }

  // ============================================
  // HELPERS
  // ============================================

  async markMissedCalls() {
    // Mark calls that were initiated but never answered as missed
    const result = await prisma.call.updateMany({
      where: {
        status: { in: [CallStatus.INITIATED, CallStatus.RINGING] },
        createdAt: {
          lt: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
        },
      },
      data: {
        status: CallStatus.MISSED,
        endedAt: new Date(),
      },
    });

    if (result.count > 0) {
      loggers.info(`Marked ${result.count} calls as missed`);
    }

    return result;
  }
}

export const callService = new CallService();

