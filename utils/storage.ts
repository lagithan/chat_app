import AsyncStorage from '@react-native-async-storage/async-storage';

export class StorageUtils {
  static async setItem(key: string, value: any): Promise<void> {
    try {
      const jsonValue = JSON.stringify(value);
      await AsyncStorage.setItem(key, jsonValue);
    } catch (error) {
      console.error(`Error storing item ${key}:`, error);
      throw error;
    }
  }

  static async getItem<T>(key: string): Promise<T | null> {
    try {
      const jsonValue = await AsyncStorage.getItem(key);
      return jsonValue ? JSON.parse(jsonValue) : null;
    } catch (error) {
      console.error(`Error retrieving item ${key}:`, error);
      return null;
    }
  }

  static async removeItem(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error(`Error removing item ${key}:`, error);
      throw error;
    }
  }

  static async getAllKeys(): Promise<string[]> {
    try {
      return await AsyncStorage.getAllKeys();
    } catch (error) {
      console.error('Error getting all keys:', error);
      return [];
    }
  }

  static async multiGet(keys: string[]): Promise<Array<[string, string | null]>> {
    try {
      return await AsyncStorage.multiGet(keys);
    } catch (error) {
      console.error('Error getting multiple items:', error);
      return [];
    }
  }

  static async multiSet(keyValuePairs: Array<[string, string]>): Promise<void> {
    try {
      await AsyncStorage.multiSet(keyValuePairs);
    } catch (error) {
      console.error('Error setting multiple items:', error);
      throw error;
    }
  }

  static async clear(): Promise<void> {
    try {
      await AsyncStorage.clear();
    } catch (error) {
      console.error('Error clearing storage:', error);
      throw error;
    }
  }

  // Chat-specific storage methods
  static async saveChat(chat: any): Promise<void> {
    const chats = await this.getItem<any[]>('chats') || [];
    const existingIndex = chats.findIndex(c => c.id === chat.id);
    
    if (existingIndex !== -1) {
      chats[existingIndex] = chat;
    } else {
      chats.unshift(chat);
    }
    
    await this.setItem('chats', chats);
  }

  static async saveMessage(chatId: string, message: any): Promise<void> {
    const messages = await this.getItem<any[]>(`messages_${chatId}`) || [];
    messages.push(message);
    await this.setItem(`messages_${chatId}`, messages);
  }

  static async getMessages(chatId: string): Promise<any[]> {
    return await this.getItem<any[]>(`messages_${chatId}`) || [];
  }

  static async updateMessageStatus(chatId: string, messageId: string, status: string): Promise<void> {
    const messages = await this.getMessages(chatId);
    const messageIndex = messages.findIndex(m => m.id === messageId);
    
    if (messageIndex !== -1) {
      messages[messageIndex].status = status;
      await this.setItem(`messages_${chatId}`, messages);
    }
  }
}
