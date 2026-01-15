// Load Management Controller
// Location: backend/src/api/v1/controllers/load.controller.ts

import { Response } from 'express';
import { AuthRequest } from '@/middleware/auth.middleware';
import { loadService } from '@/services/load.service';
import { LoadStatus, VehicleType } from '@/models/load.model';

export const createLoad = async (req: AuthRequest, res: Response) => {
  try {
    const load = await loadService.createLoad(req.user!.id, req.body);
    res.status(201).json({
      success: true,
      data: load,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const updateLoad = async (req: AuthRequest, res: Response) => {
  try {
    const { loadId } = req.params;
    const load = await loadService.updateLoad(loadId, req.user!.id, req.body);
    res.json({
      success: true,
      data: load,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const publishLoad = async (req: AuthRequest, res: Response) => {
  try {
    const { loadId } = req.params;
    const load = await loadService.publishLoad(loadId, req.user!.id);
    res.json({
      success: true,
      data: load,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const deleteLoad = async (req: AuthRequest, res: Response) => {
  try {
    const { loadId } = req.params;
    await loadService.deleteLoad(loadId, req.user!.id);
    res.json({
      success: true,
      message: 'Load deleted successfully',
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const cancelLoad = async (req: AuthRequest, res: Response) => {
  try {
    const { loadId } = req.params;
    const { reason } = req.body;
    const load = await loadService.cancelLoad(loadId, req.user!.id, reason);
    res.json({
      success: true,
      data: load,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const getLoad = async (req: AuthRequest, res: Response) => {
  try {
    const { loadId } = req.params;
    const load = await loadService.getLoad(loadId, req.user?.id);
    res.json({
      success: true,
      data: load,
    });
  } catch (error: any) {
    res.status(404).json({
      success: false,
      message: error.message,
    });
  }
};

export const getUserLoads = async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.query;
    const loads = await loadService.getUserLoads(
      req.user!.id,
      status as LoadStatus | undefined
    );
    res.json({
      success: true,
      data: loads,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const searchLoads = async (req: AuthRequest, res: Response) => {
  try {
    const {
      status,
      cargoType,
      vehicleTypes,
      pickupCity,
      deliveryCity,
      minWeight,
      maxWeight,
      minPrice,
      maxPrice,
      pickupDateFrom,
      pickupDateTo,
      searchQuery,
      page = 1,
      limit = 20,
    } = req.query;

    const filters = {
      status: status as LoadStatus | undefined,
      cargoType: cargoType as string | undefined,
      vehicleTypes: vehicleTypes
        ? (vehicleTypes as string).split(',') as VehicleType[]
        : undefined,
      pickupCity: pickupCity as string | undefined,
      deliveryCity: deliveryCity as string | undefined,
      minWeight: minWeight ? parseFloat(minWeight as string) : undefined,
      maxWeight: maxWeight ? parseFloat(maxWeight as string) : undefined,
      minPrice: minPrice ? parseFloat(minPrice as string) : undefined,
      maxPrice: maxPrice ? parseFloat(maxPrice as string) : undefined,
      pickupDateFrom: pickupDateFrom
        ? new Date(pickupDateFrom as string)
        : undefined,
      pickupDateTo: pickupDateTo ? new Date(pickupDateTo as string) : undefined,
      searchQuery: searchQuery as string | undefined,
    };

    const result = await loadService.searchLoads(
      filters,
      req.user?.id,
      parseInt(page as string),
      parseInt(limit as string)
    );

    res.json({
      success: true,
      data: result.loads,
      pagination: result.pagination,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const getLoadStats = async (req: AuthRequest, res: Response) => {
  try {
    const stats = await loadService.getLoadStats(req.user!.id);
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

export const createLoadTemplate = async (req: AuthRequest, res: Response) => {
  try {
    const { name, ...loadData } = req.body;
    const template = await loadService.createLoadTemplate(
      req.user!.id,
      loadData,
      name
    );
    res.status(201).json({
      success: true,
      data: template,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const getUserTemplates = async (req: AuthRequest, res: Response) => {
  try {
    const templates = await loadService.getUserTemplates(req.user!.id);
    res.json({
      success: true,
      data: templates,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const deleteTemplate = async (req: AuthRequest, res: Response) => {
  try {
    const { templateId } = req.params;
    await loadService.deleteTemplate(templateId, req.user!.id);
    res.json({
      success: true,
      message: 'Template deleted successfully',
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const createLoadFromTemplate = async (req: AuthRequest, res: Response) => {
  try {
    const { templateId } = req.params;
    const load = await loadService.createLoadFromTemplate(
      req.user!.id,
      templateId,
      req.body
    );
    res.status(201).json({
      success: true,
      data: load,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const createSavedSearch = async (req: AuthRequest, res: Response) => {
  try {
    const { name, filters, notifyOnNew } = req.body;
    const savedSearch = await loadService.createSavedSearch(
      req.user!.id,
      name,
      filters,
      notifyOnNew
    );
    res.status(201).json({
      success: true,
      data: savedSearch,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const getUserSavedSearches = async (req: AuthRequest, res: Response) => {
  try {
    const searches = await loadService.getUserSavedSearches(req.user!.id);
    res.json({
      success: true,
      data: searches,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const deleteSavedSearch = async (req: AuthRequest, res: Response) => {
  try {
    const { searchId } = req.params;
    await loadService.deleteSavedSearch(searchId, req.user!.id);
    res.json({
      success: true,
      message: 'Saved search deleted successfully',
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};