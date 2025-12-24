// Review Management Routes
// Location: backend/src/api/v1/routes/review.routes.ts

import { Router } from 'express';
import {
  createReview,
  getReview,
  getUserReviews,
  getUserReviewsGiven,
  getTripReview,
  getUserRatingBreakdown,
  getRecentReviews,
  getPendingReviews,
  canReviewTrip,
  getTopRatedUsers,
  getUserReviewStats,
} from '../controllers/review.controller';
import { authMiddleware } from '@/middleware/auth.middleware';

const router = Router();

// Review CRUD
router.post('/', authMiddleware, createReview);
router.get('/my-reviews-given', authMiddleware, getUserReviewsGiven);
router.get('/pending', authMiddleware, getPendingReviews);
router.get('/top-rated', getTopRatedUsers);

// User reviews
router.get('/user/:userId', getUserReviews);
router.get('/user/:userId/breakdown', getUserRatingBreakdown);
router.get('/user/:userId/recent', getRecentReviews);
router.get('/user/:userId/stats', getUserReviewStats);

// Trip reviews
router.get('/trip/:tripId', getTripReview);
router.get('/trip/:tripId/can-review', authMiddleware, canReviewTrip);

// Single review
router.get('/:reviewId', getReview);

export default router;