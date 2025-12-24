// Complete Authentication Service
// Location: backend/src/services/auth.service.ts

import bcrypt from 'bcryptjs';
import jwt, { Secret, SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '@/config/database';
import { config } from '@/config/env';
import { loggers } from '@/utils/logger';
import { subscriptionService } from '@/services/subscription.service';
import { notificationService } from '@/services/notification.service';
import { otpRedis } from '@/utils/redis';
import { formatPhoneNumber, maskPhoneNumber } from '@/utils/phone';
import type {
  RegisterData,
  LoginData,
  TokenPayload,
  AuthTokens,
  UpdateProfileData,
} from '@/types/auth.types';

class AuthService {
  // ============================================
  // REGISTRATION
  // ============================================

  async register(data: RegisterData, ip?: string) {
    // Validate phone number format
    const phoneNumber = formatPhoneNumber(data.phoneNumber);

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { phoneNumber },
          ...(data.email ? [{ email: data.email }] : []),
        ],
      },
    });

    if (existingUser) {
      if (existingUser.phoneNumber === phoneNumber) {
        throw new Error('Phone number already registered');
      }
      if (data.email && existingUser.email === data.email) {
        throw new Error('Email already registered');
      }
    }

    // Hash password
    const passwordHash = await bcrypt.hash(data.password, 10);

    // Create user with subscription
    const user = await prisma.user.create({
      data: {
        phoneNumber,
        email: data.email,
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role,
        companyName: data.companyName,
        companyRegistration: data.companyRegistration,
        driversLicense: data.driversLicense,
        idDocument: data.idDocument,
        status: 'PENDING',
      },
    });

    // Create trial subscription
    await subscriptionService.createTrialSubscription(user.id);

    // Generate OTP for phone verification
    const otp = await this.generateOTP(phoneNumber);

    // Send OTP via SMS and Email
    await notificationService.sendOTP(phoneNumber, otp, data.email, data.firstName);

    loggers.auth.register(user.id, data.role);

    // Send welcome email if email provided
    if (data.email) {
      await notificationService.sendWelcomeEmail(data.email, data.firstName);
    }

    return {
      userId: user.id,
      message: 'Registration successful. Please verify your phone number.',
      requiresVerification: true,
    };
  }

  // ============================================
  // LOGIN
  // ============================================

  async login(data: LoginData, ip?: string) {
    // Find user by phone or email
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { phoneNumber: formatPhoneNumber(data.identifier) },
          { email: data.identifier },
        ],
      },
      include: {
        subscription: true,
      },
    });

    if (!user) {
      loggers.auth.failed(data.identifier, 'User not found', ip || '');
      throw new Error('Invalid credentials');
    }

    // Check if account is active
    if (user.status === 'BANNED') {
      throw new Error('Account has been banned. Contact support.');
    }

    if (user.status === 'SUSPENDED') {
      throw new Error('Account has been suspended. Contact support.');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(data.password, user.passwordHash);
    if (!isPasswordValid) {
      loggers.auth.failed(data.identifier, 'Invalid password', ip || '');
      throw new Error('Invalid credentials');
    }

    // Check if phone is verified
    if (!user.phoneVerified) {
      // Generate and send OTP
      const otp = await this.generateOTP(user.phoneNumber);
      await notificationService.sendOTP(user.phoneNumber, otp, user.email || undefined, user.firstName);

      return {
        userId: user.id,
        message: 'Phone verification required. OTP sent.',
        requiresVerification: true,
      };
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Generate tokens
    const tokens = this.generateTokens({ userId: user.id, role: user.role });

    loggers.auth.login(user.id, ip || '');

    // Remove password from response
    const { passwordHash, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      ...tokens,
    };
  }

  async logout(userId: string) {
    // In a production app, you might want to blacklist the token
    // or store active sessions in Redis
    loggers.auth.logout(userId);
    return { message: 'Logged out successfully' };
  }

  // ============================================
  // OTP VERIFICATION
  // ============================================

  async generateOTP(phoneNumber: string): Promise<string> {
    // Generate 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();

    // Format phone number
    const formattedPhone = formatPhoneNumber(phoneNumber);

    // Store OTP in Redis with 10-minute expiration (600 seconds)
    await otpRedis.set(formattedPhone, otp, 600);

    loggers.info('OTP generated', { phoneNumber: formattedPhone });
    return otp;
  }

  async verifyOTP(phoneNumber: string, otp: string) {
    const formattedPhone = formatPhoneNumber(phoneNumber);
    const storedOTP = await otpRedis.get(formattedPhone);

    if (!storedOTP) {
      throw new Error('OTP not found or expired');
    }

    // Check attempts
    if (storedOTP.attempts >= 5) {
      await otpRedis.delete(formattedPhone);
      throw new Error('Too many failed attempts');
    }

    // Verify OTP
    if (storedOTP.otp !== otp) {
      await otpRedis.incrementAttempts(formattedPhone);
      throw new Error('Invalid OTP');
    }

    // OTP is valid, remove from store
    await otpRedis.delete(formattedPhone);

    // Update user as verified
    const user = await prisma.user.update({
      where: { phoneNumber: formattedPhone },
      data: {
        phoneVerified: true,
        status: 'ACTIVE',
      },
      include: {
        subscription: true,
      },
    });

    // Generate tokens
    const tokens = this.generateTokens({ userId: user.id, role: user.role });

    loggers.info('Phone verified', { userId: user.id, phoneNumber: formattedPhone });

    const { passwordHash, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      ...tokens,
    };
  }

  async resendOTP(phoneNumber: string) {
    const formattedPhone = formatPhoneNumber(phoneNumber);

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { phoneNumber: formattedPhone },
    });

    if (!user) {
      throw new Error('User not found');
    }

    if (user.phoneVerified) {
      throw new Error('Phone already verified');
    }

    // Generate new OTP
    const otp = await this.generateOTP(formattedPhone);

    // Send OTP via SMS and Email
    await notificationService.sendOTP(formattedPhone, otp, user.email || undefined, user.firstName);

    return { message: 'OTP sent successfully' };
  }

  // ============================================
  // PASSWORD MANAGEMENT
  // ============================================

  async forgotPassword(identifier: string) {
    // Find user
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { phoneNumber: formatPhoneNumber(identifier) },
          { email: identifier },
        ],
      },
    });

    if (!user) {
      // Don't reveal if user exists
      return { message: 'If account exists, OTP has been sent' };
    }

    // Generate OTP
    const otp = await this.generateOTP(user.phoneNumber);

    // Send OTP
    await notificationService.sendOTP(user.phoneNumber, otp);

    return { 
      message: 'OTP sent to your registered phone number',
      phoneNumber: maskPhoneNumber(user.phoneNumber),
    };
  }

  async resetPassword(phoneNumber: string, otp: string, newPassword: string) {
    // Verify OTP
    await this.verifyOTP(phoneNumber, otp);

    const formattedPhone = formatPhoneNumber(phoneNumber);

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update password
    await prisma.user.update({
      where: { phoneNumber: formattedPhone },
      data: { passwordHash },
    });

    loggers.info('Password reset', { phoneNumber: formattedPhone });

    return { message: 'Password reset successfully' };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isPasswordValid) {
      throw new Error('Current password is incorrect');
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    loggers.info('Password changed', { userId });

    return { message: 'Password changed successfully' };
  }

  // ============================================
  // TOKEN MANAGEMENT
  // ============================================

generateTokens(payload: TokenPayload): AuthTokens {
  const accessToken = jwt.sign(payload, config.jwt.secret as Secret, {
    expiresIn: config.jwt.expire as SignOptions['expiresIn'],
  });

  const refreshToken = jwt.sign(payload, config.jwt.refreshSecret as Secret, {
    expiresIn: config.jwt.refreshExpire as SignOptions['expiresIn'],
  });

  return { accessToken, refreshToken };
}

  verifyAccessToken(token: string): TokenPayload {
    try {
      return jwt.verify(token, config.jwt.secret) as TokenPayload;
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  verifyRefreshToken(token: string): TokenPayload {
    try {
      return jwt.verify(token, config.jwt.refreshSecret) as TokenPayload;
    } catch (error) {
      throw new Error('Invalid or expired refresh token');
    }
  }

  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    try {
      const payload = this.verifyRefreshToken(refreshToken);

      // Verify user still exists and is active
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
      });

      if (!user) {
        throw new Error('User not found');
      }

      if (user.status === 'BANNED' || user.status === 'SUSPENDED') {
        throw new Error('Account not active');
      }

      // Generate new tokens
      return this.generateTokens({ userId: user.id, role: user.role });
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  // ============================================
  // HELPERS
  // ============================================

  async getCurrentUser(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        subscription: true,
        vehicles: {
          where: { isActive: true },
        },
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const { passwordHash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async updateProfile(userId: string, data: UpdateProfileData) {
    // If updating email, check if it's already taken
    if (data.email) {
      const existingUser = await prisma.user.findFirst({
        where: {
          email: data.email,
          id: { not: userId },
        },
      });

      if (existingUser) {
        throw new Error('Email already taken');
      }
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.firstName && { firstName: data.firstName }),
        ...(data.lastName && { lastName: data.lastName }),
        ...(data.email && { email: data.email, emailVerified: false }),
        ...(data.companyName && { companyName: data.companyName }),
        ...(data.profileImage && { profileImage: data.profileImage }),
      },
    });

    const { passwordHash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async updateFCMToken(userId: string, fcmToken: string) {
    return await prisma.user.update({
      where: { id: userId },
      data: { fcmToken },
    });
  }

  async deleteAccount(userId: string, password: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new Error('Invalid password');
    }

    // Delete user (cascade will handle related records)
    await prisma.user.delete({
      where: { id: userId },
    });

    loggers.info('Account deleted', { userId });

    return { message: 'Account deleted successfully' };
  }
}

export const authService = new AuthService();