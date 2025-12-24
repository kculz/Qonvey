// Call Management Controller
// Location: backend/src/api/v1/controllers/call.controller.ts

import { Response } from 'express';
import { AuthRequest } from '@/middleware/auth.middleware';
import { callService } from '@/services/call.service';

export const initiateCall = async (req: AuthRequest, res: Response) => {
  try {
    const call = await callService.initiateCall(req.user!.id, req.body);
    res.status(201).json({
      success: true,
      data: call,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const answerCall = async (req: AuthRequest, res: Response) => {
  try {
    const { callId } = req.params;
    const call = await callService.answerCall(callId, req.user!.id);
    res.json({
      success: true,
      data: call,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const rejectCall = async (req: AuthRequest, res: Response) => {
  try {
    const { callId } = req.params;
    const call = await callService.rejectCall(callId, req.user!.id);
    res.json({
      success: true,
      data: call,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const endCall = async (req: AuthRequest, res: Response) => {
  try {
    const { callId } = req.params;
    const call = await callService.endCall(callId, req.user!.id);
    res.json({
      success: true,
      data: call,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const cancelCall = async (req: AuthRequest, res: Response) => {
  try {
    const { callId } = req.params;
    const call = await callService.cancelCall(callId, req.user!.id);
    res.json({
      success: true,
      data: call,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const getCall = async (req: AuthRequest, res: Response) => {
  try {
    const { callId } = req.params;
    const call = await callService.getCall(callId, req.user!.id);
    res.json({
      success: true,
      data: call,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const getCallHistory = async (req: AuthRequest, res: Response) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const result = await callService.getCallHistory(
      req.user!.id,
      parseInt(page as string),
      parseInt(limit as string)
    );
    res.json({
      success: true,
      data: result.calls,
      pagination: result.pagination,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const getActiveCalls = async (req: AuthRequest, res: Response) => {
  try {
    const calls = await callService.getActiveCalls(req.user!.id);
    res.json({
      success: true,
      data: calls,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const getCallsWithUser = async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const result = await callService.getCallsWithUser(
      req.user!.id,
      userId,
      parseInt(page as string),
      parseInt(limit as string)
    );
    res.json({
      success: true,
      data: result.calls,
      pagination: result.pagination,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const getCallStats = async (req: AuthRequest, res: Response) => {
  try {
    const stats = await callService.getCallStats(req.user!.id);
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

