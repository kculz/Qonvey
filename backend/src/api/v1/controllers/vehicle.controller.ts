// Vehicle Management Controller
// Location: backend/src/api/v1/controllers/vehicle.controller.ts

import { Response } from 'express';
import { AuthRequest } from '@/middleware/auth.middleware';
import { vehicleService } from '@/services/vehicle.service';
import { VehicleType } from '@/models/vehicle.model';

export const createVehicle = async (req: AuthRequest, res: Response) => {
  try {
    const vehicle = await vehicleService.createVehicle(req.user!.id, req.body);
    res.status(201).json({
      success: true,
      data: vehicle,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const updateVehicle = async (req: AuthRequest, res: Response) => {
  try {
    const { vehicleId } = req.params;
    const vehicle = await vehicleService.updateVehicle(
      vehicleId,
      req.user!.id,
      req.body
    );
    res.json({
      success: true,
      data: vehicle,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const deleteVehicle = async (req: AuthRequest, res: Response) => {
  try {
    const { vehicleId } = req.params;
    await vehicleService.deleteVehicle(vehicleId, req.user!.id);
    res.json({
      success: true,
      message: 'Vehicle deleted successfully',
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const deactivateVehicle = async (req: AuthRequest, res: Response) => {
  try {
    const { vehicleId } = req.params;
    const vehicle = await vehicleService.deactivateVehicle(
      vehicleId,
      req.user!.id
    );
    res.json({
      success: true,
      data: vehicle,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const activateVehicle = async (req: AuthRequest, res: Response) => {
  try {
    const { vehicleId } = req.params;
    const vehicle = await vehicleService.activateVehicle(
      vehicleId,
      req.user!.id
    );
    res.json({
      success: true,
      data: vehicle,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const getVehicle = async (req: AuthRequest, res: Response) => {
  try {
    const { vehicleId } = req.params;
    const vehicle = await vehicleService.getVehicle(vehicleId);
    res.json({
      success: true,
      data: vehicle,
    });
  } catch (error: any) {
    res.status(404).json({
      success: false,
      message: error.message,
    });
  }
};

export const getUserVehicles = async (req: AuthRequest, res: Response) => {
  try {
    const { activeOnly } = req.query;
    const vehicles = await vehicleService.getUserVehicles(
      req.user!.id,
      activeOnly === 'true'
    );
    res.json({
      success: true,
      data: vehicles,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const searchVehicles = async (req: AuthRequest, res: Response) => {
  try {
    const { type, minCapacity, maxCapacity, ownerId } = req.query;

    const filters = {
      type: type as VehicleType | undefined,
      minCapacity: minCapacity ? parseFloat(minCapacity as string) : undefined,
      maxCapacity: maxCapacity ? parseFloat(maxCapacity as string) : undefined,
      ownerId: ownerId as string | undefined,
    };

    const vehicles = await vehicleService.searchVehicles(filters);
    res.json({
      success: true,
      data: vehicles,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const uploadInsurance = async (req: AuthRequest, res: Response) => {
  try {
    const { vehicleId } = req.params;
    const { insuranceUrl } = req.body;
    const vehicle = await vehicleService.uploadInsurance(
      vehicleId,
      req.user!.id,
      insuranceUrl
    );
    res.json({
      success: true,
      data: vehicle,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const uploadRegistration = async (req: AuthRequest, res: Response) => {
  try {
    const { vehicleId } = req.params;
    const { registrationUrl } = req.body;
    const vehicle = await vehicleService.uploadRegistration(
      vehicleId,
      req.user!.id,
      registrationUrl
    );
    res.json({
      success: true,
      data: vehicle,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const uploadImages = async (req: AuthRequest, res: Response) => {
  try {
    const { vehicleId } = req.params;
    const { imageUrls } = req.body;
    const vehicle = await vehicleService.uploadImages(
      vehicleId,
      req.user!.id,
      imageUrls
    );
    res.json({
      success: true,
      data: vehicle,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const removeImage = async (req: AuthRequest, res: Response) => {
  try {
    const { vehicleId } = req.params;
    const { imageUrl } = req.body;
    const vehicle = await vehicleService.removeImage(
      vehicleId,
      req.user!.id,
      imageUrl
    );
    res.json({
      success: true,
      data: vehicle,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const getVehicleStats = async (req: AuthRequest, res: Response) => {
  try {
    const { vehicleId } = req.params;
    const stats = await vehicleService.getVehicleStats(vehicleId);
    res.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const getUserVehicleStats = async (req: AuthRequest, res: Response) => {
  try {
    const stats = await vehicleService.getUserVehicleStats(req.user!.id);
    res.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const validateVehicleForBid = async (req: AuthRequest, res: Response) => {
  try {
    const { vehicleId } = req.params;
    const { loadId } = req.query;
    const result = await vehicleService.validateVehicleForBid(
      vehicleId,
      loadId as string
    );
    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const getAvailableVehiclesForLoad = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const { loadId } = req.params;
    const vehicles = await vehicleService.getAvailableVehiclesForLoad(
      loadId,
      req.user!.id
    );
    res.json({
      success: true,
      data: vehicles,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const getVehicleUsageHistory = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const { vehicleId } = req.params;
    const { limit = 20 } = req.query;
    const history = await vehicleService.getVehicleUsageHistory(
      vehicleId,
      parseInt(limit as string)
    );
    res.json({
      success: true,
      data: history,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};