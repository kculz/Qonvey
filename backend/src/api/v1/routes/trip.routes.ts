// Trip Management Routes
// Location: backend/src/api/v1/routes/trip.routes.ts

import { Router } from 'express';
import {
  startTrip,
  updateLocation,
  uploadProofOfPickup,
  uploadProofOfDelivery,
  completeTrip,
  cancelTrip,
  getTrip,
  getUserTrips,
  getActiveTrips,
  getTripRoute,
  getTripStats,
  getTripHistory,
  updatePaymentMethod,
  markPaymentCompleted,
  canStartTrip,
  getUpcomingTrips,
} from '../controllers/trip.controller';
import { authMiddleware } from '@/middleware/auth.middleware';

const router = Router();

// Trip lifecycle
router.post('/:tripId/start', authMiddleware, startTrip);
router.post('/:tripId/location', authMiddleware, updateLocation);
router.post('/:tripId/proof-of-pickup', authMiddleware, uploadProofOfPickup);
router.post('/:tripId/proof-of-delivery', authMiddleware, uploadProofOfDelivery);
router.post('/:tripId/complete', authMiddleware, completeTrip);
router.post('/:tripId/cancel', authMiddleware, cancelTrip);

// Trip retrieval
router.get('/my-trips', authMiddleware, getUserTrips);
router.get('/active', authMiddleware, getActiveTrips);
router.get('/upcoming', authMiddleware, getUpcomingTrips);
router.get('/stats', authMiddleware, getTripStats);
router.get('/history', authMiddleware, getTripHistory);
router.get('/:tripId', authMiddleware, getTrip);
router.get('/:tripId/route', authMiddleware, getTripRoute);
router.get('/:tripId/can-start', authMiddleware, canStartTrip);

// Payment
router.post('/:tripId/payment-method', authMiddleware, updatePaymentMethod);
router.post('/:tripId/payment-completed', authMiddleware, markPaymentCompleted);

export default router;