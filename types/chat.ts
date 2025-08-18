// types/chat.ts
export interface User {
  id: string;
  name: string;
  profileImage?: string;
  deviceId: string;
  createdAt?: string;
}

export interface ChatSession {
  id: string;
  hostId: string;
  hostName: string;
  createdAt: any;
  isActive: boolean;
  expiresAt: any;
}

export interface Chat {
  id: string;
  participants: string[];
  participantNames: { [key: string]: string };
  createdAt: any;
  updatedAt: any;
  lastMessage?: {
    content: string;
    timestamp: any;
    senderId: string;
  };
  isActive: boolean;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: any;
  type: 'text' | 'image' | 'file';
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
}

export interface TypingStatus {
  userId: string;
  userName: string;
  isTyping: boolean;
  timestamp: any;
}

export interface NotificationData {
  type: 'chat' | 'connection_request' | 'system';
  chatId?: string;
  senderId?: string;
  senderName?: string;
  message?: string;
}

export interface QRSessionData {
  type: 'chat_session';
  sessionId: string;
  hostId: string;
  hostName: string;
  timestamp: string;
}