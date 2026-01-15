// Trip Management Controller
// Location: backend/src/api/v1/controllers/trip.controller.ts

import { Response } from 'express';
import { AuthRequest } from '@/middleware/auth.middleware';
import { tripService } from '@/services/trip.service';
import { TripStatus } from '@/models/trip.model';
import { PaymentMethod } from '@/models/subscription.model';

export const startTrip = async (req: AuthRequest, res: Response) => {
  try {
    const { tripId } = req.params;
    const { currentLocation } = req.body;
    const trip = await tripService.startTrip(
      tripId,
      req.user!.id,
      currentLocation
    );
    res.json({
      success: true,
      data: trip,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const updateLocation = async (req: AuthRequest, res: Response) => {
  try {
    const { tripId } = req.params;
    const location = req.body;
    const trip = await tripService.updateLocation(tripId, req.user!.id, location);
    res.json({
      success: true,
      data: trip,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const uploadProofOfPickup = async (req: AuthRequest, res: Response) => {
  try {
    const { tripId } = req.params;
    const { imageUrl } = req.body;
    const trip = await tripService.uploadProofOfPickup(
      tripId,
      req.user!.id,
      imageUrl
    );
    res.json({
      success: true,
      data: trip,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const uploadProofOfDelivery = async (req: AuthRequest, res: Response) => {
  try {
    const { tripId } = req.params;
    const { imageUrl, signature } = req.body;
    const trip = await tripService.uploadProofOfDelivery(
      tripId,
      req.user!.id,
      imageUrl,
      signature
    );
    res.json({
      success: true,
      data: trip,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const completeTrip = async (req: AuthRequest, res: Response) => {
  try {
    const { tripId } = req.params;
    const trip = await tripService.completeTrip(tripId, req.user!.id, req.body);
    res.json({
      success: true,
      data: trip,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const cancelTrip = async (req: AuthRequest, res: Response) => {
  try {
    const { tripId } = req.params;
    const { reason } = req.body;
    const trip = await tripService.cancelTrip(tripId, req.user!.id, reason);
    res.json({
      success: true,
      data: trip,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const getTrip = async (req: AuthRequest, res: Response) => {
  try {
    const { tripId } = req.params;
    const trip = await tripService.getTrip(tripId);
    res.json({
      success: true,
      data: trip,
    });
  } catch (error: any) {
    res.status(404).json({
      success: false,
      message: error.message,
    });
  }
};

export const getUserTrips = async (req: AuthRequest, res: Response) => {
  try {
    const { status, role = 'driver' } = req.query;
    const trips = await tripService.getUserTrips(
      req.user!.id,
      status as TripStatus | undefined,
      role as 'driver' | 'owner'
    );
    res.json({
      success: true,
      data: trips,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const getActiveTrips = async (req: AuthRequest, res: Response) => {
  try {
    const trips = await tripService.getActiveTrips(req.user!.id);
    res.json({
      success: true,
      data: trips,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const getTripRoute = async (req: AuthRequest, res: Response) => {
  try {
    const { tripId } = req.params;
    const route = await tripService.getTripRoute(tripId);
    res.json({
      success: true,
      data: route,
    });
  } catch (error: any) {
    res.status(404).json({
      success: false,
      message: error.message,
    });
  }
};

export const getTripStats = async (req: AuthRequest, res: Response) => {
  try {
    const { role = 'driver' } = req.query;
    const stats = await tripService.getTripStats(
      req.user!.id,
      role as 'driver' | 'owner'
    );
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

export const getTripHistory = async (req: AuthRequest, res: Response) => {
  try {
    const { limit = 20 } = req.query;
    const history = await tripService.getTripHistory(
      req.user!.id,
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

export const updatePaymentMethod = async (req: AuthRequest, res: Response) => {
  try {
    const { tripId } = req.params;
    const { paymentMethod } = req.body;
    const trip = await tripService.updatePaymentMethod(
      tripId,
      req.user!.id,
      paymentMethod as PaymentMethod
    );
    res.json({
      success: true,
      data: trip,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const markPaymentCompleted = async (req: AuthRequest, res: Response) => {
  try {
    const { tripId } = req.params;
    const { paymentMethod } = req.body;
    const trip = await tripService.markPaymentCompleted(
      tripId,
      req.user!.id,
      paymentMethod as PaymentMethod
    );
    res.json({
      success: true,
      data: trip,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const canStartTrip = async (req: AuthRequest, res: Response) => {
  try {
    const { tripId } = req.params;
    const result = await tripService.canStartTrip(tripId, req.user!.id);
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

export const getUpcomingTrips = async (req: AuthRequest, res: Response) => {
  try {
    const { days = 7 } = req.query;
    const trips = await tripService.getUpcomingTrips(
      req.user!.id,
      parseInt(days as string)
    );
    res.json({
      success: true,
      data: trips,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};