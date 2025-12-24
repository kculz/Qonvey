// Message Management Controller
// Location: backend/src/api/v1/controllers/message.controller.ts

import { Response } from 'express';
import { AuthRequest } from '@/middleware/auth.middleware';
import { messageService } from '@/services/message.service';

export const sendMessage = async (req: AuthRequest, res: Response) => {
  try {
    const message = await messageService.sendMessage(req.user!.id, req.body);
    res.status(201).json({
      success: true,
      data: message,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const getConversation = async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const result = await messageService.getConversation(
      req.user!.id,
      userId,
      parseInt(page as string),
      parseInt(limit as string)
    );
    res.json({
      success: true,
      data: result.messages,
      pagination: result.pagination,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const getConversations = async (req: AuthRequest, res: Response) => {
  try {
    const conversations = await messageService.getConversations(req.user!.id);
    res.json({
      success: true,
      data: conversations,
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
    const { messageId } = req.params;
    const message = await messageService.markAsRead(messageId, req.user!.id);
    res.json({
      success: true,
      data: message,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const deleteMessage = async (req: AuthRequest, res: Response) => {
  try {
    const { messageId } = req.params;
    await messageService.deleteMessage(messageId, req.user!.id);
    res.json({
      success: true,
      message: 'Message deleted successfully',
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const getLoadMessages = async (req: AuthRequest, res: Response) => {
  try {
    const { loadId } = req.params;
    const messages = await messageService.getLoadMessages(loadId, req.user!.id);
    res.json({
      success: true,
      data: messages,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const getBidMessages = async (req: AuthRequest, res: Response) => {
  try {
    const { bidId } = req.params;
    const messages = await messageService.getBidMessages(bidId, req.user!.id);
    res.json({
      success: true,
      data: messages,
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
    const count = await messageService.getUnreadCount(req.user!.id);
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

export const getMessageStats = async (req: AuthRequest, res: Response) => {
  try {
    const stats = await messageService.getMessageStats(req.user!.id);
    res.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};