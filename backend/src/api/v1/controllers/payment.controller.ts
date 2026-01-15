// Payment Management Controller
// Location: backend/src/api/v1/controllers/payment.controller.ts

import { Response } from 'express';
import { AuthRequest } from '@/middleware/auth.middleware';
import { paymentService } from '@/services/payment.service';
import { PaymentMethod, PlanType } from '@/models/subscription-invoice.model';

export const initiatePayment = async (req: AuthRequest, res: Response) => {
  try {
    const { plan, method } = req.body;
    const result = await paymentService.initiateSubscriptionPayment(
      req.user!.id,
      plan as PlanType,
      method as PaymentMethod
    );
    res.json({
      success: result.success,
      data: result,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const checkPaymentStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { reference } = req.params;
    const status = await paymentService.checkPaymentStatus(reference);
    res.json({
      success: true,
      data: status,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const confirmPayment = async (req: AuthRequest, res: Response) => {
  try {
    const { reference } = req.body;
    const confirmed = await paymentService.confirmPayment(reference);
    res.json({
      success: true,
      data: { confirmed },
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const handleWebhook = async (req: AuthRequest, res: Response) => {
  try {
    await paymentService.handlePaynowWebhook(req.body);
    res.json({
      success: true,
      message: 'Webhook processed',
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const getInvoices = async (req: AuthRequest, res: Response) => {
  try {
    const invoices = await paymentService.getInvoices(req.user!.id);
    res.json({
      success: true,
      data: invoices,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const getInvoice = async (req: AuthRequest, res: Response) => {
  try {
    const { invoiceId } = req.params;
    const invoice = await paymentService.getInvoice(invoiceId);
    res.json({
      success: true,
      data: invoice,
    });
  } catch (error: any) {
    res.status(404).json({
      success: false,
      message: error.message,
    });
  }
};

export const markInvoiceAsPaid = async (req: AuthRequest, res: Response) => {
  try {
    const { invoiceId } = req.params;
    const { reference } = req.body;
    const invoice = await paymentService.markInvoiceAsPaid(invoiceId, reference);
    res.json({
      success: true,
      data: invoice,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const cancelInvoice = async (req: AuthRequest, res: Response) => {
  try {
    const { invoiceId } = req.params;
    const invoice = await paymentService.cancelInvoice(invoiceId);
    res.json({
      success: true,
      data: invoice,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const getPaymentMethods = async (req: AuthRequest, res: Response) => {
  try {
    const methods = await paymentService.getPaymentMethods();
    res.json({
      success: true,
      data: methods,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};