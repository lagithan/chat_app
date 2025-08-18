export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: Date;
  type: 'text' | 'image';
  status: 'sending' | 'sent' | 'delivered' | 'read';
}

export interface Chat {
  id: string;
  participants: string[];
  participantNames: { [userId: string]: string };
  lastMessage?: Message;
  updatedAt: Date;
  isTyping?: { [userId: string]: boolean };
}

export interface ChatSession {
  id: string;
  hostId: string;
  qrCode: string;
  isActive: boolean;
  createdAt: Date;
}
