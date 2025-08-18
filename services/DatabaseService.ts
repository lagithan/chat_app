import * as SQLite from 'expo-sqlite';
import * as Crypto from 'expo-crypto';

// Interface definitions
export interface User {
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

export interface Contact {
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

export interface Message {
  id: number;
  sessionId: string;
  senderId: string;
  receiverId: string;
  senderName: string;
  receiverName: string;
  message: string;
  messageType: string;
  timestamp: number;
  delivered: number;
  read: number;
}

export interface Session {
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

export interface Response<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Function to open the database
export function openDatabase(): SQLite.SQLiteDatabase {
  return SQLite.openDatabaseSync('chatapp.db');
}

// Corrected function to execute SQL
export async function executeSqlAsync(db: SQLite.SQLiteDatabase, sql: string, params: any[] = []): Promise<any[]> {
  return new Promise((resolve, reject) => {
    try {
      // Explicitly declare the type of the result variable to fix the TypeScript error
      let result: any[];
      const isSelect = sql.trim().toUpperCase().startsWith('SELECT');
      if (isSelect) {
        result = db.getAllSync(sql, params);
      } else {
        db.runSync(sql, params);
        result = []; // For non-SELECT queries, return an empty array
      }
      resolve(result);
    } catch (error) {
      reject(error);
    }
  });
}

export async function getFirstAsync(db: SQLite.SQLiteDatabase, sql: string, params: any[] = []): Promise<any | null> {
  return new Promise((resolve, reject) => {
    try {
      const result = db.getFirstSync(sql, params);
      resolve(result || null);
    } catch (error) {
      reject(error);
    }
  });
}

class DatabaseService {
  private db: SQLite.SQLiteDatabase | null = null;

  async initDatabase(): Promise<void> {
    try {
      this.db = openDatabase();
      await this.createTables();
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Database initialization error:', error);
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    const db = this.db;

    const createUsersTable = `
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId TEXT UNIQUE NOT NULL,
        username TEXT UNIQUE NOT NULL,
        email TEXT,
        fullName TEXT,
        avatar TEXT,
        bio TEXT,
        createdAt INTEGER NOT NULL,
        isActive INTEGER DEFAULT 1
      )
    `;

    const createContactsTable = `
      CREATE TABLE IF NOT EXISTS contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId TEXT NOT NULL,
        contactUserId TEXT NOT NULL,
        contactName TEXT NOT NULL,
        contactAvatar TEXT,
        lastMessageTime INTEGER,
        lastMessage TEXT,
        unreadCount INTEGER DEFAULT 0,
        isBlocked INTEGER DEFAULT 0,
        UNIQUE(userId, contactUserId)
      )
    `;

    const createMessagesTable = `
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sessionId TEXT NOT NULL,
        senderId TEXT NOT NULL,
        receiverId TEXT NOT NULL,
        senderName TEXT NOT NULL,
        receiverName TEXT NOT NULL,
        message TEXT NOT NULL,
        messageType TEXT DEFAULT 'text',
        timestamp INTEGER NOT NULL,
        delivered INTEGER DEFAULT 0,
        read INTEGER DEFAULT 0
      )
    `;

    const createSessionsTable = `
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        creatorId TEXT NOT NULL,
        participantId TEXT NOT NULL,
        creatorName TEXT NOT NULL,
        participantName TEXT NOT NULL,
        createdAt INTEGER NOT NULL,
        lastActivity INTEGER NOT NULL,
        isActive INTEGER DEFAULT 1,
        sessionName TEXT
      )
    `;

    const createAuthTable = `
      CREATE TABLE IF NOT EXISTS auth (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId TEXT UNIQUE NOT NULL,
        passwordHash TEXT NOT NULL,
        lastLogin INTEGER,
        loginCount INTEGER DEFAULT 0
      )
    `;

    await Promise.all([
      executeSqlAsync(db, createUsersTable),
      executeSqlAsync(db, createContactsTable),
      executeSqlAsync(db, createMessagesTable),
      executeSqlAsync(db, createSessionsTable),
      executeSqlAsync(db, createAuthTable),
    ]);
  }

  async createUser(userData: Partial<User>): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    const { userId, username, email, fullName, avatar, bio } = userData;
    const timestamp = Date.now();
    await executeSqlAsync(this.db,
      'INSERT INTO users (userId, username, email, fullName, avatar, bio, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [userId, username, email, fullName, avatar, bio, timestamp]
    );
  }

  async updateUser(userId: string, userData: Partial<User>): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    const { fullName, bio, avatar } = userData;
    await executeSqlAsync(this.db,
      'UPDATE users SET fullName = ?, bio = ?, avatar = ? WHERE userId = ?',
      [fullName, bio, avatar, userId]
    );
  }

  async getUserByUsername(username: string): Promise<User | null> {
    if (!this.db) throw new Error('Database not initialized');
    return await getFirstAsync(this.db, 'SELECT * FROM users WHERE username = ?', [username]);
  }

  async getUserById(userId: string): Promise<User | null> {
    if (!this.db) throw new Error('Database not initialized');
    return await getFirstAsync(this.db, 'SELECT * FROM users WHERE userId = ?', [userId]);
  }

  async createAuth(userId: string, password: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    const passwordHash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      password + 'salt_key_2024'
    );
    await executeSqlAsync(this.db,
      'INSERT INTO auth (userId, passwordHash) VALUES (?, ?)',
      [userId, passwordHash]
    );
  }

  async validatePassword(userId: string, password: string): Promise<boolean> {
    if (!this.db) throw new Error('Database not initialized');
    const passwordHash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      password + 'salt_key_2024'
    );
    const result = await getFirstAsync(this.db,
      'SELECT * FROM auth WHERE userId = ? AND passwordHash = ?',
      [userId, passwordHash]
    );
    if (result) {
      await executeSqlAsync(this.db,
        'UPDATE auth SET lastLogin = ?, loginCount = loginCount + 1 WHERE userId = ?',
        [Date.now(), userId]
      );
    }
    return !!result;
  }

  async saveMessage(messageData: Partial<Message>): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    const { sessionId, senderId, receiverId, senderName, receiverName, message, messageType, timestamp } = messageData;
    await executeSqlAsync(this.db,
      'INSERT INTO messages (sessionId, senderId, receiverId, senderName, receiverName, message, messageType, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [sessionId, senderId, receiverId, senderName, receiverName, message, messageType || 'text', timestamp]
    );
    await this.updateContactLastMessage(senderId!, receiverId!, message!, timestamp!);
  }

  async getMessages(sessionId: string): Promise<Message[]> {
    if (!this.db) throw new Error('Database not initialized');
    return await executeSqlAsync(this.db,
      'SELECT * FROM messages WHERE sessionId = ? ORDER BY timestamp ASC',
      [sessionId]
    );
  }

  async addContact(userId: string, contactData: Partial<Contact>): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    const { contactUserId, contactName, contactAvatar } = contactData;
    const timestamp = Date.now();
    const existing = await getFirstAsync(this.db,
      'SELECT * FROM contacts WHERE userId = ? AND contactUserId = ?',
      [userId, contactUserId]
    );
    if (existing) {
      await executeSqlAsync(this.db,
        'UPDATE contacts SET contactName = ?, contactAvatar = ?, lastMessageTime = ? WHERE userId = ? AND contactUserId = ?',
        [contactName, contactAvatar, timestamp, userId, contactUserId]
      );
    } else {
      await executeSqlAsync(this.db,
        'INSERT INTO contacts (userId, contactUserId, contactName, contactAvatar, lastMessageTime) VALUES (?, ?, ?, ?, ?)',
        [userId, contactUserId, contactName, contactAvatar, timestamp]
      );
    }
  }

  async updateContactLastMessage(senderId: string, receiverId: string, message: string, timestamp: number): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    await Promise.all([
      executeSqlAsync(this.db,
        'UPDATE contacts SET lastMessage = ?, lastMessageTime = ? WHERE userId = ? AND contactUserId = ?',
        [message, timestamp, senderId, receiverId]
      ),
      executeSqlAsync(this.db,
        'UPDATE contacts SET lastMessage = ?, lastMessageTime = ?, unreadCount = unreadCount + 1 WHERE userId = ? AND contactUserId = ?',
        [message, timestamp, receiverId, senderId]
      )
    ]);
  }

  async getUserContacts(userId: string): Promise<Contact[]> {
    if (!this.db) throw new Error('Database not initialized');
    return await executeSqlAsync(this.db,
      'SELECT * FROM contacts WHERE userId = ? ORDER BY lastMessageTime DESC',
      [userId]
    );
  }

  async createSession(sessionData: Partial<Session>): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    const { id, creatorId, participantId, creatorName, participantName, sessionName } = sessionData;
    const timestamp = Date.now();
    await executeSqlAsync(this.db,
      'INSERT INTO sessions (id, creatorId, participantId, creatorName, participantName, createdAt, lastActivity, sessionName) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, creatorId, participantId || '', creatorName, participantName || '', timestamp, timestamp, sessionName]
    );
  }

  // New method to update an existing session with a participant's details
  async updateSessionWithParticipant(sessionId: string, participantId: string, participantName: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    const timestamp = Date.now();
    await executeSqlAsync(this.db,
      'UPDATE sessions SET participantId = ?, participantName = ?, lastActivity = ? WHERE id = ?',
      [participantId, participantName, timestamp, sessionId]
    );
  }

  async getUserSessions(userId: string): Promise<Session[]> {
    if (!this.db) throw new Error('Database not initialized');
    return await executeSqlAsync(this.db,
      'SELECT * FROM sessions WHERE (creatorId = ? OR participantId = ?) AND isActive = 1 ORDER BY lastActivity DESC',
      [userId, userId]
    );
  }

  async updateSessionActivity(sessionId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    await executeSqlAsync(this.db,
      'UPDATE sessions SET lastActivity = ? WHERE id = ?',
      [Date.now(), sessionId]
    );
  }

  async searchUsers(query: string): Promise<Response<User[]>> {
    try {
      if (!this.db) throw new Error('Database not initialized');
      const users = await executeSqlAsync(this.db,
        'SELECT userId, username, fullName, avatar FROM users WHERE username LIKE ? OR fullName LIKE ? LIMIT 10',
        [`%${query}%`, `%${query}%`]
      );
      return { success: true, data: users };
    } catch (error: any) {
      console.error('Error searching users:', error);
      return { success: false, error: error.message };
    }
  }
}

export default new DatabaseService();
