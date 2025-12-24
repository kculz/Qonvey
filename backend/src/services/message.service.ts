// Messaging Service
// Location: backend/src/services/message.service.ts

import prisma from '@/config/database';
import { loggers } from '@/utils/logger';
import { notificationService } from '@/services/notification.service';
import type { SendMessageData } from '@/types/message.types';

class MessageService {
  // ============================================
  // SEND & RETRIEVE MESSAGES
  // ============================================

  async sendMessage(senderId: string, data: SendMessageData) {
    // Verify users exist
    const [sender, receiver] = await Promise.all([
      prisma.user.findUnique({ where: { id: senderId } }),
      prisma.user.findUnique({ where: { id: data.receiverId } }),
    ]);

    if (!sender || !receiver) {
      throw new Error('Sender or receiver not found');
    }

    // Create message
    const message = await prisma.message.create({
      data: {
        senderId,
        receiverId: data.receiverId,
        content: data.content,
        loadId: data.loadId,
        bidId: data.bidId,
      },
      include: {
        sender: {
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

    loggers.info('Message sent', { messageId: message.id, senderId, receiverId: data.receiverId });

    // Send push notification to receiver
    await notificationService.sendPushNotification(data.receiverId, {
      title: `Message from ${sender.firstName} ${sender.lastName}`,
      body: data.content.substring(0, 100),
      type: 'NEW_MESSAGE',
      data: { 
        messageId: message.id, 
        senderId,
        loadId: data.loadId,
        bidId: data.bidId,
      },
    });

    return message;
  }

  async getConversation(userId: string, otherUserId: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where: {
          OR: [
            { senderId: userId, receiverId: otherUserId },
            { senderId: otherUserId, receiverId: userId },
          ],
        },
        include: {
          sender: {
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
      prisma.message.count({
        where: {
          OR: [
            { senderId: userId, receiverId: otherUserId },
            { senderId: otherUserId, receiverId: userId },
          ],
        },
      }),
    ]);

    // Mark messages as read
    await prisma.message.updateMany({
      where: {
        senderId: otherUserId,
        receiverId: userId,
        read: false,
      },
      data: {
        read: true,
        readAt: new Date(),
      },
    });

    return {
      messages: messages.reverse(),
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getConversations(userId: string) {
    // Get all unique conversation partners
    const sentMessages = await prisma.message.findMany({
      where: { senderId: userId },
      distinct: ['receiverId'],
      select: { receiverId: true },
    });

    const receivedMessages = await prisma.message.findMany({
      where: { receiverId: userId },
      distinct: ['senderId'],
      select: { senderId: true },
    });

    const userIds = [
      ...sentMessages.map((m) => m.receiverId),
      ...receivedMessages.map((m) => m.senderId),
    ];

    const uniqueUserIds = [...new Set(userIds)];

    // Get last message and unread count for each conversation
    const conversations = await Promise.all(
      uniqueUserIds.map(async (otherUserId) => {
        const lastMessage = await prisma.message.findFirst({
          where: {
            OR: [
              { senderId: userId, receiverId: otherUserId },
              { senderId: otherUserId, receiverId: userId },
            ],
          },
          orderBy: { createdAt: 'desc' },
          include: {
            sender: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                profileImage: true,
              },
            },
          },
        });

        const unreadCount = await prisma.message.count({
          where: {
            senderId: otherUserId,
            receiverId: userId,
            read: false,
          },
        });

        const otherUser = await prisma.user.findUnique({
          where: { id: otherUserId },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profileImage: true,
            status: true,
          },
        });

        return {
          user: otherUser,
          lastMessage,
          unreadCount,
        };
      })
    );

    // Sort by last message date
    conversations.sort((a, b) => {
      const dateA = a.lastMessage?.createdAt || new Date(0);
      const dateB = b.lastMessage?.createdAt || new Date(0);
      return dateB.getTime() - dateA.getTime();
    });

    return conversations;
  }

  async markAsRead(messageId: string, userId: string) {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new Error('Message not found');
    }

    if (message.receiverId !== userId) {
      throw new Error('Unauthorized');
    }

    return await prisma.message.update({
      where: { id: messageId },
      data: {
        read: true,
        readAt: new Date(),
      },
    });
  }

  async deleteMessage(messageId: string, userId: string) {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new Error('Message not found');
    }

    if (message.senderId !== userId) {
      throw new Error('Unauthorized - only sender can delete message');
    }

    await prisma.message.delete({
      where: { id: messageId },
    });

    return { success: true };
  }

  // ============================================
  // LOAD/BID RELATED MESSAGES
  // ============================================

  async getLoadMessages(loadId: string, userId: string) {
    // Verify user is load owner
    const load = await prisma.load.findUnique({
      where: { id: loadId },
    });

    if (!load) {
      throw new Error('Load not found');
    }

    if (load.ownerId !== userId) {
      throw new Error('Unauthorized');
    }

    return await prisma.message.findMany({
      where: { loadId },
      include: {
        sender: {
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

  async getBidMessages(bidId: string, userId: string) {
    // Verify user is involved in bid
    const bid = await prisma.bid.findUnique({
      where: { id: bidId },
      include: { load: true },
    });

    if (!bid) {
      throw new Error('Bid not found');
    }

    if (bid.driverId !== userId && bid.load.ownerId !== userId) {
      throw new Error('Unauthorized');
    }

    return await prisma.message.findMany({
      where: { bidId },
      include: {
        sender: {
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

  // ============================================
  // ANALYTICS
  // ============================================

  async getUnreadCount(userId: string) {
    return await prisma.message.count({
      where: {
        receiverId: userId,
        read: false,
      },
    });
  }

  async getMessageStats(userId: string) {
    const [sent, received, unread] = await Promise.all([
      prisma.message.count({ where: { senderId: userId } }),
      prisma.message.count({ where: { receiverId: userId } }),
      prisma.message.count({ where: { receiverId: userId, read: false } }),
    ]);

    return {
      sent,
      received,
      unread,
      total: sent + received,
    };
  }
}

export const messageService = new MessageService();