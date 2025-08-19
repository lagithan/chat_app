// services/firebase/firestore.ts
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  serverTimestamp,
  doc,
  updateDoc,
  getDoc,
  setDoc,
  deleteDoc,
  getDocs,
  writeBatch,
  Timestamp
} from 'firebase/firestore';
import { db } from './config';

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
  type: string;
  status: string;
}

export class FirestoreService {
  // QR Session Management
  static async createQRSession(hostId: string, hostName: string): Promise<string> {
    try {
      const sessionData = {
        hostId,
        hostName,
        createdAt: serverTimestamp(),
        isActive: true,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
      };
      
      const docRef = await addDoc(collection(db, 'chatSessions'), sessionData);
      return docRef.id;
    } catch (error) {
      console.error('Error creating QR session:', error);
      throw error;
    }
  }

  static async getQRSession(sessionId: string): Promise<ChatSession | null> {
    try {
      const sessionRef = doc(db, 'chatSessions', sessionId);
      const sessionSnap = await getDoc(sessionRef);
      
      if (sessionSnap.exists()) {
        const data = sessionSnap.data();
        // Check if session is still valid (not expired)
        const now = new Date();
        const expiresAt = data.expiresAt?.toDate();
        
        if (expiresAt && now > expiresAt) {
          // Session expired, delete it
          await deleteDoc(sessionRef);
          return null;
        }
        
        return {
          id: sessionSnap.id,
          ...data
        } as ChatSession;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting QR session:', error);
      throw error;
    }
  }

  // Chat Management
  static async createChatFromSession(sessionId: string, participantId: string, participantName: string): Promise<string> {
    try {
      const session = await this.getQRSession(sessionId);
      if (!session) {
        throw new Error('Session not found or expired');
      }

      const chatId = `chat_${sessionId}_${Date.now()}`;
      
      const chatData: Omit<Chat, 'id'> = {
        participants: [session.hostId, participantId],
        participantNames: {
          [session.hostId]: session.hostName,
          [participantId]: participantName
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isActive: true
      };

      const chatRef = doc(db, 'chats', chatId);
      await setDoc(chatRef, chatData);

      // Clean up the session
      await deleteDoc(doc(db, 'chatSessions', sessionId));

      return chatId;
    } catch (error) {
      console.error('Error creating chat from session:', error);
      throw error;
    }
  }

  static async getUserChats(userId: string): Promise<Chat[]> {
    try {
      // Use a simpler query to avoid index issues
      const q = query(
        collection(db, 'chats'),
        where('participants', 'array-contains', userId)
      );
      
      const querySnapshot = await getDocs(q);
      const chats: Chat[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        // Filter active chats and sort in memory
        if (data.isActive) {
          chats.push({
            id: doc.id,
            ...data
          } as Chat);
        }
      });
      
      // Sort by updatedAt in memory
      chats.sort((a, b) => {
        const aTime = a.updatedAt?.toDate?.() || new Date(0);
        const bTime = b.updatedAt?.toDate?.() || new Date(0);
        return bTime.getTime() - aTime.getTime();
      });
      
      return chats;
    } catch (error) {
      console.error('Error getting user chats:', error);
      
      // If the query fails due to index issues, provide helpful error message
      if (error instanceof Error && error.message.includes('index')) {
        console.error('Firestore index required. Please create the required composite index:');
        console.error('Collection: chats');
        console.error('Fields: participants (Array-contains), isActive (Ascending), updatedAt (Descending)');
        console.error('You can create it in the Firebase console or use the link provided in the error message.');
      }
      
      throw error;
    }
  }

  static subscribeToUserChats(userId: string, callback: (chats: Chat[]) => void, onError?: (error: Error) => void) {
    try {
      // Use a simpler query to avoid index issues
      const q = query(
        collection(db, 'chats'),
        where('participants', 'array-contains', userId)
      );
      
      return onSnapshot(q, 
        (snapshot) => {
          const chats: Chat[] = [];
          snapshot.forEach((doc) => {
            const data = doc.data();
            // Filter active chats and sort in memory
            if (data.isActive) {
              chats.push({
                id: doc.id,
                ...data
              } as Chat);
            }
          });
          
          // Sort by updatedAt in memory
          chats.sort((a, b) => {
            const aTime = a.updatedAt?.toDate?.() || new Date(0);
            const bTime = b.updatedAt?.toDate?.() || new Date(0);
            return bTime.getTime() - aTime.getTime();
          });
          
          callback(chats);
        },
        (error) => {
          console.error('Error in chat subscription:', error);
          
          // If the query fails due to index issues, provide helpful error message
          if (error.message.includes('index')) {
            console.error('Firestore index required. Please create the required composite index:');
            console.error('Collection: chats');
            console.error('Fields: participants (Array-contains), isActive (Ascending), updatedAt (Descending)');
            console.error('You can create it in the Firebase console using the link provided in the error message.');
          }
          
          if (onError) {
            onError(error);
          }
        }
      );
    } catch (error) {
      console.error('Error setting up chat subscription:', error);
      if (onError && error instanceof Error) {
        onError(error);
      }
      return () => {}; // Return empty unsubscribe function
    }
  }

  // Message Management
  static async sendMessage(chatId: string, senderId: string, senderName: string, content: string): Promise<void> {
    try {
      const batch = writeBatch(db);

      // Add message
      const messageRef = doc(collection(db, 'chats', chatId, 'messages'));
      const messageData = {
        senderId,
        senderName,
        content,
        timestamp: serverTimestamp(),
        type: 'text',
        status: 'sent'
      };
      batch.set(messageRef, messageData);

      // Update chat's last message
      const chatRef = doc(db, 'chats', chatId);
      const lastMessage = {
        content,
        timestamp: serverTimestamp(),
        senderId
      };
      batch.update(chatRef, {
        lastMessage,
        updatedAt: serverTimestamp()
      });

      await batch.commit();
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  static subscribeToMessages(chatId: string, callback: (messages: Message[]) => void, onError?: (error: Error) => void) {
    try {
      const q = query(
        collection(db, 'chats', chatId, 'messages'),
        orderBy('timestamp', 'asc')
      );
      
      return onSnapshot(q, 
        (snapshot) => {
          const messages: Message[] = [];
          snapshot.forEach((doc) => {
            messages.push({
              id: doc.id,
              chatId,
              ...doc.data()
            } as Message);
          });
          callback(messages);
        },
        (error) => {
          console.error('Error in message subscription:', error);
          if (onError) {
            onError(error);
          }
        }
      );
    } catch (error) {
      console.error('Error setting up message subscription:', error);
      if (onError && error instanceof Error) {
        onError(error);
      }
      return () => {}; // Return empty unsubscribe function
    }
  }

  // Chat Actions
  static async leaveChat(chatId: string, userId: string): Promise<void> {
    try {
      const chatRef = doc(db, 'chats', chatId);
      const chatSnap = await getDoc(chatRef);
      
      if (chatSnap.exists()) {
        const chatData = chatSnap.data() as Chat;
        
        // If only 2 participants, deactivate the chat
        if (chatData.participants.length <= 2) {
          await updateDoc(chatRef, {
            isActive: false,
            updatedAt: serverTimestamp()
          });
        } else {
          // Remove user from participants (for group chats)
          const updatedParticipants = chatData.participants.filter(id => id !== userId);
          const updatedParticipantNames = { ...chatData.participantNames };
          delete updatedParticipantNames[userId];
          
          await updateDoc(chatRef, {
            participants: updatedParticipants,
            participantNames: updatedParticipantNames,
            updatedAt: serverTimestamp()
          });
        }
      }
    } catch (error) {
      console.error('Error leaving chat:', error);
      throw error;
    }
  }

  // Typing Indicators
  static async updateTypingStatus(chatId: string, userId: string, isTyping: boolean): Promise<void> {
    try {
      const typingRef = doc(db, 'chats', chatId, 'typing', userId);
      if (isTyping) {
        await setDoc(typingRef, {
          isTyping: true,
          timestamp: serverTimestamp()
        });
      } else {
        await deleteDoc(typingRef);
      }
    } catch (error) {
      console.error('Error updating typing status:', error);
    }
  }

  static subscribeToTyping(chatId: string, currentUserId: string, callback: (isTyping: boolean, userName?: string) => void) {
    const q = collection(db, 'chats', chatId, 'typing');
    
    return onSnapshot(q, (snapshot) => {
      const typingUsers = snapshot.docs
        .filter(doc => doc.id !== currentUserId)
        .filter(doc => doc.data().isTyping);
      
      if (typingUsers.length > 0) {
        // Get the user name from chat participants
        callback(true, 'Someone');
      } else {
        callback(false);
      }
    });
  }

  // Cleanup expired sessions (call this periodically)
  static async cleanupExpiredSessions(): Promise<void> {
    try {
      const now = Timestamp.now();
      const q = query(
        collection(db, 'chatSessions'),
        where('expiresAt', '<', now)
      );
      
      const querySnapshot = await getDocs(q);
      const batch = writeBatch(db);
      
      querySnapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });
      
      if (querySnapshot.size > 0) {
        await batch.commit();
        console.log(`Cleaned up ${querySnapshot.size} expired sessions`);
      }
    } catch (error) {
      console.error('Error cleaning up expired sessions:', error);
    }
  }
}