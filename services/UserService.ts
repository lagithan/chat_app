import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { DatabaseService } from '../services/database/sqlite';
import { User, Message, Chat } from '@/types/chat';

interface Contact {
  id: string;
  userId: string;
  contactUserId: string;
  contactName: string;
  contactAvatar?: string;
  lastMessageTime?: string;
  lastMessage?: string;
  unreadCount: number;
  isBlocked: boolean;
  createdAt: string;
}

interface Session {
  id: string;
  creatorId: string;
  participantId: string;
  creatorName: string;
  participantName: string;
  createdAt: string;
  lastActivity: string;
  isActive: boolean;
  sessionName?: string;
}

interface Response<T> {
  success: boolean;
  data?: T;
  error?: string;
}

class UserService {
  private dbService: DatabaseService;

  constructor() {
    this.dbService = DatabaseService.getInstance();
  }

  async updateProfile(userId: string, profileData: Partial<User>): Promise<Response<void>> {
    try {
      // Get existing user first
      const existingUser = await this.dbService.getUser(userId);
      if (!existingUser) {
        throw new Error('User not found');
      }

      // Merge with existing data
      const updatedUser: User = {
        ...existingUser,
        ...profileData,
        id: userId, // Ensure ID doesn't change
      };

      await this.dbService.saveUser(updatedUser);
      return { success: true };
    } catch (error: any) {
      console.error('Error updating profile:', error);
      return { success: false, error: error.message };
    }
  }

  async uploadAvatar(): Promise<Response<string>> {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        return { success: false, error: "Permission to access camera roll is required!" };
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaType.Images, // Updated from deprecated MediaTypeOptions
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });

      if (!result.canceled && result.assets[0]) {
        return { success: true, data: result.assets[0].uri };
      }

      return { success: false, error: 'Image selection cancelled' };
    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      return { success: false, error: error.message };
    }
  }

  async takePicture(): Promise<Response<string>> {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

      if (!permissionResult.granted) {
        return { success: false, error: "Permission to access camera is required!" };
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });

      if (!result.canceled && result.assets[0]) {
        return { success: true, data: result.assets[0].uri };
      }

      return { success: false, error: 'Image capture cancelled' };
    } catch (error: any) {
      console.error('Error taking picture:', error);
      return { success: false, error: error.message };
    }
  }

  async generateUserId(username: string): Promise<string> {
    const timestamp = Date.now().toString();
    const randomString = Math.random().toString(36).substring(2, 15);
    const dataToHash = username + timestamp + randomString;

    const userId = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      dataToHash
    );

    return userId.substring(0, 16);
  }

  async generateSessionId(): Promise<string> {
    const timestamp = Date.now().toString();
    const randomString = Math.random().toString(36).substring(2, 15);
    const dataToHash = timestamp + randomString;

    const sessionId = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      dataToHash
    );

    return sessionId.substring(0, 12);
  }

  async getUserProfile(userId: string): Promise<Response<User>> {
    try {
      const user = await this.dbService.getUser(userId);
      if (!user) {
        throw new Error('User not found');
      }

      return { success: true, data: user };
    } catch (error: any) {
      console.error('Error getting user profile:', error);
      return { success: false, error: error.message };
    }
  }

  async updateUserLastSeen(userId: string): Promise<Response<void>> {
    try {
      await this.dbService.updateUserLastSeen(userId);
      
      // Also store in AsyncStorage for local access
      const timestamp = Date.now();
      await AsyncStorage.setItem(`lastSeen_${userId}`, timestamp.toString());
      
      return { success: true };
    } catch (error: any) {
      console.error('Error updating last seen:', error);
      return { success: false, error: error.message };
    }
  }

  async getUserLastSeen(userId: string): Promise<Response<number | null>> {
    try {
      // Try to get from AsyncStorage first for quick access
      const lastSeen = await AsyncStorage.getItem(`lastSeen_${userId}`);
      return {
        success: true,
        data: lastSeen ? parseInt(lastSeen) : null
      };
    } catch (error: any) {
      console.error('Error getting last seen:', error);
      return { success: false, error: error.message };
    }
  }

  formatLastSeen(timestamp: number | null): string {
    if (!timestamp) return 'Never';

    const now = Date.now();
    const diff = now - timestamp;

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) {
      return 'Just now';
    } else if (minutes < 60) {
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else if (hours < 24) {
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else {
      return `${days} day${days > 1 ? 's' : ''} ago`;
    }
  }

  // Contact management using Chat functionality
  async addContact(userId: string, contactUserId: string): Promise<Response<User>> {
    try {
      const contactUser = await this.dbService.getUser(contactUserId);
      if (!contactUser) {
        throw new Error('Contact user not found');
      }

      // Create a chat between the users to represent the contact relationship
      const chatId = await this.generateSessionId();
      const chat: Chat = {
        id: chatId,
        participants: [userId, contactUserId],
        participantNames: [
          (await this.dbService.getUser(userId))?.name || 'Unknown',
          contactUser.name
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isActive: true
      };

      await this.dbService.saveChat(chat);
      return { success: true, data: contactUser };
    } catch (error: any) {
      console.error('Error adding contact:', error);
      return { success: false, error: error.message };
    }
  }

  async getContacts(userId: string): Promise<Response<Contact[]>> {
    try {
      // Get all chats where the user is a participant
      const chats = await this.dbService.getAllChats();
      const userChats = chats.filter(chat => 
        chat.participants.includes(userId) && chat.participants.length === 2
      );

      const contacts: Contact[] = [];
      
      for (const chat of userChats) {
        // Find the other participant
        const contactUserId = chat.participants.find(id => id !== userId);
        if (!contactUserId) continue;

        const contactUser = await this.dbService.getUser(contactUserId);
        if (!contactUser) continue;

        const contact: Contact = {
          id: chat.id,
          userId,
          contactUserId,
          contactName: contactUser.name,
          contactAvatar: contactUser.profileImage,
          lastMessageTime: chat.lastMessage?.timestamp,
          lastMessage: chat.lastMessage?.content,
          unreadCount: 0, // You may want to implement this based on your needs
          isBlocked: false,
          createdAt: chat.createdAt || new Date().toISOString()
        };

        contacts.push(contact);
      }

      return { success: true, data: contacts };
    } catch (error: any) {
      console.error('Error getting contacts:', error);
      return { success: false, error: error.message };
    }
  }

  async getChatSessions(userId: string): Promise<Response<Session[]>> {
    try {
      const chats = await this.dbService.getAllChats();
      const userChats = chats.filter(chat => chat.participants.includes(userId));

      const sessions: Session[] = userChats.map(chat => {
        const otherParticipantId = chat.participants.find(id => id !== userId) || '';
        const otherParticipantName = chat.participantNames.find((name, index) => 
          chat.participants[index] !== userId
        ) || 'Unknown';

        return {
          id: chat.id,
          creatorId: chat.participants[0],
          participantId: otherParticipantId,
          creatorName: chat.participantNames[0] || 'Unknown',
          participantName: otherParticipantName,
          createdAt: chat.createdAt || new Date().toISOString(),
          lastActivity: chat.updatedAt || new Date().toISOString(),
          isActive: chat.isActive ?? true,
          sessionName: undefined // You can implement custom session names if needed
        };
      });

      return { success: true, data: sessions };
    } catch (error: any) {
      console.error('Error getting chat sessions:', error);
      return { success: false, error: error.message };
    }
  }

  async getSessionMessages(chatId: string): Promise<Response<Message[]>> {
    try {
      const messages = await this.dbService.getMessagesForChat(chatId);
      return { success: true, data: messages };
    } catch (error: any) {
      console.error('Error getting session messages:', error);
      return { success: false, error: error.message };
    }
  }

  async createUser(userData: {
    username: string;
    email?: string;
    fullName?: string;
    avatar?: string;
    bio?: string;
  }): Promise<Response<User>> {
    try {
      const userId = await this.generateUserId(userData.username);
      const deviceId = await this.generateSessionId(); // Use session ID generator for device ID

      const user: User = {
        id: userId,
        name: userData.fullName || userData.username,
        profileImage: userData.avatar,
        deviceId,
        createdAt: new Date().toISOString()
      };

      await this.dbService.saveUser(user);
      return { success: true, data: user };
    } catch (error: any) {
      console.error('Error creating user:', error);
      return { success: false, error: error.message };
    }
  }

  async sendMessage(chatId: string, senderId: string, content: string, type: Message['type'] = 'text'): Promise<Response<Message>> {
    try {
      const sender = await this.dbService.getUser(senderId);
      if (!sender) {
        throw new Error('Sender not found');
      }

      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      
      const message: Message = {
        id: messageId,
        chatId,
        senderId,
        senderName: sender.name,
        content,
        timestamp: new Date().toISOString(),
        type,
        status: 'sent'
      };

      await this.dbService.saveMessage(message);
      return { success: true, data: message };
    } catch (error: any) {
      console.error('Error sending message:', error);
      return { success: false, error: error.message };
    }
  }

  async markMessagesAsRead(chatId: string, userId: string): Promise<Response<void>> {
    try {
      await this.dbService.markMessagesAsRead(chatId, userId);
      return { success: true };
    } catch (error: any) {
      console.error('Error marking messages as read:', error);
      return { success: false, error: error.message };
    }
  }

  // Validation methods remain the same
  validateUsername(username: string): { isValid: boolean; error?: string } {
    if (!username || username.trim().length === 0) {
      return { isValid: false, error: 'Username is required' };
    }

    if (username.length < 3) {
      return { isValid: false, error: 'Username must be at least 3 characters' };
    }

    if (username.length > 20) {
      return { isValid: false, error: 'Username must be less than 20 characters' };
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return { isValid: false, error: 'Username can only contain letters, numbers, and underscores' };
    }

    return { isValid: true };
  }

  validateEmail(email: string): { isValid: boolean; error?: string } {
    if (!email || email.trim().length === 0) {
      return { isValid: true };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { isValid: false, error: 'Invalid email format' };
    }

    return { isValid: true };
  }

  validatePassword(password: string): { isValid: boolean; error?: string } {
    if (!password || password.length === 0) {
      return { isValid: false, error: 'Password is required' };
    }

    if (password.length < 6) {
      return { isValid: false, error: 'Password must be at least 6 characters' };
    }

    return { isValid: true };
  }
}

export default new UserService();