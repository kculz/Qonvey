// V1 API Routes Index
// Location: backend/src/api/v1/index.ts

import { Router } from 'express';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import loadRoutes from './routes/load.routes';
import bidRoutes from './routes/bid.routes';
import tripRoutes from './routes/trip.routes';
import vehicleRoutes from './routes/vehicle.routes';
import subscriptionRoutes from './routes/subscription.routes';
import paymentRoutes from './routes/payment.routes';
import reviewRoutes from './routes/review.routes';
import notificationRoutes from './routes/notification.routes';
import messageRoutes from './routes/message.routes';
import callRoutes from './routes/call.routes';
import uploadRoutes from './routes/upload.routes';

const router = Router();

// Mount routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/loads', loadRoutes);
router.use('/bids', bidRoutes);
router.use('/trips', tripRoutes);
router.use('/vehicles', vehicleRoutes);
router.use('/subscriptions', subscriptionRoutes);
router.use('/payments', paymentRoutes);
router.use('/reviews', reviewRoutes);
router.use('/notifications', notificationRoutes);
router.use('/messages', messageRoutes);
router.use('/calls', callRoutes);
router.use('/upload', uploadRoutes);

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'API is running',
    version: 'v1',
    timestamp: new Date().toISOString(),
  });
});

export default router;