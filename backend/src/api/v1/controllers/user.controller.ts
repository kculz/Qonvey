// User Management Controller
// Location: backend/src/api/v1/controllers/user.controller.ts

import { Response } from 'express';
import { AuthRequest } from '@/middleware/auth.middleware';
import { authService } from '@/services/auth.service';

export const getCurrentUser = async (req: AuthRequest, res: Response) => {
  try {
    const user = await authService.getCurrentUser(req.user!.id);
    res.json({
      success: true,
      data: user,
    });
  } catch (error: any) {
    res.status(404).json({
      success: false,
      message: error.message,
    });
  }
};

export const updateProfile = async (req: AuthRequest, res: Response) => {
  try {
    const user = await authService.updateProfile(req.user!.id, req.body);
    res.json({
      success: true,
      data: user,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const updateFCMToken = async (req: AuthRequest, res: Response) => {
  try {
    const { fcmToken } = req.body;
    await authService.updateFCMToken(req.user!.id, fcmToken);
    res.json({
      success: true,
      message: 'FCM token updated',
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const changePassword = async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    await authService.changePassword(
      req.user!.id,
      currentPassword,
      newPassword
    );
    res.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const deleteAccount = async (req: AuthRequest, res: Response) => {
  try {
    const { password } = req.body;
    await authService.deleteAccount(req.user!.id, password);
    res.json({
      success: true,
      message: 'Account deleted successfully',
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const verifyOTP = async (req: AuthRequest, res: Response) => {
  try {
    const { phoneNumber, otp } = req.body;
    const result = await authService.verifyOTP(phoneNumber, otp);
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

export const resendOTP = async (req: AuthRequest, res: Response) => {
  try {
    const { phoneNumber } = req.body;
    await authService.resendOTP(phoneNumber);
    res.json({
      success: true,
      message: 'OTP sent successfully',
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const forgotPassword = async (req: AuthRequest, res: Response) => {
  try {
    const { identifier } = req.body;
    const result = await authService.forgotPassword(identifier);
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

export const resetPassword = async (req: AuthRequest, res: Response) => {
  try {
    const { phoneNumber, otp, newPassword } = req.body;
    await authService.resetPassword(phoneNumber, otp, newPassword);
    res.json({
      success: true,
      message: 'Password reset successfully',
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};