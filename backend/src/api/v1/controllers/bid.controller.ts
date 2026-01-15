// Bid Management Controller
// Location: backend/src/api/v1/controllers/bid.controller.ts

import { Response } from 'express';
import { AuthRequest } from '@/middleware/auth.middleware';
import { bidService } from '@/services/bid.service';
import { BidStatus } from '@/models/bid.model';

export const createBid = async (req: AuthRequest, res: Response) => {
  try {
    const bid = await bidService.createBid(req.user!.id, req.body);
    res.status(201).json({
      success: true,
      data: bid,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const updateBid = async (req: AuthRequest, res: Response) => {
  try {
    const { bidId } = req.params;
    const bid = await bidService.updateBid(bidId, req.user!.id, req.body);
    res.json({
      success: true,
      data: bid,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const withdrawBid = async (req: AuthRequest, res: Response) => {
  try {
    const { bidId } = req.params;
    const bid = await bidService.withdrawBid(bidId, req.user!.id);
    res.json({
      success: true,
      data: bid,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const acceptBid = async (req: AuthRequest, res: Response) => {
  try {
    const { bidId } = req.params;
    const result = await bidService.acceptBid(bidId, req.user!.id);
    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const rejectBid = async (req: AuthRequest, res: Response) => {
  try {
    const { bidId } = req.params;
    const { reason } = req.body;
    const bid = await bidService.rejectBid(bidId, req.user!.id, reason);
    res.json({
      success: true,
      data: bid,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const getBid = async (req: AuthRequest, res: Response) => {
  try {
    const { bidId } = req.params;
    const bid = await bidService.getBid(bidId);
    res.json({
      success: true,
      data: bid,
    });
  } catch (error: any) {
    res.status(404).json({
      success: false,
      message: error.message,
    });
  }
};

export const getLoadBids = async (req: AuthRequest, res: Response) => {
  try {
    const { loadId } = req.params;
    const bids = await bidService.getLoadBids(loadId, req.user?.id);
    res.json({
      success: true,
      data: bids,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const getUserBids = async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.query;
    const bids = await bidService.getUserBids(
      req.user!.id,
      status as BidStatus | undefined
    );
    res.json({
      success: true,
      data: bids,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const getUserReceivedBids = async (req: AuthRequest, res: Response) => {
  try {
    const bids = await bidService.getUserReceivedBids(req.user!.id);
    res.json({
      success: true,
      data: bids,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const getBidStats = async (req: AuthRequest, res: Response) => {
  try {
    const stats = await bidService.getBidStats(req.user!.id);
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

export const getLoadBidStats = async (req: AuthRequest, res: Response) => {
  try {
    const { loadId } = req.params;
    const stats = await bidService.getLoadBidStats(loadId);
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

export const getBidHistory = async (req: AuthRequest, res: Response) => {
  try {
    const { limit = 10 } = req.query;
    const history = await bidService.getBidHistory(
      req.user!.id,
      parseInt(limit as string)
    );
    res.json({
      success: true,
      data: history,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const canBidOnLoad = async (req: AuthRequest, res: Response) => {
  try {
    const { loadId } = req.params;
    const result = await bidService.canBidOnLoad(req.user!.id, loadId);
    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};