// Subscription Management Routes
// Location: backend/src/api/v1/routes/subscription.routes.ts

import { Router } from 'express';
import {
  getSubscription,
  upgradePlan,
  downgradePlan,
  cancelSubscription,
  renewSubscription,
  getFeatureAccess,
  checkCanPostLoad,
  checkCanPlaceBid,
  checkCanAddVehicle,
  checkCanAddTeamMember,
  getSubscriptionStats,
  getPlanPricing,
} from '../controllers/subscription.controller';
import { authMiddleware } from '@/middleware/auth.middleware';

const router = Router();

// Subscription management
router.get('/', authMiddleware, getSubscription);
router.post('/upgrade', authMiddleware, upgradePlan);
router.post('/downgrade', authMiddleware, downgradePlan);
router.post('/cancel', authMiddleware, cancelSubscription);
router.post('/renew', authMiddleware, renewSubscription);

// Feature access
router.get('/features', authMiddleware, getFeatureAccess);
router.get('/can-post-load', authMiddleware, checkCanPostLoad);
router.get('/can-place-bid', authMiddleware, checkCanPlaceBid);
router.get('/can-add-vehicle', authMiddleware, checkCanAddVehicle);
router.get('/can-add-team-member', authMiddleware, checkCanAddTeamMember);

// Subscription info
router.get('/stats', authMiddleware, getSubscriptionStats);
router.get('/pricing', getPlanPricing);

export default router;