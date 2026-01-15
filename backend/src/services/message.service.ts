// backend/src/services/message.service.ts

import { Op } from 'sequelize';
import { loggers } from '../utils/logger';
import { notificationService } from './notification.service';
import type { SendMessageData, Conversation } from '../types/message.types';
import User from '@/models/user.model';
import Message from '@/models/message.model';
import Load from '@/models/load.model';
import Bid from '@/models/bid.model';

class MessageService {
  // ============================================
  // SEND & RETRIEVE MESSAGES
  // ============================================

  async sendMessage(senderId: string, data: SendMessageData) {
    // Verify users exist
    const [sender, receiver] = await Promise.all([
      User.findByPk(senderId),
      User.findByPk(data.receiverId),
    ]);

    if (!sender || !receiver) {
      throw new Error('Sender or receiver not found');
    }

    // Create message
    const message = await Message.create({
      sender_id: senderId,
      receiver_id: data.receiverId,
      content: data.content,
      load_id: data.loadId,
      bid_id: data.bidId,
    } as any);

    // Fetch message with relationships
    const messageWithRelations = await Message.findByPk(message.id, {
      include: [
        {
          association: 'sender',
          attributes: ['id', 'first_name', 'last_name', 'profile_image'],
        },
        {
          association: 'receiver',
          attributes: ['id', 'first_name', 'last_name', 'profile_image'],
        },
      ],
    });

    if (!messageWithRelations) {
      throw new Error('Failed to create message');
    }

    loggers.info('Message sent', { messageId: message.id, senderId, receiverId: data.receiverId });

    // Send push notification to receiver
    await notificationService.sendPushNotification(data.receiverId, {
      title: `Message from ${sender.first_name} ${sender.last_name}`,
      body: data.content.substring(0, 100),
      type: 'NEW_MESSAGE',
      data: { 
        messageId: message.id, 
        senderId,
        loadId: data.loadId,
        bidId: data.bidId,
      },
    });

    return messageWithRelations;
  }

  async getConversation(userId: string, otherUserId: string, page = 1, limit = 50) {
    const offset = (page - 1) * limit;

    const { count, rows: messages } = await Message.findAndCountAll({
      where: {
        [Op.or]: [
          { sender_id: userId, receiver_id: otherUserId },
          { sender_id: otherUserId, receiver_id: userId },
        ],
      },
      include: [
        {
          association: 'sender',
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

    // Mark messages as read
    await Message.update(
      {
        read: true,
        read_at: new Date(),
      },
      {
        where: {
          sender_id: otherUserId,
          receiver_id: userId,
          read: false,
        },
      }
    );

    return {
      messages: messages.reverse(),
      pagination: {
        total: count,
        page,
        limit,
        pages: Math.ceil(count / limit),
      },
    };
  }

  async getConversations(userId: string): Promise<Conversation[]> {
    // Get all unique conversation partners
    const sentMessages = await Message.findAll({
      attributes: ['receiver_id'],
      where: { sender_id: userId },
      group: ['receiver_id'],
      raw: true,
    });

    const receivedMessages = await Message.findAll({
      attributes: ['sender_id'],
      where: { receiver_id: userId },
      group: ['sender_id'],
      raw: true,
    });

    const userIds = [
      ...sentMessages.map((m) => m.receiver_id),
      ...receivedMessages.map((m) => m.sender_id),
    ];

    const uniqueUserIds = [...new Set(userIds)];

    // Get last message and unread count for each conversation
    const conversations = await Promise.all(
      uniqueUserIds.map(async (otherUserId) => {
        // Get last message
        const lastMessage = await Message.findOne({
          where: {
            [Op.or]: [
              { sender_id: userId, receiver_id: otherUserId },
              { sender_id: otherUserId, receiver_id: userId },
            ],
          },
          include: [
            {
              association: 'sender',
              attributes: ['id', 'first_name', 'last_name', 'profile_image'],
            },
          ],
          order: [['created_at', 'DESC']],
        });

        // Get unread count
        const unreadCount = await Message.count({
          where: {
            sender_id: otherUserId,
            receiver_id: userId,
            read: false,
          },
        });

        // Get other user info
        const otherUser = await User.findByPk(otherUserId, {
          attributes: ['id', 'first_name', 'last_name', 'profile_image', 'status'],
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
    const message = await Message.findByPk(messageId);

    if (!message) {
      throw new Error('Message not found');
    }

    if (message.receiver_id !== userId) {
      throw new Error('Unauthorized');
    }

    await message.update({
      read: true,
      read_at: new Date(),
    });

    return message;
  }

  async deleteMessage(messageId: string, userId: string) {
    const message = await Message.findByPk(messageId);

    if (!message) {
      throw new Error('Message not found');
    }

    if (message.sender_id !== userId) {
      throw new Error('Unauthorized - only sender can delete message');
    }

    await message.destroy();
    return { success: true };
  }

  // ============================================
  // LOAD/BID RELATED MESSAGES
  // ============================================

  async getLoadMessages(loadId: string, userId: string) {
    // Verify user is load owner
    const load = await Load.findByPk(loadId);

    if (!load) {
      throw new Error('Load not found');
    }

    if (load.owner_id !== userId) {
      throw new Error('Unauthorized');
    }

    return await Message.findAll({
      where: { load_id: loadId },
      include: [
        {
          association: 'sender',
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

  async getBidMessages(bidId: string, userId: string) {
    // Verify user is involved in bid
    const bid = await Bid.findByPk(bidId, {
      include: [{
        association: 'load',
      }],
    });

    if (!bid) {
      throw new Error('Bid not found');
    }

    if (bid.driver_id !== userId && bid.load.owner_id !== userId) {
      throw new Error('Unauthorized');
    }

    return await Message.findAll({
      where: { bid_id: bidId },
      include: [
        {
          association: 'sender',
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

  // ============================================
  // ANALYTICS
  // ============================================

  async getUnreadCount(userId: string): Promise<number> {
    return await Message.count({
      where: {
        receiver_id: userId,
        read: false,
      },
    });
  }

  async getMessageStats(userId: string) {
    const [sent, received, unread] = await Promise.all([
      Message.count({ where: { sender_id: userId } }),
      Message.count({ where: { receiver_id: userId } }),
      Message.count({ where: { receiver_id: userId, read: false } }),
    ]);

    return {
      sent,
      received,
      unread,
      total: sent + received,
    };
  }

  // ============================================
  // NEW METHODS FOR SEQUELIZE
  // ============================================

  async markAllAsRead(userId: string, otherUserId?: string) {
    const whereClause: any = {
      receiver_id: userId,
      read: false,
    };

    if (otherUserId) {
      whereClause.sender_id = otherUserId;
    }

    const result = await Message.update(
      {
        read: true,
        read_at: new Date(),
      },
      {
        where: whereClause,
      }
    );

    return { updated: result[0] };
  }

  async getRecentConversations(userId: string, limit = 10) {
    // Get the most recent conversations
    const messages = await Message.findAll({
      where: {
        [Op.or]: [
          { sender_id: userId },
          { receiver_id: userId },
        ],
      },
      include: [
        {
          association: 'sender',
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

    // Group by conversation partner
    const conversationMap = new Map();
    
    for (const message of messages) {
      const otherUserId = message.sender_id === userId ? message.receiver_id : message.sender_id;
      
      if (!conversationMap.has(otherUserId)) {
        const otherUser = message.sender_id === userId ? message.receiver : message.sender;
        conversationMap.set(otherUserId, {
          user: otherUser,
          lastMessage: message,
        });
      }
    }

    return Array.from(conversationMap.values());
  }

  async searchMessages(userId: string, query: string, limit = 50) {
    return await Message.findAll({
      where: {
        [Op.or]: [
          { sender_id: userId },
          { receiver_id: userId },
        ],
        content: { [Op.iLike]: `%${query}%` },
      },
      include: [
        {
          association: 'sender',
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

  async getMessageById(messageId: string, userId: string) {
    const message = await Message.findByPk(messageId, {
      include: [
        {
          association: 'sender',
          attributes: ['id', 'first_name', 'last_name', 'profile_image'],
        },
        {
          association: 'receiver',
          attributes: ['id', 'first_name', 'last_name', 'profile_image'],
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

    if (!message) {
      throw new Error('Message not found');
    }

    if (message.sender_id !== userId && message.receiver_id !== userId) {
      throw new Error('Unauthorized');
    }

    // Mark as read if receiver
    if (message.receiver_id === userId && !message.read) {
      await message.markAsRead();
    }

    return message;
  }
}

export const messageService = new MessageService();