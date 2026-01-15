// backend/src/services/call.service.ts

import { Op } from 'sequelize';
import { loggers } from '../utils/logger';
import { notificationService } from './notification.service';
import type {
  InitiateCallData,
  CallHistoryResponse,
  CallStats,
} from '../types/call.types';
import User from '@/models/user.model';
import Call from '@/models/call.model';

export enum CallStatus {
  INITIATED = 'INITIATED',
  RINGING = 'RINGING',
  ANSWERED = 'ANSWERED',
  REJECTED = 'REJECTED',
  MISSED = 'MISSED',
  ENDED = 'ENDED',
  CANCELLED = 'CANCELLED',
}

export enum CallType {
  AUDIO = 'AUDIO',
  VIDEO = 'VIDEO',
}

class CallService {
  // ============================================
  // INITIATE & MANAGE CALLS
  // ============================================

  async initiateCall(callerId: string, data: InitiateCallData) {
    // Verify users exist
    const [caller, receiver] = await Promise.all([
      User.findByPk(callerId),
      User.findByPk(data.receiverId),
    ]);

    if (!caller || !receiver) {
      throw new Error('Caller or receiver not found');
    }

    if (callerId === data.receiverId) {
      throw new Error('Cannot call yourself');
    }

    // Check if there's an active call between these users
    const activeCall = await Call.findOne({
      where: {
        [Op.or]: [
          {
            caller_id: callerId,
            receiver_id: data.receiverId,
            status: { [Op.in]: [CallStatus.INITIATED, CallStatus.RINGING, CallStatus.ANSWERED] },
          },
          {
            caller_id: data.receiverId,
            receiver_id: callerId,
            status: { [Op.in]: [CallStatus.INITIATED, CallStatus.RINGING, CallStatus.ANSWERED] },
          },
        ],
      },
    });

    if (activeCall) {
      throw new Error('There is already an active call between these users');
    }

    // Create call
    const call = await Call.create({
      caller_id: callerId,
      receiver_id: data.receiverId,
      type: data.type,
      status: CallStatus.INITIATED,
      load_id: data.loadId,
      bid_id: data.bidId,
    } as any);

    // Fetch call with relationships
    const callWithRelations = await Call.findByPk(call.id, {
      include: [
        {
          association: 'caller',
          attributes: ['id', 'first_name', 'last_name', 'profile_image', 'phone_number'],
        },
        {
          association: 'receiver',
          attributes: ['id', 'first_name', 'last_name', 'profile_image', 'phone_number'],
        },
      ],
    });

    if (!callWithRelations) {
      throw new Error('Failed to create call');
    }

    loggers.info('Call initiated', { callId: call.id, callerId, receiverId: data.receiverId });

    // Send push notification to receiver
    await notificationService.sendPushNotification(data.receiverId, {
      title: `Incoming ${data.type === CallType.VIDEO ? 'Video' : 'Audio'} Call`,
      body: `${caller.first_name} ${caller.last_name} is calling you`,
      type: 'INCOMING_CALL',
      data: {
        callId: call.id,
        callerId,
        type: data.type,
        loadId: data.loadId,
        bidId: data.bidId,
      },
    });

    return callWithRelations;
  }

  async answerCall(callId: string, receiverId: string) {
    const call = await Call.findByPk(callId, {
      include: [
        {
          association: 'caller',
          attributes: ['id', 'first_name', 'last_name', 'profile_image'],
        },
        {
          association: 'receiver',
          attributes: ['id', 'first_name', 'last_name', 'profile_image'],
        },
      ],
    });

    if (!call) {
      throw new Error('Call not found');
    }

    if (call.receiver_id !== receiverId) {
      throw new Error('Unauthorized to answer this call');
    }

    if (call.status !== CallStatus.INITIATED && call.status !== CallStatus.RINGING) {
      throw new Error('Call cannot be answered in current status');
    }

    await call.update({
      status: CallStatus.ANSWERED,
      started_at: new Date(),
    });

    loggers.info('Call answered', { callId, receiverId });

    // Notify caller that call was answered
    await notificationService.sendPushNotification(call.caller_id, {
      title: 'Call Answered',
      body: `${call.receiver.first_name} ${call.receiver.last_name} answered your call`,
      type: 'CALL_ANSWERED',
      data: { callId },
    });

    return call;
  }

  async rejectCall(callId: string, receiverId: string) {
    const call = await Call.findByPk(callId);

    if (!call) {
      throw new Error('Call not found');
    }

    if (call.receiver_id !== receiverId) {
      throw new Error('Unauthorized to reject this call');
    }

    if (call.status === CallStatus.ENDED || call.status === CallStatus.CANCELLED) {
      throw new Error('Call already ended');
    }

    await call.update({
      status: CallStatus.REJECTED,
      ended_at: new Date(),
    });

    loggers.info('Call rejected', { callId, receiverId });

    return call;
  }

  async endCall(callId: string, userId: string) {
    const call = await Call.findByPk(callId);

    if (!call) {
      throw new Error('Call not found');
    }

    if (call.caller_id !== userId && call.receiver_id !== userId) {
      throw new Error('Unauthorized to end this call');
    }

    if (call.status === CallStatus.ENDED || call.status === CallStatus.CANCELLED) {
      throw new Error('Call already ended');
    }

    // Calculate duration if call was answered
    let duration: number | undefined;
    if (call.started_at) {
      const endTime = new Date();
      duration = Math.floor((endTime.getTime() - call.started_at.getTime()) / 1000);
    }

    await call.update({
      status: CallStatus.ENDED,
      ended_at: new Date(),
      duration,
    });

    loggers.info('Call ended', { callId, userId, duration });

    return call;
  }

  async cancelCall(callId: string, callerId: string) {
    const call = await Call.findByPk(callId);

    if (!call) {
      throw new Error('Call not found');
    }

    if (call.caller_id !== callerId) {
      throw new Error('Unauthorized to cancel this call');
    }

    if (call.status === CallStatus.ENDED || call.status === CallStatus.CANCELLED || call.status === CallStatus.ANSWERED) {
      throw new Error('Call cannot be cancelled in current status');
    }

    await call.update({
      status: CallStatus.CANCELLED,
      ended_at: new Date(),
    });

    loggers.info('Call cancelled', { callId, callerId });

    return call;
  }

  async updateCallStatus(callId: string, status: CallStatus) {
    const call = await Call.findByPk(callId);
    
    if (!call) {
      throw new Error('Call not found');
    }

    await call.update({ status });
    return call;
  }

  // ============================================
  // RETRIEVE CALLS
  // ============================================

  async getCall(callId: string, userId: string) {
    const call = await Call.findByPk(callId, {
      include: [
        {
          association: 'caller',
          attributes: ['id', 'first_name', 'last_name', 'profile_image', 'phone_number'],
        },
        {
          association: 'receiver',
          attributes: ['id', 'first_name', 'last_name', 'profile_image', 'phone_number'],
        },
      ],
    });

    if (!call) {
      throw new Error('Call not found');
    }

    if (call.caller_id !== userId && call.receiver_id !== userId) {
      throw new Error('Unauthorized');
    }

    return call;
  }

  async getCallHistory(userId: string, page = 1, limit = 50): Promise<CallHistoryResponse> {
    const offset = (page - 1) * limit;

    const { count, rows: calls } = await Call.findAndCountAll({
      where: {
        [Op.or]: [
          { caller_id: userId },
          { receiver_id: userId },
        ],
      },
      include: [
        {
          association: 'caller',
          attributes: ['id', 'first_name', 'last_name', 'profile_image'],
        },
        {
          association: 'receiver',
          attributes: ['id', 'first_name', 'last_name', 'profile_image'],
        },
      ],
      order: [['created_at', 'DESC']],
      offset,
      limit,
    });

    return {
      calls,
      pagination: {
        total: count,
        page,
        limit,
        pages: Math.ceil(count / limit),
      },
    };
  }

  async getActiveCalls(userId: string) {
    return await Call.findAll({
      where: {
        [Op.or]: [
          { caller_id: userId },
          { receiver_id: userId },
        ],
        status: { [Op.in]: [CallStatus.INITIATED, CallStatus.RINGING, CallStatus.ANSWERED] },
      },
      include: [
        {
          association: 'caller',
          attributes: ['id', 'first_name', 'last_name', 'profile_image'],
        },
        {
          association: 'receiver',
          attributes: ['id', 'first_name', 'last_name', 'profile_image'],
        },
      ],
      order: [['created_at', 'DESC']],
    });
  }

  async getCallsWithUser(userId: string, otherUserId: string, page = 1, limit = 50) {
    const offset = (page - 1) * limit;

    const { count, rows: calls } = await Call.findAndCountAll({
      where: {
        [Op.or]: [
          { caller_id: userId, receiver_id: otherUserId },
          { caller_id: otherUserId, receiver_id: userId },
        ],
      },
      include: [
        {
          association: 'caller',
          attributes: ['id', 'first_name', 'last_name', 'profile_image'],
        },
        {
          association: 'receiver',
          attributes: ['id', 'first_name', 'last_name', 'profile_image'],
        },
      ],
      order: [['created_at', 'DESC']],
      offset,
      limit,
    });

    return {
      calls,
      pagination: {
        total: count,
        page,
        limit,
        pages: Math.ceil(count / limit),
      },
    };
  }

  // ============================================
  // ANALYTICS
  // ============================================

  async getCallStats(userId: string): Promise<CallStats> {
    const [
      total,
      answered,
      missed,
      rejected
    ] = await Promise.all([
      Call.count({
        where: {
          [Op.or]: [
            { caller_id: userId },
            { receiver_id: userId },
          ],
        },
      }),
      Call.count({
        where: {
          [Op.or]: [
            { caller_id: userId, status: CallStatus.ENDED },
            { receiver_id: userId, status: CallStatus.ENDED },
          ],
          started_at: { [Op.ne]: null },
        },
      }),
      Call.count({
        where: {
          receiver_id: userId,
          status: CallStatus.MISSED,
        },
      }),
      Call.count({
        where: {
          receiver_id: userId,
          status: CallStatus.REJECTED,
        },
      }),
    ]);

    // Calculate total duration
    const callsWithDuration = await Call.findAll({
      where: {
        [Op.or]: [
          { caller_id: userId },
          { receiver_id: userId },
        ],
        status: CallStatus.ENDED,
        duration: { [Op.ne]: null },
      },
      attributes: ['duration'],
      raw: true,
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
    const result = await Call.update(
      {
        status: CallStatus.MISSED,
        ended_at: new Date(),
      },
      {
        where: {
          status: { [Op.in]: [CallStatus.INITIATED, CallStatus.RINGING] },
          created_at: {
            [Op.lt]: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
          },
        },
      }
    );

    if (result[0] > 0) {
      loggers.info(`Marked ${result[0]} calls as missed`);
    }

    return result[0];
  }

  // ============================================
  // NEW METHODS FOR SEQUELIZE
  // ============================================

  async getRecentCalls(userId: string, limit = 20) {
    return await Call.findAll({
      where: {
        [Op.or]: [
          { caller_id: userId },
          { receiver_id: userId },
        ],
      },
      include: [
        {
          association: 'caller',
          attributes: ['id', 'first_name', 'last_name', 'profile_image'],
        },
        {
          association: 'receiver',
          attributes: ['id', 'first_name', 'last_name', 'profile_image'],
        },
      ],
      order: [['created_at', 'DESC']],
      limit,
    });
  }

  async getCallById(callId: string) {
    return await Call.findByPk(callId, {
      include: [
        {
          association: 'caller',
        },
        {
          association: 'receiver',
        },
        {
          association: 'load',
          attributes: ['id', 'title'],
        },
        {
          association: 'bid',
          attributes: ['id', 'proposed_price'],
        },
      ],
    });
  }

  async updateCallDuration(callId: string) {
    const call = await Call.findByPk(callId);
    
    if (!call) {
      throw new Error('Call not found');
    }

    if (call.started_at && call.ended_at) {
      const duration = Math.floor((call.ended_at.getTime() - call.started_at.getTime()) / 1000);
      await call.update({ duration });
      return duration;
    }

    return null;
  }
}

export const callService = new CallService();