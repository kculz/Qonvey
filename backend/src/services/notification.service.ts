// Notification Service - SMS, Push, Email
// Location: backend/src/services/notification.service.ts

import twilio from 'twilio';
import * as admin from 'firebase-admin';
import nodemailer from 'nodemailer';
import prisma from '@/config/database';
import { config } from '@/config/env';
import { loggers } from '@/utils/logger';
import type { NotificationData, SendResult } from '@/types/notification.types';

class NotificationService {
  private twilioClient: any = null;
  private emailTransporter: any = null;
  private firebaseInitialized = false;

  constructor() {
    this.initializeTwilio();
    this.initializeEmail();
    this.initializeFirebase();
  }

  // ============================================
  // INITIALIZATION
  // ============================================

  private initializeTwilio() {
    if (config.sms.twilio.enabled) {
      this.twilioClient = twilio(
        config.sms.twilio.accountSid,
        config.sms.twilio.authToken
      );
      loggers.info('Twilio SMS initialized');
    }
  }

  private initializeEmail() {
    if (config.email.enabled) {
      this.emailTransporter = nodemailer.createTransport({
        host: config.email.host,
        port: config.email.port,
        secure: config.email.secure,
        auth: {
          user: config.email.user,
          pass: config.email.pass,
        },
      });
      loggers.info('Email service initialized');
    }
  }

  private initializeFirebase() {
    if (config.firebase.enabled) {
      try {
        if (!admin.apps.length) {
          admin.initializeApp({
            credential: admin.credential.cert({
              projectId: config.firebase.projectId,
              privateKey: config.firebase.privateKey,
              clientEmail: config.firebase.clientEmail,
            }),
            databaseURL: config.firebase.databaseURL,
          });
        }
        this.firebaseInitialized = true;
        loggers.info('Firebase push notifications initialized');
      } catch (error: any) {
        loggers.error('Firebase initialization failed', error);
      }
    }
  }

  // ============================================
  // SMS NOTIFICATIONS
  // ============================================

  async sendSMS(phoneNumber: string, message: string, email?: string, emailSubject?: string, emailHtml?: string): Promise<SendResult> {
    try {
      const results: SendResult[] = [];

      // Send SMS
      if (this.twilioClient) {
        try {
          // Format phone number for Zimbabwe
          const formattedPhone = this.formatPhoneNumber(phoneNumber);

          const result = await this.twilioClient.messages.create({
            body: message,
            from: config.sms.twilio.phoneNumber,
            to: formattedPhone,
          });

          loggers.notification.sent('', 'sms', 'sms');
          results.push({
            success: true,
            messageId: result.sid,
          });
        } catch (error: any) {
          loggers.error('SMS send failed', error);
          results.push({
            success: false,
            error: error.message || 'Failed to send SMS',
          });
        }
      } else {
        results.push({
          success: false,
          error: 'SMS service not configured',
        });
      }

      // Send email if provided
      if (email && this.emailTransporter) {
        try {
          const emailResult = await this.sendEmail(
            email,
            emailSubject || 'Qonvey Notification',
            emailHtml || `<p>${message}</p>`,
            message
          );
          results.push(emailResult);
        } catch (error: any) {
          loggers.error('Email send failed after SMS', error);
          // Don't fail the whole operation if email fails
        }
      }

      // Return success if at least one channel succeeded
      const hasSuccess = results.some(r => r.success);
      return {
        success: hasSuccess,
        messageId: results.find(r => r.messageId)?.messageId,
        error: results.find(r => r.error)?.error,
      };
    } catch (error: any) {
      loggers.error('SMS/Email send failed', error);
      return {
        success: false,
        error: error.message || 'Failed to send notification',
      };
    }
  }

  async sendOTP(phoneNumber: string, otp: string, email?: string, firstName?: string): Promise<SendResult> {
    const message = `Your Qonvey verification code is: ${otp}. Valid for 10 minutes. Do not share this code.`;
    
    const emailSubject = 'Your Qonvey Verification Code';
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #2563eb;">${firstName ? `Hi ${firstName},` : 'Hello,'}</h2>
        <p>Your Qonvey verification code is:</p>
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 5px; margin: 20px 0; text-align: center;">
          <h1 style="color: #2563eb; font-size: 32px; margin: 0; letter-spacing: 5px;">${otp}</h1>
        </div>
        <p>This code is valid for <strong>10 minutes</strong>. Do not share this code with anyone.</p>
        <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
          If you didn't request this code, please ignore this email or contact support at ${config.support.email}.
        </p>
      </div>
    `;

    return await this.sendSMS(phoneNumber, message, email, emailSubject, emailHtml);
  }

  async sendBidNotificationSMS(phoneNumber: string, loadTitle: string, bidAmount: number, email?: string, firstName?: string) {
    const message = `New bid received for "${loadTitle}": $${bidAmount}. Login to Qonvey to view details.`;
    
    const emailSubject = 'New Bid Received - Qonvey';
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #2563eb;">${firstName ? `Hi ${firstName},` : 'Hello,'}</h2>
        <p>You have received a new bid for your load:</p>
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Load:</strong> ${loadTitle}</p>
          <p><strong>Bid Amount:</strong> $${bidAmount}</p>
        </div>
        <p style="margin-top: 30px;">
          <a href="${config.client.url}/loads" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
            View Bid Details
          </a>
        </p>
      </div>
    `;

    return await this.sendSMS(phoneNumber, message, email, emailSubject, emailHtml);
  }

  async sendPaymentReminderSMS(phoneNumber: string, amount: number, dueDate: string, email?: string, firstName?: string) {
    const message = `Qonvey subscription payment of $${amount} is due on ${dueDate}. Pay now to continue enjoying premium features.`;
    
    const emailSubject = `Payment Reminder - $${amount} due on ${dueDate}`;
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #dc2626;">Payment Reminder</h2>
        <p>${firstName ? `Hi ${firstName},` : 'Hello,'}</p>
        <p>Your Qonvey subscription payment is due soon:</p>
        <div style="background-color: #fef2f2; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #dc2626;">
          <p><strong>Amount:</strong> $${amount}</p>
          <p><strong>Due Date:</strong> ${dueDate}</p>
        </div>
        <p>Pay now to continue enjoying premium features without interruption.</p>
        <p style="margin-top: 30px;">
          <a href="${config.client.url}/subscription" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Pay Now
          </a>
        </p>
      </div>
    `;

    return await this.sendSMS(phoneNumber, message, email, emailSubject, emailHtml);
  }

  private formatPhoneNumber(phone: string): string {
    // Remove spaces and dashes
    let formatted = phone.replace(/[\s-]/g, '');

    // If starts with 0, replace with +263
    if (formatted.startsWith('0')) {
      formatted = '+263' + formatted.substring(1);
    }

    // If doesn't start with +, add +263
    if (!formatted.startsWith('+')) {
      formatted = '+263' + formatted;
    }

    return formatted;
  }

  // ============================================
  // PUSH NOTIFICATIONS
  // ============================================

  async sendPushNotification(
    userId: string,
    notification: NotificationData
  ): Promise<SendResult> {
    try {
      if (!this.firebaseInitialized) {
        return {
          success: false,
          error: 'Push notification service not configured',
        };
      }

      // Get user's FCM token
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { fcmToken: true },
      });

      if (!user?.fcmToken) {
        return {
          success: false,
          error: 'User FCM token not found',
        };
      }

      // Send notification
      const message: admin.messaging.Message = {
        notification: {
          title: notification.title,
          body: notification.body,
        },
        data: notification.data || {},
        token: user.fcmToken,
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channelId: 'qonvey_notifications',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      };

      const response = await admin.messaging().send(message);

      // Save notification to database
      await prisma.notification.create({
        data: {
          userId,
          title: notification.title,
          body: notification.body,
          data: notification.data,
          type: notification.type || 'GENERAL',
        },
      });

      loggers.notification.sent(userId, notification.type || 'GENERAL', 'push');

      return {
        success: true,
        messageId: response,
      };
    } catch (error: any) {
      loggers.notification.failed(userId, notification.type || 'GENERAL', 'push', error.message);
      return {
        success: false,
        error: error.message || 'Failed to send push notification',
      };
    }
  }

  async sendMultiplePushNotifications(
    userIds: string[],
    notification: NotificationData
  ): Promise<void> {
    const promises = userIds.map(userId => 
      this.sendPushNotification(userId, notification)
    );
    await Promise.all(promises);
  }

  // ============================================
  // EMAIL NOTIFICATIONS
  // ============================================

  async sendEmail(
    to: string,
    subject: string,
    html: string,
    text?: string
  ): Promise<SendResult> {
    try {
      if (!this.emailTransporter) {
        return {
          success: false,
          error: 'Email service not configured',
        };
      }

      const result = await this.emailTransporter.sendMail({
        from: `Qonvey <${config.email.from}>`,
        to,
        subject,
        text: text || '',
        html,
      });

      loggers.notification.sent('', 'email', 'email');

      return {
        success: true,
        messageId: result.messageId,
      };
    } catch (error: any) {
      loggers.error('Email send failed', error);
      return {
        success: false,
        error: error.message || 'Failed to send email',
      };
    }
  }

  async sendWelcomeEmail(email: string, firstName: string) {
    const subject = 'Welcome to Qonvey!';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Welcome to Qonvey, ${firstName}!</h2>
        <p>Thank you for joining Zimbabwe's leading truck and delivery marketplace.</p>
        <p>You're now on a <strong>30-day FREE trial</strong> of our Starter plan. Enjoy unlimited loads and bids!</p>
        <h3>Getting Started:</h3>
        <ul>
          <li>Complete your profile</li>
          <li>Add your vehicle details (for drivers)</li>
          <li>Post your first load or place your first bid</li>
        </ul>
        <p>Need help? Contact us at ${config.support.email}</p>
        <p style="margin-top: 30px;">
          <a href="${config.client.url}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">
            Get Started
          </a>
        </p>
      </div>
    `;
    return await this.sendEmail(email, subject, html);
  }

  async sendSubscriptionExpiryEmail(email: string, firstName: string, daysLeft: number) {
    const subject = `Your Qonvey subscription expires in ${daysLeft} days`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">Subscription Expiring Soon</h2>
        <p>Hi ${firstName},</p>
        <p>Your Qonvey subscription will expire in <strong>${daysLeft} days</strong>.</p>
        <p>Renew now to continue enjoying:</p>
        <ul>
          <li>Unlimited loads and bids</li>
          <li>Priority listing</li>
          <li>Verified badge</li>
          <li>Advanced features</li>
        </ul>
        <p style="margin-top: 30px;">
          <a href="${config.client.url}/subscription" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">
            Renew Subscription
          </a>
        </p>
      </div>
    `;
    return await this.sendEmail(email, subject, html);
  }

  async sendPaymentSuccessEmail(email: string, firstName: string, plan: string, amount: number) {
    const subject = 'Payment Successful - Qonvey';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #16a34a;">Payment Successful!</h2>
        <p>Hi ${firstName},</p>
        <p>Thank you for your payment. Your subscription has been updated.</p>
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Plan:</strong> ${plan}</p>
          <p><strong>Amount:</strong> $${amount}</p>
          <p><strong>Next billing:</strong> ${this.getNextMonthDate()}</p>
        </div>
        <p>You can view your invoice in your account dashboard.</p>
        <p style="margin-top: 30px;">
          <a href="${config.client.url}/dashboard" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">
            View Dashboard
          </a>
        </p>
      </div>
    `;
    return await this.sendEmail(email, subject, html);
  }

  async sendNewBidEmail(email: string, loadTitle: string, bidAmount: number, driverName: string) {
    const subject = 'New Bid Received - Qonvey';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">New Bid Received!</h2>
        <p>You have received a new bid for your load:</p>
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Load:</strong> ${loadTitle}</p>
          <p><strong>Bid Amount:</strong> $${bidAmount}</p>
          <p><strong>Driver:</strong> ${driverName}</p>
        </div>
        <p style="margin-top: 30px;">
          <a href="${config.client.url}/loads" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">
            View Bid
          </a>
        </p>
      </div>
    `;
    return await this.sendEmail(email, subject, html);
  }

  // ============================================
  // COMBINED NOTIFICATIONS
  // ============================================

  async notifyUser(
    userId: string,
    notification: NotificationData,
    channels: ('push' | 'sms' | 'email')[] = ['push']
  ) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      loggers.error('User not found for notification', { userId });
      return;
    }

    const results = await Promise.allSettled([
      channels.includes('push') && config.features.emailNotifications
        ? this.sendPushNotification(userId, notification)
        : Promise.resolve({ success: false }),
      channels.includes('sms') && user.phoneNumber && config.features.smsNotifications
        ? this.sendSMS(user.phoneNumber, notification.body, user.email || undefined, notification.title, `<p>${notification.body}</p>`)
        : Promise.resolve({ success: false }),
      // Send email if explicitly requested or if SMS was sent (to ensure both are sent)
      (channels.includes('email') || (channels.includes('sms') && user.email)) && user.email && config.features.emailNotifications
        ? this.sendEmail(user.email, notification.title, `<p>${notification.body}</p>`)
        : Promise.resolve({ success: false }),
    ]);

    loggers.info('Notification sent to user', { userId, channels, results });
  }

  // ============================================
  // EVENT-BASED NOTIFICATIONS
  // ============================================

  async notifyNewBid(loadOwnerId: string, loadTitle: string, bidAmount: number, driverName: string) {
    const notification: NotificationData = {
      title: 'New Bid Received',
      body: `${driverName} bid $${bidAmount} for "${loadTitle}"`,
      type: 'BID_RECEIVED',
      data: { loadTitle, bidAmount, driverName },
    };

    await this.notifyUser(loadOwnerId, notification, ['push', 'email']);
  }

  async notifyBidAccepted(driverId: string, loadTitle: string) {
    const notification: NotificationData = {
      title: 'Bid Accepted!',
      body: `Your bid for "${loadTitle}" has been accepted`,
      type: 'BID_ACCEPTED',
      data: { loadTitle },
    };

    await this.notifyUser(driverId, notification, ['push', 'sms', 'email']);
  }

  async notifyTripStarted(loadOwnerId: string, loadTitle: string, driverName: string) {
    const notification: NotificationData = {
      title: 'Trip Started',
      body: `${driverName} has started delivery of "${loadTitle}"`,
      type: 'TRIP_STARTED',
      data: { loadTitle, driverName },
    };

    await this.notifyUser(loadOwnerId, notification, ['push']);
  }

  async notifyTripCompleted(loadOwnerId: string, loadTitle: string) {
    const notification: NotificationData = {
      title: 'Delivery Completed',
      body: `"${loadTitle}" has been delivered. Please confirm and rate the driver.`,
      type: 'TRIP_COMPLETED',
      data: { loadTitle },
    };

    await this.notifyUser(loadOwnerId, notification, ['push', 'sms', 'email']);
  }

  async notifyPaymentReminder(userId: string, amount: number, dueDate: Date) {
    const notification: NotificationData = {
      title: 'Payment Reminder',
      body: `Your subscription payment of $${amount} is due soon`,
      type: 'PAYMENT_REMINDER',
      data: { amount, dueDate: dueDate.toISOString() },
    };

    await this.notifyUser(userId, notification, ['push', 'email', 'sms']);
  }

  async notifySubscriptionExpired(userId: string) {
    const notification: NotificationData = {
      title: 'Subscription Expired',
      body: 'Your subscription has expired. Renew now to continue using premium features.',
      type: 'SUBSCRIPTION_EXPIRED',
    };

    await this.notifyUser(userId, notification, ['push', 'email']);
  }

  // ============================================
  // NOTIFICATION MANAGEMENT
  // ============================================

  async getUserNotifications(userId: string, limit = 50, unreadOnly = false) {
    return await prisma.notification.findMany({
      where: {
        userId,
        ...(unreadOnly && { read: false }),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async markNotificationAsRead(notificationId: string) {
    return await prisma.notification.update({
      where: { id: notificationId },
      data: { read: true, readAt: new Date() },
    });
  }

  async markAllAsRead(userId: string) {
    return await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true, readAt: new Date() },
    });
  }

  async deleteNotification(notificationId: string) {
    return await prisma.notification.delete({
      where: { id: notificationId },
    });
  }

  async getUnreadCount(userId: string) {
    return await prisma.notification.count({
      where: { userId, read: false },
    });
  }

  // ============================================
  // HELPERS
  // ============================================

  private getNextMonthDate(): string {
    const date = new Date();
    date.setMonth(date.getMonth() + 1);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }
}

export const notificationService = new NotificationService();