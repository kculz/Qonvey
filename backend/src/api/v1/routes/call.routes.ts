// Call Management Routes
// Location: backend/src/api/v1/routes/call.routes.ts

import { Router } from 'express';
import {
  initiateCall,
  answerCall,
  rejectCall,
  endCall,
  cancelCall,
  getCall,
  getCallHistory,
  getActiveCalls,
  getCallsWithUser,
  getCallStats,
} from '../controllers/call.controller';
import { authMiddleware } from '@/middleware/auth.middleware';

const router = Router();

// Call actions
router.post('/', authMiddleware, initiateCall);
router.post('/:callId/answer', authMiddleware, answerCall);
router.post('/:callId/reject', authMiddleware, rejectCall);
router.post('/:callId/end', authMiddleware, endCall);
router.post('/:callId/cancel', authMiddleware, cancelCall);

// Retrieve calls
router.get('/active', authMiddleware, getActiveCalls);
router.get('/history', authMiddleware, getCallHistory);
router.get('/user/:userId', authMiddleware, getCallsWithUser);
router.get('/:callId', authMiddleware, getCall);

// Call stats
router.get('/stats', authMiddleware, getCallStats);

export default router;

