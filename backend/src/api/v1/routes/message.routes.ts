// Message Management Routes
// Location: backend/src/api/v1/routes/message.routes.ts

import { Router } from 'express';
import {
  sendMessage,
  getConversation,
  getConversations,
  markAsRead,
  deleteMessage,
  getLoadMessages,
  getBidMessages,
  getUnreadCount,
  getMessageStats,
} from '../controllers/message.controller';
import { authMiddleware } from '@/middleware/auth.middleware';
import { messageLimiter } from '@/middleware/rateLimiter.middleware';

const router = Router();

// Message CRUD
router.post('/', authMiddleware, messageLimiter, sendMessage);
router.delete('/:messageId', authMiddleware, deleteMessage);

// Conversations
router.get('/conversations', authMiddleware, getConversations);
router.get('/conversation/:userId', authMiddleware, getConversation);

// Message actions
router.post('/:messageId/read', authMiddleware, markAsRead);

// Context-specific messages
router.get('/load/:loadId', authMiddleware, getLoadMessages);
router.get('/bid/:bidId', authMiddleware, getBidMessages);

// Message stats
router.get('/unread-count', authMiddleware, getUnreadCount);
router.get('/stats', authMiddleware, getMessageStats);

export default router;