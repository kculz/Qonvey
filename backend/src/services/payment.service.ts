// backend/src/services/payment.service.ts

import { Paynow } from 'paynow';
import { config } from '../config/env';
import { loggers } from '../utils/logger';
import { subscriptionService } from './subscription.service';
import type { PaymentResult, PaymentStatus } from '../types/payment.types';
import User from '@/models/user.model';
import SubscriptionInvoice from '@/models/subscription-invoice.model';
import { Op } from 'sequelize';

export enum PlanType {
  FREE = 'FREE',
  STARTER = 'STARTER',
  PROFESSIONAL = 'PROFESSIONAL',
  BUSINESS = 'BUSINESS',
}

export enum PaymentMethod {
  CASH = 'CASH',
  ECOCASH = 'ECOCASH',
  ONEMONEY = 'ONEMONEY',
  BANK_TRANSFER = 'BANK_TRANSFER',
  CARD = 'CARD',
}

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
        STARTER: config.payment.subscriptionPrices?.STARTER || 3,
        PROFESSIONAL: config.payment.subscriptionPrices?.PROFESSIONAL || 5,
        BUSINESS: config.payment.subscriptionPrices?.BUSINESS || 7,
      };

      const amount = prices[plan as keyof typeof prices];
      if (!amount) {
        return {
          success: false,
          error: 'Invalid plan selected',
        };
      }

      // Get user details
      const user = await User.findByPk(userId, {
        include: [{
          association: 'subscription',
        }],
      });

      if (!user || !user.subscription) {
        return {
          success: false,
          error: 'User or subscription not found',
        };
      }

      // Create invoice
      const invoice = await SubscriptionInvoice.create({
        subscription_id: user.subscription.id,
        user_id: userId,
        plan,
        amount,
        currency: 'USD',
        billing_period: this.getCurrentBillingPeriod(),
        due_date: new Date(),
        status: 'PENDING',
      } as any);

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
        await invoice.update({
          reference: paymentResult.reference,
          payment_method: method,
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
      const payment = this.paynow.createPayment(invoiceId, user.email || user.phone_number);
      payment.add('Qonvey Subscription', amount);

      // Send mobile payment request
      const response = await this.paynow.sendMobile(
        payment,
        user.phone_number,
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

      const payment = this.paynow.createPayment(invoiceId, user.email || user.phone_number);
      payment.add('Qonvey Subscription', amount);

      const response = await this.paynow.sendMobile(
        payment,
        user.phone_number,
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

      const payment = this.paynow.createPayment(invoiceId, user.email || user.phone_number);
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
    const bankDetails = {
      bankName: config.bank.name || 'CBZ Bank',
      accountName: config.bank.accountName || 'Qonvey Zimbabwe',
      accountNumber: config.bank.accountNumber || '1234567890',
      branchCode: config.bank.branchCode || '1001',
      swiftCode: config.bank.swiftCode || 'CBZAZWHX',
    };

    return {
      success: true,
      reference: invoiceId,
      message: `Please transfer $${amount} to:\n\n` +
               `Bank: ${bankDetails.bankName}\n` +
               `Account Name: ${bankDetails.accountName}\n` +
               `Account Number: ${bankDetails.accountNumber}\n` +
               `Branch Code: ${bankDetails.branchCode}\n` +
               `Swift Code: ${bankDetails.swiftCode}\n\n` +
               `Use reference: ${invoiceId}`,
      bankDetails,
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
        // message: status.message,
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
        const invoice = await SubscriptionInvoice.findOne({
          where: { reference },
          include: [{
            association: 'subscription',
          }],
        });

        if (!invoice || !invoice.subscription) {
          loggers.error('Invoice or subscription not found for reference', { reference });
          return false;
        }

        // Update invoice
        await invoice.update({
          status: 'PAID',
          paid_at: new Date(),
        });

        // Upgrade subscription
        await subscriptionService.upgradePlan(
          invoice.user_id,
          invoice.plan,
          reference
        );

        loggers.subscription.paymentSuccess(
          invoice.user_id,
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
        const invoice = await SubscriptionInvoice.findOne({
          where: { reference },
        });

        if (invoice) {
          await invoice.update({ status: 'CANCELLED' });

          loggers.subscription.paymentFailed(
            invoice.user_id,
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
    const user = await User.findByPk(userId, {
      include: [{
        association: 'subscription',
      }],
    });

    if (!user || !user.subscription) {
      throw new Error('User or subscription not found');
    }

    const invoice = await SubscriptionInvoice.create({
      subscription_id: user.subscription.id,
      user_id: userId,
      plan,
      amount,
      currency: 'USD',
      billing_period: this.getCurrentBillingPeriod(),
      due_date: new Date(),
      status: 'PENDING',
    } as any);

    return invoice;
  }

  async getInvoices(userId: string) {
    return await SubscriptionInvoice.findAll({
      where: { user_id: userId },
      order: [['created_at', 'DESC']],
    });
  }

  async getInvoice(invoiceId: string) {
    return await SubscriptionInvoice.findByPk(invoiceId, {
      include: [
        {
          association: 'subscription',
          include: [{
            association: 'user',
            attributes: ['id', 'first_name', 'last_name', 'email', 'phone_number', 'company_name'],
          }],
        },
      ],
    });
  }

  async markInvoiceAsPaid(invoiceId: string, reference: string, paymentMethod?: PaymentMethod) {
    const invoice = await SubscriptionInvoice.findByPk(invoiceId);
    
    if (!invoice) {
      throw new Error('Invoice not found');
    }

    await invoice.update({
      status: 'PAID',
      paid_at: new Date(),
      reference,
      ...(paymentMethod && { payment_method: paymentMethod }),
    });

    // Upgrade user's subscription
    await subscriptionService.upgradePlan(invoice.user_id, invoice.plan, reference);

    return invoice;
  }

  async cancelInvoice(invoiceId: string) {
    const invoice = await SubscriptionInvoice.findByPk(invoiceId);
    
    if (!invoice) {
      throw new Error('Invoice not found');
    }

    await invoice.update({ status: 'CANCELLED' });
    return invoice;
  }

  // ============================================
  // NEW METHODS FOR SEQUELIZE
  // ============================================

  async getPendingInvoices(userId?: string) {
    const whereClause: any = { status: 'PENDING' };
    if (userId) {
      whereClause.user_id = userId;
    }

    return await SubscriptionInvoice.findAll({
      where: whereClause,
      include: [{
        association: 'subscription',
        include: [{
          association: 'user',
          attributes: ['id', 'first_name', 'last_name', 'phone_number'],
        }],
      }],
      order: [['due_date', 'ASC']],
    });
  }

  async getOverdueInvoices() {
    return await SubscriptionInvoice.findAll({
      where: {
        status: 'PENDING',
        due_date: { [Op.lt]: new Date() },
      },
      include: [{
        association: 'subscription',
        include: [{
          association: 'user',
          attributes: ['id', 'first_name', 'last_name', 'email', 'phone_number'],
        }],
      }],
      order: [['due_date', 'ASC']],
    });
  }

  async getPaymentSummary(userId: string) {
    const [totalInvoices, paidInvoices, pendingInvoices, totalAmount] = await Promise.all([
      SubscriptionInvoice.count({ where: { user_id: userId } }),
      SubscriptionInvoice.count({ where: { user_id: userId, status: 'PAID' } }),
      SubscriptionInvoice.count({ where: { user_id: userId, status: 'PENDING' } }),
      SubscriptionInvoice.sum('amount', { where: { user_id: userId, status: 'PAID' } }),
    ]);

    return {
      totalInvoices,
      paidInvoices,
      pendingInvoices,
      totalAmount: totalAmount || 0,
    };
  }

  async validatePaymentMethod(method: PaymentMethod): Promise<boolean> {
    switch (method) {
      case PaymentMethod.ECOCASH:
      case PaymentMethod.ONEMONEY:
      case PaymentMethod.CARD:
        return config.payment.paynow.enabled === true;
      case PaymentMethod.BANK_TRANSFER:
        return true; // Always available
      case PaymentMethod.CASH:
        return true; // Always available
      default:
        return false;
    }
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
    const bankDetails = config.bank.name ? {
      bankName: config.bank.name,
      accountName: config.bank.accountName,
      accountNumber: config.bank.accountNumber,
      branchCode: config.bank.branchCode,
      swiftCode: config.bank.swiftCode,
    } : undefined;

    return {
      ecocash: {
        enabled: config.payment.paynow.enabled === true,
        name: 'EcoCash',
        description: 'Pay with your EcoCash mobile money',
        icon: 'ecocash-icon',
      },
      onemoney: {
        enabled: config.payment.paynow.enabled === true,
        name: 'OneMoney',
        description: 'Pay with your OneMoney account',
        icon: 'onemoney-icon',
      },
      card: {
        enabled: config.payment.paynow.enabled === true,
        name: 'Credit/Debit Card',
        description: 'Pay with Visa or Mastercard',
        icon: 'card-icon',
      },
      bank: {
        enabled: true,
        name: 'Bank Transfer',
        description: 'Direct bank transfer',
        icon: 'bank-icon',
        details: bankDetails,
      },
      cash: {
        enabled: true,
        name: 'Cash Payment',
        description: 'Pay in cash at our offices',
        icon: 'cash-icon',
      },
    };
  }
}

export const paymentService = new PaymentService();