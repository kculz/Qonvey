// Enhanced WebSocket Service for Real-time Communication
// Location: backend/src/services/socket.service.ts

import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import { config } from '@/config/env';
import { loggers } from '@/utils/logger';
import User from '@/models/user.model';
import Call from '@/models/call.model';
import Message from '@/models/message.model';

interface AuthenticatedSocket extends Socket {
  userId?: string;
}

interface CallSignalData {
  callId: string;
  signal: any;
  from: string;
  to: string;
}

interface MessageTypingData {
  conversationWith: string;
  isTyping: boolean;
}

class SocketService {
  private io: SocketIOServer | null = null;
  private userSockets: Map<string, string[]> = new Map();
  private activeCalls: Map<string, { callerId: string; receiverId: string; socketIds: string[] }> = new Map();

  initialize(server: HTTPServer) {
    if (!config.features.socketIO) {
      loggers.info('Socket.IO is disabled');
      return;
    }

    this.io = new SocketIOServer(server, {
      cors: {
        origin: config.cors.origin,
        credentials: true,
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    this.setupMiddleware();
    this.setupEventHandlers();

    loggers.info('Socket.IO initialized successfully');
  }

  private setupMiddleware() {
    if (!this.io) return;

    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');

        if (!token) {
          return next(new Error('Authentication token required'));
        }

        const decoded = jwt.verify(token, config.jwt.secret) as any;

        const user = await User.findOne({
          where: { id: decoded.userId },
        });

        if (!user || user.status !== 'ACTIVE') {
          return next(new Error('Invalid user'));
        }

        socket.userId = decoded.userId;
        next();
      } catch (error) {
        loggers.error('Socket authentication failed', error);
        next(new Error('Authentication failed'));
      }
    });
  }

  private setupEventHandlers() {
    if (!this.io) return;

    this.io.on('connection', (socket: AuthenticatedSocket) => {
      const userId = socket.userId!;
      loggers.info('Socket connected', { userId, socketId: socket.id });

      const userSocketIds = this.userSockets.get(userId) || [];
      userSocketIds.push(socket.id);
      this.userSockets.set(userId, userSocketIds);

      socket.join(`user:${userId}`);
      this.emitUserStatus(userId, 'online');

      // ============================================
      // MESSAGE EVENTS
      // ============================================

      socket.on('message:typing:start', (data: { conversationWith: string }) => {
        this.emitToUser(data.conversationWith, 'message:typing', {
          userId,
          isTyping: true,
        });
      });

      socket.on('message:typing:stop', (data: { conversationWith: string }) => {
        this.emitToUser(data.conversationWith, 'message:typing', {
          userId,
          isTyping: false,
        });
      });

      socket.on('message:read', async (data: { messageId: string; senderId: string }) => {
        this.emitToUser(data.senderId, 'message:read', {
          messageId: data.messageId,
          readBy: userId,
          readAt: new Date(),
        });
      });

      socket.on('message:delivered', (data: { messageId: string; senderId: string }) => {
        this.emitToUser(data.senderId, 'message:delivered', {
          messageId: data.messageId,
          deliveredTo: userId,
          deliveredAt: new Date(),
        });
      });

      // ============================================
      // CALL EVENTS
      // ============================================

      socket.on('call:initiate', async (data: { receiverId: string; type: 'AUDIO' | 'VIDEO'; callId: string }) => {
        const { receiverId, type, callId } = data;

        loggers.info('Call initiated', { callId, callerId: userId, receiverId, type });

        this.activeCalls.set(callId, {
          callerId: userId,
          receiverId,
          socketIds: [socket.id],
        });

        this.emitToUser(receiverId, 'call:incoming', {
          callId,
          callerId: userId,
          type,
          timestamp: new Date(),
        });

        socket.emit('call:initiated', { callId, status: 'ringing' });
      });

      socket.on('call:answer', async (data: { callId: string }) => {
        const { callId } = data;
        const callData = this.activeCalls.get(callId);

        if (!callData) {
          socket.emit('call:error', { callId, error: 'Call not found' });
          return;
        }

        if (callData.receiverId !== userId) {
          socket.emit('call:error', { callId, error: 'Unauthorized' });
          return;
        }

        callData.socketIds.push(socket.id);
        this.activeCalls.set(callId, callData);

        loggers.info('Call answered', { callId, receiverId: userId });

        this.emitToUser(callData.callerId, 'call:answered', {
          callId,
          answeredBy: userId,
          timestamp: new Date(),
        });

        socket.emit('call:answered', { callId, status: 'connected' });
      });

      socket.on('call:reject', async (data: { callId: string }) => {
        const { callId } = data;
        const callData = this.activeCalls.get(callId);

        if (!callData) {
          socket.emit('call:error', { callId, error: 'Call not found' });
          return;
        }

        if (callData.receiverId !== userId) {
          socket.emit('call:error', { callId, error: 'Unauthorized' });
          return;
        }

        loggers.info('Call rejected', { callId, rejectedBy: userId });

        this.emitToUser(callData.callerId, 'call:rejected', {
          callId,
          rejectedBy: userId,
          timestamp: new Date(),
        });

        this.activeCalls.delete(callId);
      });

      socket.on('call:end', async (data: { callId: string }) => {
        const { callId } = data;
        const callData = this.activeCalls.get(callId);

        if (!callData) {
          socket.emit('call:error', { callId, error: 'Call not found' });
          return;
        }

        if (callData.callerId !== userId && callData.receiverId !== userId) {
          socket.emit('call:error', { callId, error: 'Unauthorized' });
          return;
        }

        loggers.info('Call ended', { callId, endedBy: userId });

        const otherUserId = callData.callerId === userId ? callData.receiverId : callData.callerId;

        this.emitToUser(otherUserId, 'call:ended', {
          callId,
          endedBy: userId,
          timestamp: new Date(),
        });

        socket.emit('call:ended', { callId, status: 'ended' });

        this.activeCalls.delete(callId);
      });

      socket.on('call:cancel', async (data: { callId: string }) => {
        const { callId } = data;
        const callData = this.activeCalls.get(callId);

        if (!callData) {
          socket.emit('call:error', { callId, error: 'Call not found' });
          return;
        }

        if (callData.callerId !== userId) {
          socket.emit('call:error', { callId, error: 'Only caller can cancel' });
          return;
        }

        loggers.info('Call cancelled', { callId, cancelledBy: userId });

        this.emitToUser(callData.receiverId, 'call:cancelled', {
          callId,
          cancelledBy: userId,
          timestamp: new Date(),
        });

        this.activeCalls.delete(callId);
      });

      // WebRTC Signaling
      socket.on('call:signal', (data: CallSignalData) => {
        const { callId, signal, to } = data;
        const callData = this.activeCalls.get(callId);

        if (!callData) {
          socket.emit('call:error', { callId, error: 'Call not found' });
          return;
        }

        this.emitToUser(to, 'call:signal', {
          callId,
          signal,
          from: userId,
        });
      });

      socket.on('call:ice-candidate', (data: { callId: string; candidate: any; to: string }) => {
        const { callId, candidate, to } = data;
        const callData = this.activeCalls.get(callId);

        if (!callData) {
          socket.emit('call:error', { callId, error: 'Call not found' });
          return;
        }

        this.emitToUser(to, 'call:ice-candidate', {
          callId,
          candidate,
          from: userId,
        });
      });

      // ============================================
      // LOAD & TRIP EVENTS
      // ============================================

      socket.on('join:load', (loadId: string) => {
        socket.join(`load:${loadId}`);
        loggers.info('User joined load room', { userId, loadId });
      });

      socket.on('leave:load', (loadId: string) => {
        socket.leave(`load:${loadId}`);
        loggers.info('User left load room', { userId, loadId });
      });

      socket.on('join:trip', (tripId: string) => {
        socket.join(`trip:${tripId}`);
        loggers.info('User joined trip room', { userId, tripId });
      });

      socket.on('leave:trip', (tripId: string) => {
        socket.leave(`trip:${tripId}`);
        loggers.info('User left trip room', { userId, tripId });
      });

      socket.on('location:update', (data: { tripId: string; location: any }) => {
        this.emitToRoom(`trip:${data.tripId}`, 'location:update', {
          userId,
          location: data.location,
          timestamp: new Date(),
        });
      });

      // ============================================
      // DISCONNECT
      // ============================================

      socket.on('disconnect', () => {
        loggers.info('Socket disconnected', { userId, socketId: socket.id });

        const userSocketIds = this.userSockets.get(userId) || [];
        const updatedSocketIds = userSocketIds.filter(id => id !== socket.id);

        if (updatedSocketIds.length === 0) {
          this.userSockets.delete(userId);
          this.emitUserStatus(userId, 'offline');
        } else {
          this.userSockets.set(userId, updatedSocketIds);
        }

        this.activeCalls.forEach((callData, callId) => {
          if (callData.socketIds.includes(socket.id)) {
            const otherUserId = callData.callerId === userId ? callData.receiverId : callData.callerId;
            
            this.emitToUser(otherUserId, 'call:disconnected', {
              callId,
              disconnectedUser: userId,
              timestamp: new Date(),
            });

            this.activeCalls.delete(callId);
          }
        });
      });
    });
  }

  // ============================================
  // EMIT METHODS
  // ============================================

  emitToUser(userId: string, event: string, data: any) {
    if (!this.io) return;
    this.io.to(`user:${userId}`).emit(event, data);
  }

  emitToRoom(room: string, event: string, data: any) {
    if (!this.io) return;
    this.io.to(room).emit(event, data);
  }

  emitToAll(event: string, data: any) {
    if (!this.io) return;
    this.io.emit(event, data);
  }

  // ============================================
  // MESSAGE EVENTS
  // ============================================

  emitNewMessage(receiverId: string, message: any) {
    this.emitToUser(receiverId, 'message:new', message);
  }

  emitMessageDelivered(senderId: string, messageId: string) {
    this.emitToUser(senderId, 'message:delivered', {
      messageId,
      deliveredAt: new Date(),
    });
  }

  emitMessageRead(senderId: string, messageId: string, readBy: string) {
    this.emitToUser(senderId, 'message:read', {
      messageId,
      readBy,
      readAt: new Date(),
    });
  }

  // ============================================
  // CALL EVENTS
  // ============================================

  emitIncomingCall(receiverId: string, callData: any) {
    this.emitToUser(receiverId, 'call:incoming', callData);
  }

  emitCallAnswered(callerId: string, callData: any) {
    this.emitToUser(callerId, 'call:answered', callData);
  }

  emitCallRejected(callerId: string, callData: any) {
    this.emitToUser(callerId, 'call:rejected', callData);
  }

  emitCallEnded(userId: string, callData: any) {
    this.emitToUser(userId, 'call:ended', callData);
  }

  emitCallCancelled(receiverId: string, callData: any) {
    this.emitToUser(receiverId, 'call:cancelled', callData);
  }

  // ============================================
  // OTHER EVENTS
  // ============================================

  emitNewBid(loadOwnerId: string, bid: any) {
    this.emitToUser(loadOwnerId, 'bid:new', bid);
    this.emitToRoom(`load:${bid.loadId}`, 'bid:new', bid);
  }

  emitBidAccepted(driverId: string, bid: any) {
    this.emitToUser(driverId, 'bid:accepted', bid);
  }

  emitBidRejected(driverId: string, bid: any) {
    this.emitToUser(driverId, 'bid:rejected', bid);
  }

  emitTripStarted(loadOwnerId: string, trip: any) {
    this.emitToUser(loadOwnerId, 'trip:started', trip);
    this.emitToRoom(`trip:${trip.id}`, 'trip:started', trip);
  }

  emitTripLocationUpdate(tripId: string, location: any) {
    this.emitToRoom(`trip:${tripId}`, 'trip:location', location);
  }

  emitTripCompleted(loadOwnerId: string, trip: any) {
    this.emitToUser(loadOwnerId, 'trip:completed', trip);
    this.emitToRoom(`trip:${trip.id}`, 'trip:completed', trip);
  }

  emitNewLoad(load: any) {
    this.emitToAll('load:new', load);
  }

  emitLoadUpdated(loadId: string, load: any) {
    this.emitToRoom(`load:${loadId}`, 'load:updated', load);
  }

  emitLoadCancelled(loadId: string, load: any) {
    this.emitToRoom(`load:${loadId}`, 'load:cancelled', load);
  }

  emitUserStatus(userId: string, status: 'online' | 'offline') {
    this.emitToAll('user:status', { userId, status, timestamp: new Date() });
  }

  emitNotification(userId: string, notification: any) {
    this.emitToUser(userId, 'notification:new', notification);
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  isUserOnline(userId: string): boolean {
    return this.userSockets.has(userId);
  }

  getOnlineUsers(): string[] {
    return Array.from(this.userSockets.keys());
  }

  getOnlineUsersCount(): number {
    return this.userSockets.size;
  }

  getUserSocketCount(userId: string): number {
    return this.userSockets.get(userId)?.length || 0;
  }

  getActiveCallsCount(): number {
    return this.activeCalls.size;
  }

  isUserInCall(userId: string): boolean {
    for (const callData of this.activeCalls.values()) {
      if (callData.callerId === userId || callData.receiverId === userId) {
        return true;
      }
    }
    return false;
  }

  disconnectUser(userId: string) {
    if (!this.io) return;

    const socketIds = this.userSockets.get(userId);
    if (socketIds) {
      socketIds.forEach(socketId => {
        const socket = this.io!.sockets.sockets.get(socketId);
        if (socket) {
          socket.disconnect(true);
        }
      });
      this.userSockets.delete(userId);
    }
  }

  getIO(): SocketIOServer | null {
    return this.io;
  }
}

export const socketService = new SocketService();