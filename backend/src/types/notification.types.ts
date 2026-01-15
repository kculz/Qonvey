export interface NotificationData {
  title: string;
  body: string;
  type?: string;
  data?: Record<string, any>;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface BulkNotificationResult {
  total: number;
  successful: number;
  failed: number;
}

export interface NotificationStats {
  total: number;
  unread: number;
  today: number;
  thisWeek: number;
}

export interface NotificationPreferences {
  push: boolean;
  sms: boolean;
  email: boolean;
  bidNotifications: boolean;
  tripNotifications: boolean;
  paymentNotifications: boolean;
  marketingNotifications: boolean;
}