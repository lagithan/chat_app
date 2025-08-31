// services/database/sqlite.ts
import * as SQLite from 'expo-sqlite';

// Interfaces matching Firestore service
export interface ChatSession {
  id: string;
  hostId: string;
  hostName: string;
  createdAt: any;
  isActive: boolean;
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
  type: string;
  status: string;
}

export interface UserProfile {
  id: string;
  name: string;
  deviceId: string;
  profileImage?: string;
  status?: string;
}

export class DatabaseService {
  private static instance: DatabaseService;
  public db: SQLite.SQLiteDatabase;

  private constructor() {
    this.db = SQLite.openDatabaseSync('chatapp.db');
    this.initDatabase();
  }

  static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  private initDatabase() {
    try {
      this.db.execSync('PRAGMA journal_mode = WAL;');
      this.createTables();
    } catch (error) {
      console.error('Database initialization error:', error);
    }
  }

  private createTables(): void {
    // Chat Sessions table
    this.db.execSync(`
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id TEXT PRIMARY KEY,
        host_id TEXT NOT NULL,
        host_name TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        is_active INTEGER DEFAULT 1
      );
    `);

    // Add this table creation in the createTables() method
this.db.execSync(`
  CREATE TABLE IF NOT EXISTS user_profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    device_id TEXT NOT NULL,
    profile_image TEXT,
    status TEXT DEFAULT 'Available',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

    // Chats table
    this.db.execSync(`
      CREATE TABLE IF NOT EXISTS chats (
        id TEXT PRIMARY KEY,
        participants TEXT NOT NULL,
        participant_names TEXT NOT NULL,
        last_message_content TEXT,
        last_message_timestamp TEXT,
        last_message_sender_id TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        is_active INTEGER DEFAULT 1
      );
    `);

    // Messages table
    this.db.execSync(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        chat_id TEXT NOT NULL,
        sender_id TEXT NOT NULL,
        sender_name TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
        type TEXT DEFAULT 'text',
        status TEXT DEFAULT 'sent',
        FOREIGN KEY (chat_id) REFERENCES chats (id)
      );
    `);

  }

  // Helper method to safely convert dates
  private safeConvertDate(date: any): string {
    if (!date) return new Date().toISOString();
    
    try {
      // Handle Firestore Timestamp
      if (date && typeof date === 'object' && 'toDate' in date) {
        return date.toDate().toISOString();
      }
      // Handle Date object
      if (date instanceof Date) {
        if (isNaN(date.getTime())) {
          return new Date().toISOString();
        }
        return date.toISOString();
      }
      // Handle string date
      if (typeof date === 'string') {
        const parsed = new Date(date);
        if (isNaN(parsed.getTime())) {
          return new Date().toISOString();
        }
        return parsed.toISOString();
      }
      // Default to current date
      return new Date().toISOString();
    } catch (error) {
      console.error('Error converting date:', error);
      return new Date().toISOString();
    }
  }

  // Add this method to your DatabaseService class in services/database/sqlite.ts


// User Profile Management
async saveUserProfile(profile: UserProfile): Promise<void> {
  try {
    const now = new Date().toISOString();
    
    this.db.runSync(
      `INSERT OR REPLACE INTO user_profiles 
       (id, name, device_id, profile_image, status, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        profile.id,
        profile.name,
        profile.deviceId,
        profile.profileImage || null,
        profile.status || 'Available',
        now
      ]
    );
  } catch (error) {
    console.error('Error saving user profile:', error);
    throw error;
  }
}

async getUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    const result = this.db.getFirstSync(
      'SELECT * FROM user_profiles WHERE id = ?',
      [userId]
    );
    
    if (result) {
      return {
        id: result.id,
        name: result.name,
        deviceId: result.device_id,
        profileImage: result.profile_image || undefined,
        status: result.status || 'Available'
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error getting user profile:', error);
    return null;
  }
}



public async resetDatabase(): Promise<void> {
  try {
    // Drop all tables
    this.db.execSync('DROP TABLE IF EXISTS messages;');
    this.db.execSync('DROP TABLE IF EXISTS chats;');
    this.db.execSync('DROP TABLE IF EXISTS chat_sessions;');
    
    // Recreate tables with new structure
    this.createTables();
    
    console.log('Database reset successfully');
  } catch (error) {
    console.error('Error resetting database:', error);
    throw error;
  }
}

// Alternative method if you just want to clear data but keep table structure
public async clearAllData(): Promise<void> {
  try {
    // Clear all data but keep table structure
    this.db.execSync('DELETE FROM messages;');
    this.db.execSync('DELETE FROM chats;');
    this.db.execSync('DELETE FROM chat_sessions;');
    
    // Reset auto-increment counters if any
    this.db.execSync('DELETE FROM sqlite_sequence WHERE name IN ("messages", "chats", "chat_sessions");');
    
    console.log('All data cleared successfully');
  } catch (error) {
    console.error('Error clearing data:', error);
    throw error;
  }
}

  // Chat Management (matching Firestore methods)
  async saveChat(chat: Chat): Promise<void> {
    try {
      const createdAt = this.safeConvertDate(chat.createdAt);
      const updatedAt = this.safeConvertDate(chat.updatedAt);
      const lastMessageTimestamp = chat.lastMessage?.timestamp ? 
        this.safeConvertDate(chat.lastMessage.timestamp) : null;

      this.db.runSync(
        `INSERT OR REPLACE INTO chats 
         (id, participants, participant_names, last_message_content, 
          last_message_timestamp, last_message_sender_id, created_at, updated_at, is_active) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          chat.id,
          JSON.stringify(chat.participants),
          JSON.stringify(chat.participantNames),
          chat.lastMessage?.content || null,
          lastMessageTimestamp,
          chat.lastMessage?.senderId || null,
          createdAt,
          updatedAt,
          chat.isActive ? 1 : 0
        ]
      );
    } catch (error) {
      console.error('Error saving chat:', error);
      throw error;
    }
  }

  async deleteChat (chatId: string): Promise<void> {
    try{
      this.db.runSync('DELETE FROM chats WHERE id = ?', [chatId]);
      this.db.runSync('DELETE FROM messages WHERE chat_id = ?', [chatId]);
    } catch (error) {
      console.error('Error deleting chat:', error);
      throw error;
    }
  }

  async getAllChats(): Promise<Chat[]> {
    try {
      const chats = this.db.getAllSync(`
        SELECT * FROM chats 
        WHERE is_active = 1 
        ORDER BY updated_at DESC
      `);
      
      return chats.map(chat => this.mapRowToChat(chat));
    } catch (error) {
      console.error('Error getting all chats:', error);
      return [];
    }
  }

 
  async getUserChats(userId: string): Promise<Chat[]> {
    try {
      const chats = this.db.getAllSync(`
        SELECT * FROM chats 
        WHERE is_active = 1 
        AND participants LIKE ?
        ORDER BY updated_at DESC
      `, [`%"${userId}"%`]);
      
      return chats.map(chat => this.mapRowToChat(chat))
        .filter(chat => chat.participants.includes(userId));
    } catch (error) {
      console.error('Error getting user chats:', error);
      return [];
    }
  }

  // Add these debugging methods to your DatabaseService class

// Debug method to check database state
async debugDatabaseState(chatId: string): Promise<void> {
  try {
    console.log('=== Database Debug Info ===');
    
    // Check if chat exists
    const chat = await this.getChatById(chatId);
    console.log('Chat exists:', !!chat);
    console.log('Chat data:', chat);
    
    // Check messages count
    const messages = await this.getMessagesForChat(chatId);
    console.log('Messages in DB:', messages.length);
    
    // Check table structure
    const tables = this.db.getAllSync("SELECT name FROM sqlite_master WHERE type='table'");
    console.log('Available tables:', tables);
    
    // Check messages table structure
    const schema = this.db.getAllSync("PRAGMA table_info(messages)");
    console.log('Messages table schema:', schema);
    
    console.log('=== End Debug Info ===');
  } catch (error) {
    console.error('Debug error:', error);
  }
}

// Method to test database write permissions
async testDatabaseWrite(): Promise<boolean> {
  try {
    const testId = `test_${Date.now()}`;
    
    // Try to insert a test record
    this.db.runSync(
      'INSERT INTO messages (id, chat_id, sender_id, sender_name, content) VALUES (?, ?, ?, ?, ?)',
      [testId, 'test_chat', 'test_sender', 'Test User', 'Test message']
    );
    
    // Try to read it back
    const result = this.db.getFirstSync('SELECT * FROM messages WHERE id = ?', [testId]);
    
    // Clean up
    this.db.runSync('DELETE FROM messages WHERE id = ?', [testId]);
    
    console.log('Database write test successful');
    return !!result;
  } catch (error) {
    console.error('Database write test failed:', error);
    return false;
  }
}



async saveExistingMessages(messages: Message[]): Promise<void> {
  try {
    // Begin transaction for better performance and atomicity
    this.db.execSync('BEGIN TRANSACTION;');
    
    for (const message of messages) {
      // Use INSERT OR REPLACE to handle potential duplicates
      this.db.runSync(
        `INSERT OR REPLACE INTO messages 
         (id, chat_id, sender_id, sender_name, content, timestamp, type, status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          message.id,
          message.chatId,
          message.senderId,
          message.senderName,
          message.content,
          this.safeConvertDate(message.timestamp),
          message.type || 'text',
          message.status || 'sent'
        ]
      );
    }
    
    // Commit transaction
    this.db.execSync('COMMIT;');
    
    console.log(`Successfully saved ${messages.length} messages to local database`);
  } catch (error) {
    // Rollback transaction on error
    this.db.execSync('ROLLBACK;');
    console.error('Error saving existing messages:', error);
    throw error;
  }
}

  // Message Management (matching Firestore methods)
  async sendMessage(chatId: string, senderId: string, senderName: string, content: string): Promise<void> {
    try {
      const messageId = `msg_${Date.now()}_${Math.random()}`;
      const now = new Date().toISOString();
      
      // Add message
      this.db.runSync(
        `INSERT INTO messages 
         (id, chat_id, sender_id, sender_name, content, timestamp, type, status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [messageId, chatId, senderId, senderName, content, now, 'text', 'sent']
      );

      // Update chat's last message
      this.db.runSync(
        `UPDATE chats 
         SET last_message_content = ?, 
             last_message_timestamp = ?, 
             last_message_sender_id = ?,
             updated_at = ? 
         WHERE id = ?`,
        [content, now, senderId, now, chatId]
      );
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  async getMessagesForChat(chatId: string): Promise<Message[]> {
    try {
      const messages = this.db.getAllSync(
        `SELECT * FROM messages 
         WHERE chat_id = ? 
         ORDER BY timestamp ASC`,
        [chatId]
      );
      
      return messages.map(message => this.mapRowToMessage(message));
    } catch (error) {
      console.error('Error getting messages for chat:', error);
      return [];
    }
  }

  

  
  // Helper method
  public async getChatById(chatId: string): Promise<Chat | null> {
    try {
      const result = this.db.getFirstSync('SELECT * FROM chats WHERE id = ?', [chatId]);
      return result ? this.mapRowToChat(result) : null;
    } catch (error) {
      console.error('Error getting chat by id:', error);
      return null;
    }
  }

  
  private mapRowToChat(row: any): Chat {
    return {
      id: row.id,
      participants: JSON.parse(row.participants),
      participantNames: JSON.parse(row.participant_names),
      lastMessage: row.last_message_content ? {
        content: row.last_message_content,
        timestamp: row.last_message_timestamp,
        senderId: row.last_message_sender_id || ''
      } : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      isActive: row.is_active === 1
    };
  }

  private mapRowToMessage(row: any): Message {
    return {
      id: row.id,
      chatId: row.chat_id,
      senderId: row.sender_id,
      senderName: row.sender_name,
      content: row.content,
      timestamp: row.timestamp,
      type: row.type,
      status: row.status
    };
  }
}