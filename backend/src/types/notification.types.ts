export interface NotificationData {
  title: string;
  body: string;
  data?: Record<string, any>;
  type?: string;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

