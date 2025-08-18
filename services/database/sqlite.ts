import * as SQLite from 'expo-sqlite';

export class DatabaseService {
  private static instance: DatabaseService;
  private db: SQLite.SQLiteDatabase;

  private constructor() {
    this.db = SQLite.openDatabaseSync('chat.db');
    this.initDatabase();
  }

  static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  private initDatabase() {
    this.db.execSync(`
      PRAGMA journal_mode = WAL;
      
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        profile_image TEXT,
        device_id TEXT UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS chats (
        id TEXT PRIMARY KEY,
        participants TEXT NOT NULL,
        participant_names TEXT NOT NULL,
        last_message_content TEXT,
        last_message_timestamp DATETIME,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        chat_id TEXT NOT NULL,
        sender_id TEXT NOT NULL,
        sender_name TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        type TEXT DEFAULT 'text',
        status TEXT DEFAULT 'sent',
        FOREIGN KEY (chat_id) REFERENCES chats (id)
      );
    `);
  }

  // User methods
  async saveUser(user: any) {
    return this.db.runSync(
      'INSERT OR REPLACE INTO users (id, name, profile_image, device_id) VALUES (?, ?, ?, ?)',
      [user.id, user.name, user.profileImage || null, user.deviceId]
    );
  }

  async getUser(id: string) {
    return this.db.getFirstSync('SELECT * FROM users WHERE id = ?', [id]);
  }

  // Chat methods
  async saveChat(chat: any) {
    return this.db.runSync(
      'INSERT OR REPLACE INTO chats (id, participants, participant_names, last_message_content, last_message_timestamp, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [
        chat.id,
        JSON.stringify(chat.participants),
        JSON.stringify(chat.participantNames),
        chat.lastMessage?.content || null,
        chat.lastMessage?.timestamp || null,
        new Date().toISOString()
      ]
    );
  }

  async getAllChats() {
    const chats = this.db.getAllSync('SELECT * FROM chats ORDER BY updated_at DESC');
    return chats.map(chat => ({
      ...chat,
      participants: JSON.parse(chat.participants as string),
      participantNames: JSON.parse(chat.participant_names as string)
    }));
  }

  // Message methods
  async saveMessage(message: any) {
    return this.db.runSync(
      'INSERT INTO messages (id, chat_id, sender_id, sender_name, content, timestamp, type, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        message.id,
        message.chatId,
        message.senderId,
        message.senderName,
        message.content,
        message.timestamp.toISOString(),
        message.type || 'text',
        message.status || 'sent'
      ]
    );
  }

  async getMessagesForChat(chatId: string) {
    return this.db.getAllSync(
      'SELECT * FROM messages WHERE chat_id = ? ORDER BY timestamp ASC',
      [chatId]
    );
  }
}
