// backend/src/services/auth.service.ts

import bcrypt from 'bcryptjs';
import jwt, { Secret, SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import { Op } from 'sequelize';
import User  from '../models/user.model';
import { config } from '../config/env';
import { loggers } from '../utils/logger';
import { subscriptionService } from './subscription.service';
import { notificationService } from './notification.service';
import { otpRedis } from '../utils/redis';
import { formatPhoneNumber, maskPhoneNumber } from '../utils/phone';
import type {
  RegisterData,
  LoginData,
  TokenPayload,
  AuthTokens,
  UpdateProfileData,
} from '../types/auth.types';

class AuthService {
  // ============================================
  // REGISTRATION
  // ============================================

  async register(data: RegisterData, ip?: string) {
    // Validate phone number format
    const phoneNumber = formatPhoneNumber(data.phoneNumber);

    // Check if user already exists
    const existingUser = await User.findOne({
      where: {
        [Op.or]: [
          { phone_number: phoneNumber },
          ...(data.email ? [{ email: data.email }] : []),
        ],
      },
    });

    if (existingUser) {
      if (existingUser.phone_number === phoneNumber) {
        throw new Error('Phone number already registered');
      }
      if (data.email && existingUser.email === data.email) {
        throw new Error('Email already registered');
      }
    }

    // Hash password
    const passwordHash = await bcrypt.hash(data.password, 10);

    // Create user
    const user = await User.create({
      phone_number: phoneNumber,
      email: data.email,
      password_hash: passwordHash,
      first_name: data.firstName,
      last_name: data.lastName,
      role: data.role,
      company_name: data.companyName,
      company_registration: data.companyRegistration,
      drivers_license: data.driversLicense,
      id_document: data.idDocument,
      status: 'PENDING',
    } as any);

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
    const user = await User.findOne({
      where: {
        [Op.or]: [
          { phone_number: formatPhoneNumber(data.identifier) },
          { email: data.identifier },
        ],
      },
      include: [{
        association: 'subscription',
      }],
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
    const isPasswordValid = await bcrypt.compare(data.password, user.password_hash);
    if (!isPasswordValid) {
      loggers.auth.failed(data.identifier, 'Invalid password', ip || '');
      throw new Error('Invalid credentials');
    }

    // Check if phone is verified
    if (!user.phone_verified) {
      // Generate and send OTP
      const otp = await this.generateOTP(user.phone_number);
      await notificationService.sendOTP(
        user.phone_number, 
        otp, 
        user.email || undefined, 
        user.first_name
      );

      return {
        userId: user.id,
        message: 'Phone verification required. OTP sent.',
        requiresVerification: true,
      };
    }

    // Update last login
    await user.update({ last_login_at: new Date() });

    // Generate tokens
    const tokens = this.generateTokens({ userId: user.id, role: user.role });

    loggers.auth.login(user.id, ip || '');

    // Remove password from response
    const { password_hash, ...userWithoutPassword } = user.toJSON();

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
    const user = await User.findOne({
      where: { phone_number: formattedPhone },
      include: [{
        association: 'subscription',
      }],
    });

    if (!user) {
      throw new Error('User not found');
    }

    await user.update({
      phone_verified: true,
      status: 'ACTIVE',
    });

    // Generate tokens
    const tokens = this.generateTokens({ userId: user.id, role: user.role });

    loggers.info('Phone verified', { userId: user.id, phoneNumber: formattedPhone });

    const { password_hash, ...userWithoutPassword } = user.toJSON();

    return {
      user: userWithoutPassword,
      ...tokens,
    };
  }

  async resendOTP(phoneNumber: string) {
    const formattedPhone = formatPhoneNumber(phoneNumber);

    // Check if user exists
    const user = await User.findOne({
      where: { phone_number: formattedPhone },
    });

    if (!user) {
      throw new Error('User not found');
    }

    if (user.phone_verified) {
      throw new Error('Phone already verified');
    }

    // Generate new OTP
    const otp = await this.generateOTP(formattedPhone);

    // Send OTP via SMS and Email
    await notificationService.sendOTP(
      formattedPhone, 
      otp, 
      user.email || undefined, 
      user.first_name
    );

    return { message: 'OTP sent successfully' };
  }

  // ============================================
  // PASSWORD MANAGEMENT
  // ============================================

  async forgotPassword(identifier: string) {
    // Find user
    const user = await User.findOne({
      where: {
        [Op.or]: [
          { phone_number: formatPhoneNumber(identifier) },
          { email: identifier },
        ],
      },
    });

    if (!user) {
      // Don't reveal if user exists
      return { message: 'If account exists, OTP has been sent' };
    }

    // Generate OTP
    const otp = await this.generateOTP(user.phone_number);

    // Send OTP
    await notificationService.sendOTP(user.phone_number, otp);

    return { 
      message: 'OTP sent to your registered phone number',
      phoneNumber: maskPhoneNumber(user.phone_number),
    };
  }

  async resetPassword(phoneNumber: string, otp: string, newPassword: string) {
    // Verify OTP
    await this.verifyOTP(phoneNumber, otp);

    const formattedPhone = formatPhoneNumber(phoneNumber);

    // Find user
    const user = await User.findOne({
      where: { phone_number: formattedPhone },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update password
    await user.update({ password_hash: passwordHash });

    loggers.info('Password reset', { phoneNumber: formattedPhone });

    return { message: 'Password reset successfully' };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await User.findByPk(userId);

    if (!user) {
      throw new Error('User not found');
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isPasswordValid) {
      throw new Error('Current password is incorrect');
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update password
    await user.update({ password_hash: passwordHash });

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
      const user = await User.findByPk(payload.userId);

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
    const user = await User.findByPk(userId, {
      include: [
        {
          association: 'subscription',
        },
        {
          association: 'vehicles',
          where: { is_active: true },
          required: false,
        },
      ],
    });

    if (!user) {
      throw new Error('User not found');
    }

    const { password_hash, ...userWithoutPassword } = user.toJSON();
    return userWithoutPassword;
  }

  async updateProfile(userId: string, data: UpdateProfileData) {
    // If updating email, check if it's already taken
    if (data.email) {
      const existingUser = await User.findOne({
        where: {
          email: data.email,
          id: { [Op.ne]: userId },
        },
      });

      if (existingUser) {
        throw new Error('Email already taken');
      }
    }

    const updateData: any = {};
    
    if (data.firstName) updateData.first_name = data.firstName;
    if (data.lastName) updateData.last_name = data.lastName;
    if (data.email) {
      updateData.email = data.email;
      updateData.email_verified = false;
    }
    if (data.companyName) updateData.company_name = data.companyName;
    if (data.profileImage) updateData.profile_image = data.profileImage;

    const user = await User.findByPk(userId);
    
    if (!user) {
      throw new Error('User not found');
    }

    await user.update(updateData);

    const { password_hash, ...userWithoutPassword } = user.toJSON();
    return userWithoutPassword;
  }

  async updateFCMToken(userId: string, fcmToken: string) {
    const user = await User.findByPk(userId);
    
    if (!user) {
      throw new Error('User not found');
    }

    await user.update({ fcm_token: fcmToken });
    return user;
  }

  async deleteAccount(userId: string, password: string) {
    const user = await User.findByPk(userId);

    if (!user) {
      throw new Error('User not found');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      throw new Error('Invalid password');
    }

    // Delete user (cascade will handle related records based on model associations)
    await user.destroy();

    loggers.info('Account deleted', { userId });

    return { message: 'Account deleted successfully' };
  }

  // ============================================
  // ADDITIONAL HELPER METHODS
  // ============================================

  async findUserByPhone(phoneNumber: string) {
    const formattedPhone = formatPhoneNumber(phoneNumber);
    
    return User.findOne({
      where: { phone_number: formattedPhone },
      include: [{
        association: 'subscription',
      }],
    });
  }

  async findUserByEmail(email: string) {
    return User.findOne({
      where: { email },
      include: [{
        association: 'subscription',
      }],
    });
  }

  async updateUserStatus(userId: string, status: 'ACTIVE' | 'SUSPENDED' | 'BANNED') {
    const user = await User.findByPk(userId);
    
    if (!user) {
      throw new Error('User not found');
    }

    await user.update({ status });
    return user;
  }

  async verifyEmail(userId: string) {
    const user = await User.findByPk(userId);
    
    if (!user) {
      throw new Error('User not found');
    }

    await user.update({ email_verified: true });
    return user;
  }
}

export const authService = new AuthService();