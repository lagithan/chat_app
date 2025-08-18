// services/database/sqlite.ts
import * as SQLite from 'expo-sqlite';
import { Message, Chat, User } from '@/types/chat';

export class DatabaseService {
  private static instance: DatabaseService;
  public db: SQLite.SQLiteDatabase; // Make db public for direct access
  private currentVersion = 2; // Increment this when schema changes

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
      
      // Check current schema version
      const version = this.getSchemaVersion();
      
      if (version < this.currentVersion) {
        console.log(`Migrating database from version ${version} to ${this.currentVersion}`);
        this.migrateDatabase(version);
      } else {
        // Create tables if they don't exist (fresh install)
        this.createTables();
      }
      
      // Update schema version
      this.setSchemaVersion(this.currentVersion);
      
    } catch (error) {
      console.error('Database initialization error:', error);
      // If there's any error, recreate the database
      this.recreateDatabase();
    }
  }

  private getSchemaVersion(): number {
    try {
      // Create schema_version table if it doesn't exist
      this.db.execSync(`
        CREATE TABLE IF NOT EXISTS schema_version (
          version INTEGER PRIMARY KEY
        );
      `);
      
      const result = this.db.getFirstSync('SELECT version FROM schema_version ORDER BY version DESC LIMIT 1');
      return result?.version || 0;
    } catch (error) {
      console.error('Error getting schema version:', error);
      return 0;
    }
  }

  private setSchemaVersion(version: number): void {
    try {
      this.db.runSync('DELETE FROM schema_version');
      this.db.runSync('INSERT INTO schema_version (version) VALUES (?)', [version]);
    } catch (error) {
      console.error('Error setting schema version:', error);
    }
  }

  private migrateDatabase(fromVersion: number): void {
    try {
      if (fromVersion < 1) {
        // Migration from version 0 to 1
        this.createTables();
      }
      
      if (fromVersion < 2) {
        // Migration from version 1 to 2 - ensure proper column names
        this.fixColumnNames();
      }
      
      // Add more migrations here as needed
      
    } catch (error) {
      console.error('Database migration error:', error);
      // If migration fails, recreate database
      this.recreateDatabase();
    }
  }

  private fixColumnNames(): void {
    try {
      // Check if messages table exists and has correct columns
      const tableInfo = this.db.getAllSync("PRAGMA table_info(messages)");
      const columnNames = tableInfo.map((col: any) => col.name);
      
      if (!columnNames.includes('chat_id')) {
        console.log('Recreating messages table with correct schema...');
        
        // Backup existing data if any
        let existingMessages: any[] = [];
        try {
          existingMessages = this.db.getAllSync('SELECT * FROM messages');
        } catch (e) {
          // Table might not exist or be corrupted
          console.log('No existing messages to backup');
        }
        
        // Drop and recreate messages table
        this.db.execSync('DROP TABLE IF EXISTS messages');
        this.createMessagesTable();
        
        // Restore data if we had any
        if (existingMessages.length > 0) {
          console.log(`Restoring ${existingMessages.length} messages...`);
          for (const msg of existingMessages) {
            try {
              this.db.runSync(
                `INSERT INTO messages 
                 (id, chat_id, sender_id, sender_name, content, timestamp, type, status, local_timestamp) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  msg.id || `msg_${Date.now()}_${Math.random()}`,
                  msg.chatId || msg.chat_id || 'unknown',
                  msg.senderId || msg.sender_id || 'unknown',
                  msg.senderName || msg.sender_name || 'Unknown',
                  msg.content || '',
                  msg.timestamp || new Date().toISOString(),
                  msg.type || 'text',
                  msg.status || 'sent',
                  new Date().toISOString()
                ]
              );
            } catch (e) {
              console.error('Error restoring message:', e);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fixing column names:', error);
    }
  }

  private recreateDatabase(): void {
    try {
      console.log('Recreating database with fresh schema...');
      
      // Drop all tables
      this.db.execSync(`
        DROP TABLE IF EXISTS messages;
        DROP TABLE IF EXISTS chats;
        DROP TABLE IF EXISTS users;
        DROP TABLE IF EXISTS push_tokens;
        DROP TABLE IF EXISTS sync_queue;
        DROP TABLE IF EXISTS schema_version;
      `);
      
      // Create fresh tables
      this.createTables();
      this.setSchemaVersion(this.currentVersion);
      
    } catch (error) {
      console.error('Error recreating database:', error);
      throw error;
    }
  }

  private createTables(): void {
    // Users table
    this.db.execSync(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        profile_image TEXT,
        device_id TEXT UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_seen DATETIME,
        is_online INTEGER DEFAULT 0
      );
    `);

    // Chats table
    this.db.execSync(`
      CREATE TABLE IF NOT EXISTS chats (
        id TEXT PRIMARY KEY,
        participants TEXT NOT NULL,
        participant_names TEXT NOT NULL,
        last_message_content TEXT,
        last_message_timestamp DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_active INTEGER DEFAULT 1,
        unread_count INTEGER DEFAULT 0
      );
    `);

    // Messages table
    this.createMessagesTable();

    // Push tokens table
    this.db.execSync(`
      CREATE TABLE IF NOT EXISTS push_tokens (
        user_id TEXT PRIMARY KEY,
        token TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Sync queue table
    this.db.execSync(`
      CREATE TABLE IF NOT EXISTS sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        operation TEXT NOT NULL,
        table_name TEXT NOT NULL,
        record_id TEXT NOT NULL,
        data TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        retry_count INTEGER DEFAULT 0
      );
    `);

    // Create indexes
    this.createIndexes();
  }

  private createMessagesTable(): void {
    this.db.execSync(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        chat_id TEXT NOT NULL,
        sender_id TEXT NOT NULL,
        sender_name TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        type TEXT DEFAULT 'text',
        status TEXT DEFAULT 'sent',
        is_read INTEGER DEFAULT 0,
        local_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (chat_id) REFERENCES chats (id)
      );
    `);
  }

  private createIndexes(): void {
    this.db.execSync(`
      CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
      CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
      CREATE INDEX IF NOT EXISTS idx_chats_updated_at ON chats(updated_at);
      CREATE INDEX IF NOT EXISTS idx_sync_queue_created_at ON sync_queue(created_at);
    `);
  }

  // User methods
  async saveUser(user: User): Promise<void> {
    try {
      this.db.runSync(
        `INSERT OR REPLACE INTO users 
         (id, name, profile_image, device_id, created_at, last_seen, is_online) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          user.id,
          user.name,
          user.profileImage || null,
          user.deviceId,
          user.createdAt || new Date().toISOString(),
          new Date().toISOString(),
          1
        ]
      );
    } catch (error) {
      console.error('Error saving user:', error);
      throw error;
    }
  }

  async getUser(id: string): Promise<User | null> {
    try {
      const result = this.db.getFirstSync('SELECT * FROM users WHERE id = ?', [id]);
      return result ? this.mapRowToUser(result) : null;
    } catch (error) {
      console.error('Error getting user:', error);
      return null;
    }
  }

  async updateUserLastSeen(userId: string): Promise<void> {
    try {
      this.db.runSync(
        'UPDATE users SET last_seen = ?, is_online = 1 WHERE id = ?',
        [new Date().toISOString(), userId]
      );
    } catch (error) {
      console.error('Error updating user last seen:', error);
    }
  }

  // Chat methods
  async saveChat(chat: Chat): Promise<void> {
    try {
      this.db.runSync(
        `INSERT OR REPLACE INTO chats 
         (id, participants, participant_names, last_message_content, 
          last_message_timestamp, created_at, updated_at, is_active) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          chat.id,
          JSON.stringify(chat.participants),
          JSON.stringify(chat.participantNames),
          chat.lastMessage?.content || null,
          chat.lastMessage?.timestamp ? new Date(chat.lastMessage.timestamp).toISOString() : null,
          chat.createdAt ? new Date(chat.createdAt).toISOString() : new Date().toISOString(),
          chat.updatedAt ? new Date(chat.updatedAt).toISOString() : new Date().toISOString(),
          chat.isActive ? 1 : 0
        ]
      );
    } catch (error) {
      console.error('Error saving chat:', error);
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
      console.error('Error getting chats:', error);
      return [];
    }
  }

  async getChatById(chatId: string): Promise<Chat | null> {
    try {
      const result = this.db.getFirstSync('SELECT * FROM chats WHERE id = ?', [chatId]);
      return result ? this.mapRowToChat(result) : null;
    } catch (error) {
      console.error('Error getting chat by id:', error);
      return null;
    }
  }

  async updateChatLastMessage(chatId: string, message: Message): Promise<void> {
    try {
      this.db.runSync(
        `UPDATE chats 
         SET last_message_content = ?, 
             last_message_timestamp = ?, 
             updated_at = ? 
         WHERE id = ?`,
        [
          message.content,
          new Date(message.timestamp).toISOString(),
          new Date().toISOString(),
          chatId
        ]
      );
    } catch (error) {
      console.error('Error updating chat last message:', error);
    }
  }

  async incrementUnreadCount(chatId: string): Promise<void> {
    try {
      this.db.runSync(
        'UPDATE chats SET unread_count = unread_count + 1 WHERE id = ?',
        [chatId]
      );
    } catch (error) {
      console.error('Error incrementing unread count:', error);
    }
  }

  async clearUnreadCount(chatId: string): Promise<void> {
    try {
      this.db.runSync(
        'UPDATE chats SET unread_count = 0 WHERE id = ?',
        [chatId]
      );
    } catch (error) {
      console.error('Error clearing unread count:', error);
    }
  }

  // Message methods
  async saveMessage(message: Message): Promise<void> {
    try {
      this.db.runSync(
        `INSERT OR REPLACE INTO messages 
         (id, chat_id, sender_id, sender_name, content, timestamp, type, status, local_timestamp) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          message.id,
          message.chatId,
          message.senderId,
          message.senderName,
          message.content,
          new Date(message.timestamp).toISOString(),
          message.type || 'text',
          message.status || 'sent',
          new Date().toISOString()
        ]
      );

      // Update chat's last message
      await this.updateChatLastMessage(message.chatId, message);
    } catch (error) {
      console.error('Error saving message:', error);
      throw error;
    }
  }

  async getMessagesForChat(chatId: string, limit?: number): Promise<Message[]> {
    try {
      const limitClause = limit ? `LIMIT ${limit}` : '';
      const messages = this.db.getAllSync(
        `SELECT * FROM messages 
         WHERE chat_id = ? 
         ORDER BY timestamp ASC 
         ${limitClause}`,
        [chatId]
      );
      
      return messages.map(message => this.mapRowToMessage(message));
    } catch (error) {
      console.error('Error getting messages for chat:', error);
      return [];
    }
  }

  async updateMessageStatus(messageId: string, status: Message['status']): Promise<void> {
    try {
      this.db.runSync(
        'UPDATE messages SET status = ? WHERE id = ?',
        [status, messageId]
      );
    } catch (error) {
      console.error('Error updating message status:', error);
    }
  }

  async markMessagesAsRead(chatId: string, userId: string): Promise<void> {
    try {
      this.db.runSync(
        'UPDATE messages SET is_read = 1 WHERE chat_id = ? AND sender_id != ?',
        [chatId, userId]
      );
      
      await this.clearUnreadCount(chatId);
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  }

  // Push token methods
  async savePushToken(userId: string, token: string): Promise<void> {
    try {
      this.db.runSync(
        `INSERT OR REPLACE INTO push_tokens (user_id, token, updated_at) 
         VALUES (?, ?, ?)`,
        [userId, token, new Date().toISOString()]
      );
    } catch (error) {
      console.error('Error saving push token:', error);
    }
  }

  async getPushToken(userId: string): Promise<string | null> {
    try {
      const result = this.db.getFirstSync(
        'SELECT token FROM push_tokens WHERE user_id = ?',
        [userId]
      );
      return result?.token || null;
    } catch (error) {
      console.error('Error getting push token:', error);
      return null;
    }
  }

  // Sync queue methods for offline support
  async addToSyncQueue(operation: string, tableName: string, recordId: string, data: any): Promise<void> {
    try {
      this.db.runSync(
        `INSERT INTO sync_queue (operation, table_name, record_id, data) 
         VALUES (?, ?, ?, ?)`,
        [operation, tableName, recordId, JSON.stringify(data)]
      );
    } catch (error) {
      console.error('Error adding to sync queue:', error);
    }
  }

  async getSyncQueue(): Promise<Array<{ id: number; operation: string; tableName: string; recordId: string; data: any }>> {
    try {
      const items = this.db.getAllSync(`
        SELECT * FROM sync_queue 
        ORDER BY created_at ASC 
        LIMIT 50
      `);
      
      return items.map(item => ({
        id: item.id,
        operation: item.operation,
        tableName: item.table_name,
        recordId: item.record_id,
        data: JSON.parse(item.data)
      }));
    } catch (error) {
      console.error('Error getting sync queue:', error);
      return [];
    }
  }

  async removeSyncQueueItem(id: number): Promise<void> {
    try {
      this.db.runSync('DELETE FROM sync_queue WHERE id = ?', [id]);
    } catch (error) {
      console.error('Error removing sync queue item:', error);
    }
  }

  async clearSyncQueue(): Promise<void> {
    try {
      this.db.runSync('DELETE FROM sync_queue');
    } catch (error) {
      console.error('Error clearing sync queue:', error);
    }
  }

  // Search methods
  async searchMessages(query: string, chatId?: string): Promise<Message[]> {
    try {
      const whereClause = chatId ? 'AND chat_id = ?' : '';
      const params = chatId ? [`%${query}%`, chatId] : [`%${query}%`];
      
      const messages = this.db.getAllSync(
        `SELECT * FROM messages 
         WHERE content LIKE ? ${whereClause}
         ORDER BY timestamp DESC 
         LIMIT 50`,
        params
      );
      
      return messages.map(message => this.mapRowToMessage(message));
    } catch (error) {
      console.error('Error searching messages:', error);
      return [];
    }
  }

  // Database maintenance
  async vacuum(): Promise<void> {
    try {
      this.db.execSync('VACUUM');
    } catch (error) {
      console.error('Error vacuuming database:', error);
    }
  }

  async deleteOldMessages(days: number = 30): Promise<void> {
    try {
      const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      this.db.runSync(
        'DELETE FROM messages WHERE timestamp < ?',
        [cutoffDate]
      );
    } catch (error) {
      console.error('Error deleting old messages:', error);
    }
  }

  // Helper methods to map database rows to objects
  private mapRowToUser(row: any): User {
    return {
      id: row.id,
      name: row.name,
      profileImage: row.profile_image,
      deviceId: row.device_id,
      createdAt: row.created_at
    };
  }

  private mapRowToChat(row: any): Chat {
    return {
      id: row.id,
      participants: JSON.parse(row.participants),
      participantNames: JSON.parse(row.participant_names),
      lastMessage: row.last_message_content ? {
        content: row.last_message_content,
        timestamp: row.last_message_timestamp,
        senderId: ''
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
      type: row.type as Message['type'],
      status: row.status as Message['status']
    };
  }
}