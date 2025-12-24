// File Upload Routes
// Location: backend/src/api/v1/routes/upload.routes.ts

import { Router } from 'express';
import multer from 'multer';
import {
  uploadImage,
  uploadDocument,
  uploadMultiple,
  deleteFile,
  getStorageInfo,
} from '../controllers/upload.controller';
import { authMiddleware } from '@/middleware/auth.middleware';
import { uploadLimiter } from '@/middleware/rateLimiter.middleware';

const router = Router();

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
});

// Upload routes
router.post(
  '/image',
  authMiddleware,
  uploadLimiter,
  upload.single('file'),
  uploadImage
);

router.post(
  '/document',
  authMiddleware,
  uploadLimiter,
  upload.single('file'),
  uploadDocument
);

router.post(
  '/multiple',
  authMiddleware,
  uploadLimiter,
  upload.array('files', 10), // Max 10 files
  uploadMultiple
);

router.delete('/file', authMiddleware, deleteFile);

// Storage info
router.get('/storage-info', authMiddleware, getStorageInfo);

export default router;