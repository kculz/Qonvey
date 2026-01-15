// backend/src/api/v1/routes/upload.routes.ts

import { Router } from 'express';
import multer from 'multer';
import { 
  authMiddleware, 
  requireRole 
} from '@/middleware/auth.middleware';
import * as uploadController from '@/api/v1/controllers/upload.controller';
import { UserRole } from '@/models/user.model';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(), // Store in memory for processing
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
});

// Public endpoints
router.get('/storage/info', uploadController.getStorageInfo);
router.get('/file/info', uploadController.getFileInfo);

// Protected endpoints (requires authentication)
router.post(
  '/upload/image',
  authMiddleware,
  upload.single('file'),
  uploadController.uploadImage
);

router.post(
  '/upload/document',
  authMiddleware,
  upload.single('file'),
  uploadController.uploadDocument
);

router.post(
  '/upload/profile-image',
  authMiddleware,
  upload.single('file'),
  uploadController.uploadProfileImage
);

router.post(
  '/upload/vehicle-image',
  authMiddleware,
  upload.single('file'),
  uploadController.uploadVehicleImage
);

router.post(
  '/upload/multiple',
  authMiddleware,
  upload.array('files', 10), // Max 10 files
  uploadController.uploadMultiple
);

router.delete(
  '/file',
  authMiddleware,
  uploadController.deleteFile
);

router.delete(
  '/file/url',
  authMiddleware,
  uploadController.deleteFileByUrl
);

router.post(
  '/file/copy',
  authMiddleware,
  uploadController.copyFile
);

// // Admin endpoints
// router.post(
//   '/admin/cleanup-temp',
//   authMiddleware,
//   requireRole([UserRole.ADMIN]),
//   uploadController.cleanupTempFiles
// );

// router.get(
//   '/admin/storage-stats',
//   authMiddleware,
//   requireRole([UserRole.ADMIN]),
//   uploadController.getStorageStats
// );

export default router;