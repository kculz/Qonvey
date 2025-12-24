// Notification Management Routes
// Location: backend/src/api/v1/routes/notification.routes.ts

import { Router } from 'express';
import {
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getUnreadCount,
  sendTestNotification,
} from '../controllers/notification.controller';
import { authMiddleware } from '@/middleware/auth.middleware';

const router = Router();

// Notification retrieval
router.get('/', authMiddleware, getUserNotifications);
router.get('/unread-count', authMiddleware, getUnreadCount);

// Notification actions
router.post('/:notificationId/read', authMiddleware, markAsRead);
router.post('/mark-all-read', authMiddleware, markAllAsRead);
router.delete('/:notificationId', authMiddleware, deleteNotification);

// Test notification (for development)
router.post('/test', authMiddleware, sendTestNotification);

export default router;