// Payment Service - EcoCash/OneMoney Integration
// Location: backend/src/services/payment.service.ts

import { Paynow } from 'paynow';
import prisma from '@/config/database';
import { config } from '@/config/env';
import { loggers } from '@/utils/logger';
import { PlanType, PaymentMethod } from '@prisma/client';
import { subscriptionService } from '@/services/subscription.service';
import type { PaymentResult, PaymentStatus } from '@/types/payment.types';

class PaymentService {
  private paynow: Paynow | null = null;

  constructor() {
    if (config.payment.paynow.enabled) {
      this.paynow = new Paynow(
        config.payment.paynow.integrationId,
        config.payment.paynow.integrationKey,
        config.payment.paynow.returnUrl,
        config.payment.paynow.resultUrl
      );
    }
  }

  // ============================================
  // SUBSCRIPTION PAYMENTS
  // ============================================

  async initiateSubscriptionPayment(
    userId: string,
    plan: PlanType,
    method: PaymentMethod
  ): Promise<PaymentResult> {
    try {
      // Validate plan
      if (plan === 'FREE') {
        return {
          success: false,
          error: 'Cannot process payment for FREE plan',
        };
      }

      // Get pricing
      const prices = {
        STARTER: config.subscription.prices.starter,
        PROFESSIONAL: config.subscription.prices.professional,
        BUSINESS: config.subscription.prices.business,
      };

      const amount = prices[plan as keyof typeof prices];
      if (!amount) {
        return {
          success: false,
          error: 'Invalid plan selected',
        };
      }

      // Get user details
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { subscription: true },
      });

      if (!user) {
        return {
          success: false,
          error: 'User not found',
        };
      }

      // Create invoice
      const invoice = await prisma.subscriptionInvoice.create({
        data: {
          subscriptionId: user.subscription!.id,
          userId,
          plan,
          amount,
          currency: 'USD',
          billingPeriod: this.getCurrentBillingPeriod(),
          dueDate: new Date(),
          status: 'PENDING',
        },
      });

      loggers.info('Payment initiated', { userId, plan, amount, invoiceId: invoice.id });

      // Process payment based on method
      let paymentResult: PaymentResult;

      switch (method) {
        case 'ECOCASH':
          paymentResult = await this.processEcoCashPayment(user, amount, invoice.id);
          break;
        case 'ONEMONEY':
          paymentResult = await this.processOneMoneyPayment(user, amount, invoice.id);
          break;
        case 'CARD':
          paymentResult = await this.processCardPayment(user, amount, invoice.id);
          break;
        case 'BANK_TRANSFER':
          paymentResult = await this.processBankTransfer(user, amount, invoice.id);
          break;
        default:
          return {
            success: false,
            error: 'Unsupported payment method',
          };
      }

      // Update invoice with payment details
      if (paymentResult.success && paymentResult.reference) {
        await prisma.subscriptionInvoice.update({
          where: { id: invoice.id },
          data: {
            reference: paymentResult.reference,
            paymentMethod: method,
          },
        });
      }

      return paymentResult;
    } catch (error: any) {
      loggers.error('Payment initiation failed', error);
      return {
        success: false,
        error: error.message || 'Payment initiation failed',
      };
    }
  }

  // ============================================
  // PAYNOW INTEGRATION (EcoCash/OneMoney)
  // ============================================

  async processEcoCashPayment(
    user: any,
    amount: number,
    invoiceId: string
  ): Promise<PaymentResult> {
    try {
      if (!this.paynow) {
        return {
          success: false,
          error: 'Payment gateway not configured',
        };
      }

      // Create payment
      const payment = this.paynow.createPayment(invoiceId, user.email || user.phoneNumber);
      payment.add('Qonvey Subscription', amount);

      // Send mobile payment request
      const response = await this.paynow.sendMobile(
        payment,
        user.phoneNumber,
        'ecocash'
      );

      if (!response.success) {
        loggers.subscription.paymentFailed(user.id, amount, response.error || 'Unknown error');
        return {
          success: false,
          error: response.error || 'Payment failed',
        };
      }

      loggers.info('EcoCash payment initiated', {
        userId: user.id,
        amount,
        reference: response.reference,
      });

      return {
        success: true,
        reference: response.reference,
        pollUrl: response.pollUrl,
        message: 'Please check your phone and approve the payment',
      };
    } catch (error: any) {
      loggers.error('EcoCash payment error', error);
      return {
        success: false,
        error: error.message || 'EcoCash payment failed',
      };
    }
  }

  async processOneMoneyPayment(
    user: any,
    amount: number,
    invoiceId: string
  ): Promise<PaymentResult> {
    try {
      if (!this.paynow) {
        return {
          success: false,
          error: 'Payment gateway not configured',
        };
      }

      const payment = this.paynow.createPayment(invoiceId, user.email || user.phoneNumber);
      payment.add('Qonvey Subscription', amount);

      const response = await this.paynow.sendMobile(
        payment,
        user.phoneNumber,
        'onemoney'
      );

      if (!response.success) {
        loggers.subscription.paymentFailed(user.id, amount, response.error || 'Unknown error');
        return {
          success: false,
          error: response.error || 'Payment failed',
        };
      }

      loggers.info('OneMoney payment initiated', {
        userId: user.id,
        amount,
        reference: response.reference,
      });

      return {
        success: true,
        reference: response.reference,
        pollUrl: response.pollUrl,
        message: 'Please check your phone and approve the payment',
      };
    } catch (error: any) {
      loggers.error('OneMoney payment error', error);
      return {
        success: false,
        error: error.message || 'OneMoney payment failed',
      };
    }
  }

  async processCardPayment(
    user: any,
    amount: number,
    invoiceId: string
  ): Promise<PaymentResult> {
    try {
      if (!this.paynow) {
        return {
          success: false,
          error: 'Payment gateway not configured',
        };
      }

      const payment = this.paynow.createPayment(invoiceId, user.email || user.phoneNumber);
      payment.add('Qonvey Subscription', amount);

      const response = await this.paynow.send(payment);

      if (!response.success) {
        loggers.subscription.paymentFailed(user.id, amount, response.error || 'Unknown error');
        return {
          success: false,
          error: response.error || 'Payment failed',
        };
      }

      loggers.info('Card payment initiated', {
        userId: user.id,
        amount,
        reference: response.reference,
      });

      return {
        success: true,
        reference: response.reference,
        redirectUrl: response.redirectUrl,
        message: 'Redirecting to payment page',
      };
    } catch (error: any) {
      loggers.error('Card payment error', error);
      return {
        success: false,
        error: error.message || 'Card payment failed',
      };
    }
  }

  async processBankTransfer(
    user: any,
    amount: number,
    invoiceId: string
  ): Promise<PaymentResult> {
    // Bank transfer details for manual payment
    return {
      success: true,
      reference: invoiceId,
      message: `Please transfer $${amount} to our bank account and use reference: ${invoiceId}`,
    };
  }

  // ============================================
  // PAYMENT VERIFICATION
  // ============================================

  async checkPaymentStatus(reference: string): Promise<PaymentStatus> {
    try {
      if (!this.paynow) {
        throw new Error('Payment gateway not configured');
      }

      const status = await this.paynow.pollTransaction(reference);

      return {
        paid: status.paid,
        amount: status.amount,
        reference: status.reference,
        status: status.status,
        message: status.message,
      };
    } catch (error: any) {
      loggers.error('Payment status check failed', error);
      throw error;
    }
  }

  async confirmPayment(reference: string): Promise<boolean> {
    try {
      const status = await this.checkPaymentStatus(reference);

      if (status.paid) {
        // Find invoice by reference
        const invoice = await prisma.subscriptionInvoice.findFirst({
          where: { reference },
          include: { subscription: true },
        });

        if (!invoice) {
          loggers.error('Invoice not found for reference', { reference });
          return false;
        }

        // Update invoice
        await prisma.subscriptionInvoice.update({
          where: { id: invoice.id },
          data: {
            status: 'PAID',
            paidAt: new Date(),
          },
        });

        // Upgrade subscription
        await subscriptionService.upgradePlan(
          invoice.userId,
          invoice.plan,
          reference
        );

        loggers.subscription.paymentSuccess(
          invoice.userId,
          invoice.amount,
          invoice.plan
        );

        return true;
      }

      return false;
    } catch (error: any) {
      loggers.error('Payment confirmation failed', error);
      return false;
    }
  }

  // ============================================
  // WEBHOOK HANDLER
  // ============================================

  async handlePaynowWebhook(data: any): Promise<void> {
    try {
      const reference = data.reference;
      const status = data.status;

      loggers.info('Paynow webhook received', { reference, status });

      if (status === 'Paid' || status === 'Delivered') {
        await this.confirmPayment(reference);
      } else if (status === 'Cancelled' || status === 'Failed') {
        // Update invoice status
        const invoice = await prisma.subscriptionInvoice.findFirst({
          where: { reference },
        });

        if (invoice) {
          await prisma.subscriptionInvoice.update({
            where: { id: invoice.id },
            data: { status: 'CANCELLED' },
          });

          loggers.subscription.paymentFailed(
            invoice.userId,
            invoice.amount,
            status
          );
        }
      }
    } catch (error: any) {
      loggers.error('Webhook handling failed', error);
    }
  }

  // ============================================
  // INVOICE MANAGEMENT
  // ============================================

  async createInvoice(userId: string, plan: PlanType, amount: number) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { subscription: true },
    });

    if (!user || !user.subscription) {
      throw new Error('User or subscription not found');
    }

    const invoice = await prisma.subscriptionInvoice.create({
      data: {
        subscriptionId: user.subscription.id,
        userId,
        plan,
        amount,
        currency: 'USD',
        billingPeriod: this.getCurrentBillingPeriod(),
        dueDate: new Date(),
        status: 'PENDING',
      },
    });

    return invoice;
  }

  async getInvoices(userId: string) {
    return await prisma.subscriptionInvoice.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getInvoice(invoiceId: string) {
    return await prisma.subscriptionInvoice.findUnique({
      where: { id: invoiceId },
      include: {
        subscription: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phoneNumber: true,
                companyName: true,
              },
            },
          },
        },
      },
    });
  }

  async markInvoiceAsPaid(invoiceId: string, reference: string) {
    const invoice = await prisma.subscriptionInvoice.update({
      where: { id: invoiceId },
      data: {
        status: 'PAID',
        paidAt: new Date(),
        reference,
      },
    });

    // Upgrade user's subscription
    await subscriptionService.upgradePlan(invoice.userId, invoice.plan, reference);

    return invoice;
  }

  async cancelInvoice(invoiceId: string) {
    return await prisma.subscriptionInvoice.update({
      where: { id: invoiceId },
      data: { status: 'CANCELLED' },
    });
  }

  // ============================================
  // HELPERS
  // ============================================

  private getCurrentBillingPeriod(): string {
    const now = new Date();
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
  }

  async getPaymentMethods() {
    return {
      ecocash: {
        enabled: config.payment.paynow.enabled,
        name: 'EcoCash',
        description: 'Pay with your EcoCash mobile money',
      },
      onemoney: {
        enabled: config.payment.paynow.enabled,
        name: 'OneMoney',
        description: 'Pay with your OneMoney account',
      },
      card: {
        enabled: config.payment.paynow.enabled,
        name: 'Credit/Debit Card',
        description: 'Pay with Visa or Mastercard',
      },
      bank: {
        enabled: true,
        name: 'Bank Transfer',
        description: 'Direct bank transfer',
      },
    };
  }
}

export const paymentService = new PaymentService();