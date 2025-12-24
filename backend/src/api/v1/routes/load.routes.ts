// Load Management Routes
// Location: backend/src/api/v1/routes/load.routes.ts

import { Router } from 'express';
import {
  createLoad,
  updateLoad,
  publishLoad,
  deleteLoad,
  cancelLoad,
  getLoad,
  getUserLoads,
  searchLoads,
  getLoadStats,
  createLoadTemplate,
  getUserTemplates,
  deleteTemplate,
  createLoadFromTemplate,
  createSavedSearch,
  getUserSavedSearches,
  deleteSavedSearch,
} from '../controllers/load.controller';
import { authMiddleware, optionalAuthMiddleware, requireRole } from '@/middleware/auth.middleware';
import { loadPostingLimiter } from '@/middleware/rateLimiter.middleware';

const router = Router();

// Load CRUD
router.post('/', authMiddleware, requireRole('CARGO_OWNER', 'FLEET_OWNER'), loadPostingLimiter, createLoad);
router.put('/:loadId', authMiddleware, updateLoad);
router.post('/:loadId/publish', authMiddleware, publishLoad);
router.delete('/:loadId', authMiddleware, deleteLoad);
router.post('/:loadId/cancel', authMiddleware, cancelLoad);

// Load retrieval
router.get('/search', optionalAuthMiddleware, searchLoads);
router.get('/my-loads', authMiddleware, getUserLoads);
router.get('/stats', authMiddleware, getLoadStats);
router.get('/:loadId', optionalAuthMiddleware, getLoad);

// Load templates
router.post('/templates', authMiddleware, createLoadTemplate);
router.get('/templates/my-templates', authMiddleware, getUserTemplates);
router.delete('/templates/:templateId', authMiddleware, deleteTemplate);
router.post('/templates/:templateId/create-load', authMiddleware, createLoadFromTemplate);

// Saved searches
router.post('/saved-searches', authMiddleware, createSavedSearch);
router.get('/saved-searches/my-searches', authMiddleware, getUserSavedSearches);
router.delete('/saved-searches/:searchId', authMiddleware, deleteSavedSearch);

export default router;