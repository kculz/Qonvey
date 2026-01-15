export interface PaymentResult {
  success: boolean;
  reference?: string;
  pollUrl?: string;
  redirectUrl?: string;
  message?: string;
  error?: string;
  bankDetails?: BankDetails;
}

export interface PaymentStatus {
  paid: boolean;
  amount?: number;
  reference?: string;
  status?: string;
  message?: string;
}

export interface BankDetails {
  bankName: string;
  accountName: string;
  accountNumber: string;
  branchCode?: string;
  swiftCode?: string;
}

export interface InvoiceResponse {
  id: string;
  subscriptionId: string;
  userId: string;
  plan: string;
  amount: number;
  currency: string;
  billingPeriod: string;
  status: string;
  dueDate: Date;
  paidAt?: Date;
  paymentMethod?: string;
  reference?: string;
  createdAt: Date;
  updatedAt: Date;
  subscription?: any;
}

export interface PaymentMethodInfo {
  enabled: boolean;
  name: string;
  description: string;
  icon?: string;
  details?: BankDetails;
}

export interface PaymentSummary {
  totalInvoices: number;
  paidInvoices: number;
  pendingInvoices: number;
  totalAmount: number;
}

export enum PaymentStatusEnum {
  PENDING = 'PENDING',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
  OVERDUE = 'OVERDUE',
}