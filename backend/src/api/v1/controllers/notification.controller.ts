// Notification Management Controller
// Location: backend/src/api/v1/controllers/notification.controller.ts

import { Response } from 'express';
import { AuthRequest } from '@/middleware/auth.middleware';
import { notificationService } from '@/services/notification.service';

export const getUserNotifications = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const { limit = 50, unreadOnly } = req.query;
    const notifications = await notificationService.getUserNotifications(
      req.user!.id,
      parseInt(limit as string),
      unreadOnly === 'true'
    );
    res.json({
      success: true,
      data: notifications,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const markAsRead = async (req: AuthRequest, res: Response) => {
  try {
    const { notificationId } = req.params;
    const notification = await notificationService.markNotificationAsRead(
      notificationId
    );
    res.json({
      success: true,
      data: notification,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const markAllAsRead = async (req: AuthRequest, res: Response) => {
  try {
    await notificationService.markAllAsRead(req.user!.id);
    res.json({
      success: true,
      message: 'All notifications marked as read',
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const deleteNotification = async (req: AuthRequest, res: Response) => {
  try {
    const { notificationId } = req.params;
    await notificationService.deleteNotification(notificationId);
    res.json({
      success: true,
      message: 'Notification deleted',
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const getUnreadCount = async (req: AuthRequest, res: Response) => {
  try {
    const count = await notificationService.getUnreadCount(req.user!.id);
    res.json({
      success: true,
      data: { count },
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const sendTestNotification = async (req: AuthRequest, res: Response) => {
  try {
    const { title, body, type } = req.body;
    await notificationService.sendPushNotification(req.user!.id, {
      title,
      body,
      type,
    });
    res.json({
      success: true,
      message: 'Test notification sent',
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};