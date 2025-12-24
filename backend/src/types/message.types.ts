export interface SendMessageData {
  receiverId: string;
  content: string;
  loadId?: string;
  bidId?: string;
}

export interface ConversationResponse {
  messages: any[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

export interface ConversationSummary {
  user: any;
  lastMessage: any;
  unreadCount: number;
}

export interface MessageStats {
  sent: number;
  received: number;
  unread: number;
  total: number;
}

