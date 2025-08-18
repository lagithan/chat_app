import { io, Socket } from 'socket.io-client';
import DatabaseService, { User, Message, Session } from './DatabaseService';
import * as Notifications from 'expo-notifications';
import { NotificationBehavior } from 'expo-notifications';

class SocketService {
  private socket: Socket | null = null;
  private isConnected = false;
  private currentUserId: string | null = null;
  private messageHandlers: Set<(message: Partial<Message>) => void> = new Set();
  private connectionHandlers: Set<(status: boolean) => void> = new Set();
  private userJoinHandlers: Set<(userData: Partial<User>) => void> = new Set();
  private userLeftHandlers: Set<(userData: Partial<User>) => void> = new Set();

  constructor() {
    this.setupNotifications();
  }

  private async setupNotifications() {
    await Notifications.setNotificationHandler({
      handleNotification: async (): Promise<NotificationBehavior> => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  }

  connect(userId: string, userName: string) {
    try {
      if (this.socket && this.isConnected) {
        return;
      }

      this.socket = io('http://localhost:3001', {
        transports: ['websocket'],
        query: {
          userId,
          userName,
        },
      });

      this.currentUserId = userId;
      this.setupSocketListeners();
    } catch (error) {
      console.error('Socket connection error:', error);
      this.simulateConnection(userId, userName);
    }
  }

  private setupSocketListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      this.isConnected = true;
      console.log('Socket connected');
      this.notifyConnectionHandlers(true);
    });

    this.socket.on('disconnect', () => {
      this.isConnected = false;
      console.log('Socket disconnected');
      this.notifyConnectionHandlers(false);
    });

    this.socket.on('message', async (messageData: Partial<Message>) => {
      try {
        await DatabaseService.saveMessage({
          ...messageData,
          timestamp: Date.now(),
        });

        this.notifyMessageHandlers(messageData);
        this.showNotification(messageData);
      } catch (error) {
        console.error('Error handling received message:', error);
      }
    });

    this.socket.on('user_joined', (userData: Partial<User>) => {
      console.log('User joined session:', userData);
      this.notifyUserJoinHandlers(userData);
    });

    this.socket.on('user_left', (userData: Partial<User>) => {
      console.log('User left session:', userData);
      this.notifyUserLeftHandlers(userData);
    });

    this.socket.on('error', (error: any) => {
      console.error('Socket error:', error);
    });
  }

  private simulateConnection(userId: string, userName: string) {
    this.currentUserId = userId;
    this.isConnected = true;
    console.log('Running in offline/demo mode');
    this.notifyConnectionHandlers(true);
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnected = false;
    this.currentUserId = null;
    this.notifyConnectionHandlers(false);
  }

  joinSession(sessionId: string) {
    if (this.socket && this.isConnected) {
      this.socket.emit('join_session', {
        sessionId,
        userId: this.currentUserId,
      });
    }
  }

  leaveSession(sessionId: string) {
    if (this.socket && this.isConnected) {
      this.socket.emit('leave_session', {
        sessionId,
        userId: this.currentUserId,
      });
    }
  }

  async sendMessage(messageData: Partial<Message>) {
    try {
      const message = {
        ...messageData,
        timestamp: Date.now(),
      };

      await DatabaseService.saveMessage(message);

      if (this.socket && this.isConnected) {
        this.socket.emit('message', message);
      }

      if (!this.isConnected) {
        setTimeout(() => {
          this.notifyMessageHandlers(message);
        }, 100);
      }

      return { success: true, message };
    } catch (error: any) {
      console.error('Error sending message:', error);
      return { success: false, error: error.message };
    }
  }

  async createQRSession(sessionId: string, creatorData: Partial<User>) {
    try {
      const sessionData = {
        sessionId,
        creatorId: creatorData.userId,
        creatorName: creatorData.username,
        participantId: undefined,
        participantName: undefined,
        sessionName: `Chat with ${creatorData.username}`,
        createdAt: Date.now(),
        lastActivity: Date.now(),
        isActive: 1,
      };

      await DatabaseService.createSession(sessionData);

      if (this.socket && this.isConnected) {
        this.socket.emit('create_session', {
          sessionId,
          creatorId: creatorData.userId,
          creatorName: creatorData.username,
          createdAt: Date.now(),
        });
      }

      return { success: true, sessionId };
    } catch (error: any) {
      console.error('Error creating QR session:', error);
      return { success: false, error: error.message };
    }
  }

  async joinQRSession(sessionId: string, participantData: Partial<User>) {
    try {
      const sessionData = {
        sessionId,
        participantId: participantData.userId,
        participantName: participantData.username,
      };

      if (this.socket && this.isConnected) {
        this.socket.emit('join_qr_session', sessionData);
      }

      this.joinSession(sessionId);

      return { success: true, sessionId };
    } catch (error: any) {
      console.error('Error joining QR session:', error);
      return { success: false, error: error.message };
    }
  }

  onMessage(handler: (message: Partial<Message>) => void) {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  onConnectionChange(handler: (status: boolean) => void) {
    this.connectionHandlers.add(handler);
    return () => this.connectionHandlers.delete(handler);
  }

  onUserJoin(handler: (userData: Partial<User>) => void) {
    this.userJoinHandlers.add(handler);
    return () => this.userJoinHandlers.delete(handler);
  }

  onUserLeft(handler: (userData: Partial<User>) => void) {
    this.userLeftHandlers.add(handler);
    return () => this.userLeftHandlers.delete(handler);
  }

  private notifyMessageHandlers(message: Partial<Message>) {
    this.messageHandlers.forEach(handler => {
      try {
        handler(message);
      } catch (error) {
        console.error('Error in message handler:', error);
      }
    });
  }

  private notifyConnectionHandlers(status: boolean) {
    this.connectionHandlers.forEach(handler => {
      try {
        handler(status);
      } catch (error) {
        console.error('Error in connection handler:', error);
      }
    });
  }

  private notifyUserJoinHandlers(userData: Partial<User>) {
    this.userJoinHandlers.forEach(handler => {
      try {
        handler(userData);
      } catch (error) {
        console.error('Error in user join handler:', error);
      }
    });
  }

  private notifyUserLeftHandlers(userData: Partial<User>) {
    this.userLeftHandlers.forEach(handler => {
      try {
        handler(userData);
      } catch (error) {
        console.error('Error in user left handler:', error);
      }
    });
  }

  private async showNotification(messageData: Partial<Message>) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `New message from ${messageData.senderName || 'Unknown'}`,
          body: messageData.message || 'New message',
          data: { sessionId: messageData.sessionId },
        },
        trigger: null,
      });
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  }

  isSocketConnected(): boolean {
    return this.isConnected;
  }

  getCurrentUserId(): string | null {
    return this.currentUserId;
  }
}

export default new SocketService();