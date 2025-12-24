// User Management Routes
// Location: backend/src/api/v1/routes/user.routes.ts

import { Router } from 'express';
import {
  getCurrentUser,
  updateProfile,
  updateFCMToken,
  changePassword,
  deleteAccount,
  verifyOTP,
  resendOTP,
  forgotPassword,
  resetPassword,
} from '../controllers/user.controller';
import { authMiddleware } from '@/middleware/auth.middleware';
import { otpLimiter } from '@/middleware/rateLimiter.middleware';

const router = Router();

// User profile
router.get('/me', authMiddleware, getCurrentUser);
router.put('/profile', authMiddleware, updateProfile);
router.post('/fcm-token', authMiddleware, updateFCMToken);

// Password management
router.post('/change-password', authMiddleware, changePassword);
router.post('/forgot-password', otpLimiter, forgotPassword);
router.post('/reset-password', resetPassword);

// OTP verification
router.post('/verify-otp', verifyOTP);
router.post('/resend-otp', otpLimiter, resendOTP);

// Account deletion
router.delete('/account', authMiddleware, deleteAccount);

export default router;