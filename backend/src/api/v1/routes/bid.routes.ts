// Bid Management Routes
// Location: backend/src/api/v1/routes/bid.routes.ts

import { Router } from 'express';
import {
  createBid,
  updateBid,
  withdrawBid,
  acceptBid,
  rejectBid,
  getBid,
  getLoadBids,
  getUserBids,
  getUserReceivedBids,
  getBidStats,
  getLoadBidStats,
  getBidHistory,
  canBidOnLoad,
} from '../controllers/bid.controller';
import { authMiddleware, requireRole } from '@/middleware/auth.middleware';
import { bidPlacingLimiter } from '@/middleware/rateLimiter.middleware';
import { UserRole } from '@/models/user.model';

const router = Router();

// Bid CRUD
router.post('/', authMiddleware, requireRole(UserRole.DRIVER, UserRole.FLEET_OWNER), bidPlacingLimiter, createBid);
router.put('/:bidId', authMiddleware, updateBid);
router.post('/:bidId/withdraw', authMiddleware, withdrawBid);
router.post('/:bidId/accept', authMiddleware, requireRole(UserRole.CARGO_OWNER, UserRole.FLEET_OWNER), acceptBid);
router.post('/:bidId/reject', authMiddleware, requireRole(UserRole.CARGO_OWNER, UserRole.FLEET_OWNER), rejectBid);
// Bid retrieval
router.get('/my-bids', authMiddleware, getUserBids);
router.get('/received-bids', authMiddleware, getUserReceivedBids);
router.get('/stats', authMiddleware, getBidStats);
router.get('/history', authMiddleware, getBidHistory);
router.get('/load/:loadId', authMiddleware, getLoadBids);
router.get('/load/:loadId/stats', authMiddleware, getLoadBidStats);
router.get('/can-bid/:loadId', authMiddleware, canBidOnLoad);
router.get('/:bidId', authMiddleware, getBid);

export default router;