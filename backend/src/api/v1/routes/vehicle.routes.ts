// Vehicle Management Routes
// Location: backend/src/api/v1/routes/vehicle.routes.ts

import { Router } from 'express';
import {
  createVehicle,
  updateVehicle,
  deleteVehicle,
  deactivateVehicle,
  activateVehicle,
  getVehicle,
  getUserVehicles,
  searchVehicles,
  uploadInsurance,
  uploadRegistration,
  uploadImages,
  removeImage,
  getVehicleStats,
  getUserVehicleStats,
  validateVehicleForBid,
  getAvailableVehiclesForLoad,
  getVehicleUsageHistory,
} from '../controllers/vehicle.controller';
import { authMiddleware, requireRole } from '@/middleware/auth.middleware';

const router = Router();

// Vehicle CRUD
router.post('/', authMiddleware, requireRole('DRIVER', 'FLEET_OWNER'), createVehicle);
router.put('/:vehicleId', authMiddleware, updateVehicle);
router.delete('/:vehicleId', authMiddleware, deleteVehicle);
router.post('/:vehicleId/deactivate', authMiddleware, deactivateVehicle);
router.post('/:vehicleId/activate', authMiddleware, activateVehicle);

// Vehicle retrieval
router.get('/search', searchVehicles);
router.get('/my-vehicles', authMiddleware, getUserVehicles);
router.get('/stats', authMiddleware, getUserVehicleStats);
router.get('/:vehicleId', getVehicle);
router.get('/:vehicleId/stats', getVehicleStats);
router.get('/:vehicleId/usage-history', getVehicleUsageHistory);

// Vehicle documents
router.post('/:vehicleId/insurance', authMiddleware, uploadInsurance);
router.post('/:vehicleId/registration', authMiddleware, uploadRegistration);
router.post('/:vehicleId/images', authMiddleware, uploadImages);
router.delete('/:vehicleId/images', authMiddleware, removeImage);

// Vehicle validation
router.get('/:vehicleId/validate', authMiddleware, validateVehicleForBid);
router.get('/available/load/:loadId', authMiddleware, getAvailableVehiclesForLoad);

export default router;