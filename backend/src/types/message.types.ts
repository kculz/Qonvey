export interface SendMessageData {
  receiverId: string;
  content: string;
  loadId?: string;
  bidId?: string;
}

export interface MessageResponse {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  loadId?: string;
  bidId?: string;
  read: boolean;
  readAt?: Date;
  createdAt: Date;
  sender?: any;
  receiver?: any;
}

export interface Conversation {
  user: any;
  lastMessage?: any;
  unreadCount: number;
}

export interface ConversationListResponse {
  conversations: Conversation[];
}

export interface MessageStats {
  sent: number;
  received: number;
  unread: number;
  total: number;
}

export interface PaginatedMessages {
  messages: any[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}