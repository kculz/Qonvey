// Subscription Management Controller
// Location: backend/src/api/v1/controllers/subscription.controller.ts

import { Response } from 'express';
import { AuthRequest } from '@/middleware/auth.middleware';
import { subscriptionService } from '@/services/subscription.service';
import { PlanType } from '@prisma/client';

export const getSubscription = async (req: AuthRequest, res: Response) => {
  try {
    const subscription = await subscriptionService.getUserSubscription(
      req.user!.id
    );
    res.json({
      success: true,
      data: subscription,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const upgradePlan = async (req: AuthRequest, res: Response) => {
  try {
    const { plan, paymentReference } = req.body;
    const subscription = await subscriptionService.upgradePlan(
      req.user!.id,
      plan as PlanType,
      paymentReference
    );
    res.json({
      success: true,
      data: subscription,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const downgradePlan = async (req: AuthRequest, res: Response) => {
  try {
    const { reason } = req.body;
    const subscription = await subscriptionService.downgradePlan(
      req.user!.id,
      reason
    );
    res.json({
      success: true,
      data: subscription,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const cancelSubscription = async (req: AuthRequest, res: Response) => {
  try {
    const { reason } = req.body;
    const subscription = await subscriptionService.cancelSubscription(
      req.user!.id,
      reason
    );
    res.json({
      success: true,
      data: subscription,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const renewSubscription = async (req: AuthRequest, res: Response) => {
  try {
    const { paymentReference } = req.body;
    const subscription = await subscriptionService.renewSubscription(
      req.user!.id,
      paymentReference
    );
    res.json({
      success: true,
      data: subscription,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const getFeatureAccess = async (req: AuthRequest, res: Response) => {
  try {
    const features = await subscriptionService.getFeatureAccess(req.user!.id);
    res.json({
      success: true,
      data: features,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const checkCanPostLoad = async (req: AuthRequest, res: Response) => {
  try {
    const result = await subscriptionService.canPostLoad(req.user!.id);
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

export const checkCanPlaceBid = async (req: AuthRequest, res: Response) => {
  try {
    const result = await subscriptionService.canPlaceBid(req.user!.id);
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

export const checkCanAddVehicle = async (req: AuthRequest, res: Response) => {
  try {
    const result = await subscriptionService.canAddVehicle(req.user!.id);
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

export const checkCanAddTeamMember = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const result = await subscriptionService.canAddTeamMember(req.user!.id);
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

export const getSubscriptionStats = async (req: AuthRequest, res: Response) => {
  try {
    const stats = await subscriptionService.getSubscriptionStats(req.user!.id);
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

export const getPlanPricing = async (req: AuthRequest, res: Response) => {
  try {
    const pricing = await subscriptionService.getPlanPricing();
    res.json({
      success: true,
      data: pricing,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};