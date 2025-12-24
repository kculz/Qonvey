// Payment Management Routes
// Location: backend/src/api/v1/routes/payment.routes.ts

import { Router } from 'express';
import {
  initiatePayment,
  checkPaymentStatus,
  confirmPayment,
  handleWebhook,
  getInvoices,
  getInvoice,
  markInvoiceAsPaid,
  cancelInvoice,
  getPaymentMethods,
} from '../controllers/payment.controller';
import { authMiddleware } from '@/middleware/auth.middleware';
import { paymentLimiter } from '@/middleware/rateLimiter.middleware';

const router = Router();

// Payment initiation
router.post('/initiate', authMiddleware, paymentLimiter, initiatePayment);
router.post('/confirm', authMiddleware, confirmPayment);
router.get('/status/:reference', authMiddleware, checkPaymentStatus);

// Webhooks (no auth middleware for webhooks)
router.post('/webhook/paynow', handleWebhook);

// Invoices
router.get('/invoices', authMiddleware, getInvoices);
router.get('/invoices/:invoiceId', authMiddleware, getInvoice);
router.post('/invoices/:invoiceId/mark-paid', authMiddleware, markInvoiceAsPaid);
router.post('/invoices/:invoiceId/cancel', authMiddleware, cancelInvoice);

// Payment methods
router.get('/methods', getPaymentMethods);

export default router;