// WebSocket Service for Real-time Communication
// Location: backend/src/services/socket.service.ts

import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import { config } from '@/config/env';
import { loggers } from '@/utils/logger';
import prisma from '@/config/database';

interface AuthenticatedSocket extends Socket {
  userId?: string;
}

class SocketService {
  private io: SocketIOServer | null = null;
  private userSockets: Map<string, string[]> = new Map(); // userId -> socketIds[]

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
    });

    this.setupMiddleware();
    this.setupEventHandlers();

    loggers.info('Socket.IO initialized successfully');
  }

  private setupMiddleware() {
    if (!this.io) return;

    // Authentication middleware
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');

        if (!token) {
          return next(new Error('Authentication token required'));
        }

        const decoded = jwt.verify(token, config.jwt.secret) as any;

        // Verify user exists
        const user = await prisma.user.findUnique({
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

      // Track user's socket connections
      const userSocketIds = this.userSockets.get(userId) || [];
      userSocketIds.push(socket.id);
      this.userSockets.set(userId, userSocketIds);

      // Join user's personal room
      socket.join(`user:${userId}`);

      // Emit user online status
      this.emitUserStatus(userId, 'online');

      // Handle join load room
      socket.on('join:load', (loadId: string) => {
        socket.join(`load:${loadId}`);
        loggers.info('User joined load room', { userId, loadId });
      });

      // Handle leave load room
      socket.on('leave:load', (loadId: string) => {
        socket.leave(`load:${loadId}`);
        loggers.info('User left load room', { userId, loadId });
      });

      // Handle join trip room
      socket.on('join:trip', (tripId: string) => {
        socket.join(`trip:${tripId}`);
        loggers.info('User joined trip room', { userId, tripId });
      });

      // Handle leave trip room
      socket.on('leave:trip', (tripId: string) => {
        socket.leave(`trip:${tripId}`);
        loggers.info('User left trip room', { userId, tripId });
      });

      // Handle typing indicator
      socket.on('typing:start', (data: { conversationWith: string }) => {
        this.emitToUser(data.conversationWith, 'typing:start', { userId });
      });

      socket.on('typing:stop', (data: { conversationWith: string }) => {
        this.emitToUser(data.conversationWith, 'typing:stop', { userId });
      });

      // Handle location updates (for trips)
      socket.on('location:update', (data: { tripId: string; location: any }) => {
        this.emitToRoom(`trip:${data.tripId}`, 'location:update', {
          userId,
          location: data.location,
        });
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        loggers.info('Socket disconnected', { userId, socketId: socket.id });

        // Remove socket from user's connections
        const userSocketIds = this.userSockets.get(userId) || [];
        const updatedSocketIds = userSocketIds.filter(id => id !== socket.id);

        if (updatedSocketIds.length === 0) {
          // User has no more active connections
          this.userSockets.delete(userId);
          this.emitUserStatus(userId, 'offline');
        } else {
          this.userSockets.set(userId, updatedSocketIds);
        }
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
  // SPECIFIC EVENTS
  // ============================================

  emitNewMessage(receiverId: string, message: any) {
    this.emitToUser(receiverId, 'message:new', message);
  }

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