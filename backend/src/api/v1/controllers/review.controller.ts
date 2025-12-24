// Review Management Controller
// Location: backend/src/api/v1/controllers/review.controller.ts

import { Response } from 'express';
import { AuthRequest } from '@/middleware/auth.middleware';
import { reviewService } from '@/services/review.service';

export const createReview = async (req: AuthRequest, res: Response) => {
  try {
    const review = await reviewService.createReview(req.user!.id, req.body);
    res.status(201).json({
      success: true,
      data: review,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const getReview = async (req: AuthRequest, res: Response) => {
  try {
    const { reviewId } = req.params;
    const review = await reviewService.getReview(reviewId);
    res.json({
      success: true,
      data: review,
    });
  } catch (error: any) {
    res.status(404).json({
      success: false,
      message: error.message,
    });
  }
};

export const getUserReviews = async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const result = await reviewService.getUserReviews(
      userId,
      parseInt(page as string),
      parseInt(limit as string)
    );
    res.json({
      success: true,
      data: result.reviews,
      pagination: result.pagination,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const getUserReviewsGiven = async (req: AuthRequest, res: Response) => {
  try {
    const reviews = await reviewService.getUserReviewsGiven(req.user!.id);
    res.json({
      success: true,
      data: reviews,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const getTripReview = async (req: AuthRequest, res: Response) => {
  try {
    const { tripId } = req.params;
    const review = await reviewService.getTripReview(tripId);
    res.json({
      success: true,
      data: review,
    });
  } catch (error: any) {
    res.status(404).json({
      success: false,
      message: error.message,
    });
  }
};

export const getUserRatingBreakdown = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const { userId } = req.params;
    const breakdown = await reviewService.getUserRatingBreakdown(userId);
    res.json({
      success: true,
      data: breakdown,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const getRecentReviews = async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const { limit = 5 } = req.query;
    const reviews = await reviewService.getRecentReviews(
      userId,
      parseInt(limit as string)
    );
    res.json({
      success: true,
      data: reviews,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const getPendingReviews = async (req: AuthRequest, res: Response) => {
  try {
    const pending = await reviewService.getPendingReviews(req.user!.id);
    res.json({
      success: true,
      data: pending,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const canReviewTrip = async (req: AuthRequest, res: Response) => {
  try {
    const { tripId } = req.params;
    const result = await reviewService.canReviewTrip(req.user!.id, tripId);
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

export const getTopRatedUsers = async (req: AuthRequest, res: Response) => {
  try {
    const { role, limit = 10 } = req.query;
    const users = await reviewService.getTopRatedUsers(
      role as 'DRIVER' | 'CARGO_OWNER' | undefined,
      parseInt(limit as string)
    );
    res.json({
      success: true,
      data: users,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const getUserReviewStats = async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const stats = await reviewService.getUserReviewStats(userId);
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