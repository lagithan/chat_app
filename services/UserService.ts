import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import DatabaseService, { executeSqlAsync, Message } from './../services/database/sqlite';

interface User {
  id: number;
  userId: string;
  username: string;
  email?: string;
  fullName?: string;
  avatar?: string;
  bio?: string;
  createdAt: number;
  isActive: number;
}

interface Contact {
  id: number;
  userId: string;
  contactUserId: string;
  contactName: string;
  contactAvatar?: string;
  lastMessageTime?: number;
  lastMessage?: string;
  unreadCount: number;
  isBlocked: number;
}

interface Session {
  id: string;
  creatorId: string;
  participantId: string;
  creatorName: string;
  participantName: string;
  createdAt: number;
  lastActivity: number;
  isActive: number;
  sessionName?: string;
}

interface Response<T> {
  success: boolean;
  data?: T;
  error?: string;
}

class UserService {
  async updateProfile(userId: string, profileData: Partial<User>): Promise<Response<void>> {
    try {
      await DatabaseService.updateUser(userId, profileData);
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
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
      const user = await DatabaseService.getUserById(userId);
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

  async addContact(userId: string, contactUserId: string): Promise<Response<User>> {
    try {
      const contactUser = await DatabaseService.getUserById(contactUserId);
      if (!contactUser) {
        throw new Error('Contact user not found');
      }

      await DatabaseService.addContact(userId, {
        contactUserId: contactUser.userId,
        contactName: contactUser.fullName || contactUser.username,
        contactAvatar: contactUser.avatar,
      });

      return { success: true, data: contactUser };
    } catch (error: any) {
      console.error('Error adding contact:', error);
      return { success: false, error: error.message };
    }
  }

  async getContacts(userId: string): Promise<Response<Contact[]>> {
    try {
      const contacts = await DatabaseService.getUserContacts(userId);
      return { success: true, data: contacts };
    } catch (error: any) {
      console.error('Error getting contacts:', error);
      return { success: false, error: error.message };
    }
  }

  async getChatSessions(userId: string): Promise<Response<Session[]>> {
    try {
      const sessions = await DatabaseService.getUserSessions(userId);
      return { success: true, data: sessions };
    } catch (error: any) {
      console.error('Error getting chat sessions:', error);
      return { success: false, error: error.message };
    }
  }

  // Fixed method name to match DatabaseService
  async getSessionMessages(chatId: string): Promise<Response<Message[]>> {
    try {
      const messages = await DatabaseService.getMessages(chatId);
      return { success: true, data: messages };
    } catch (error: any) {
      console.error('Error getting session messages:', error);
      return { success: false, error: error.message };
    }
  }

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