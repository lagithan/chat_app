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
} from 'firebase/firestore';
import { db } from './config';

export class FirestoreService {
  // Chat Sessions
  static async createChatSession(sessionData: any) {
    try {
      const docRef = await addDoc(collection(db, 'chatSessions'), {
        ...sessionData,
        createdAt: serverTimestamp(),
        isActive: true,
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating chat session:', error);
      throw error;
    }
  }

  static async joinChatSession(sessionId: string, userData: any) {
    try {
      const sessionRef = doc(db, 'chatSessions', sessionId);
      const sessionSnap = await getDoc(sessionRef);
      
      if (sessionSnap.exists()) {
        const sessionData = sessionSnap.data();
        const chatId = `chat_${sessionId}`;
        
        // Create or update chat document
        const chatRef = doc(db, 'chats', chatId);
        await setDoc(chatRef, {
          id: chatId,
          participants: [sessionData.hostId, userData.id],
          participantNames: {
            [sessionData.hostId]: sessionData.hostName,
            [userData.id]: userData.name
          },
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          isActive: true,
        });
        
        return chatId;
      }
      throw new Error('Session not found');
    } catch (error) {
      console.error('Error joining chat session:', error);
      throw error;
    }
  }

  // Messages
  static async sendMessage(chatId: string, messageData: any) {
    try {
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        ...messageData,
        timestamp: serverTimestamp(),
        status: 'sent',
      });
      
      // Update last message in chat
      const chatRef = doc(db, 'chats', chatId);
      await updateDoc(chatRef, {
        lastMessage: {
          content: messageData.content,
          timestamp: serverTimestamp(),
          senderId: messageData.senderId,
        },
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  static subscribeToMessages(chatId: string, callback: (messages: any[]) => void) {
    const q = query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('timestamp', 'asc')
    );
    
    return onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date(),
      }));
      callback(messages);
    });
  }

  // Typing Indicators
  static async updateTypingStatus(chatId: string, userId: string, isTyping: boolean) {
    try {
      const typingRef = doc(db, 'chats', chatId, 'typing', userId);
      await setDoc(typingRef, {
        isTyping,
        timestamp: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating typing status:', error);
    }
  }

  static subscribeToTyping(chatId: string, currentUserId: string, callback: (isTyping: boolean) => void) {
    const q = query(collection(db, 'chats', chatId, 'typing'));
    
    return onSnapshot(q, (snapshot) => {
      const typingUsers = snapshot.docs
        .filter(doc => doc.id !== currentUserId)
        .map(doc => doc.data())
        .filter(data => data.isTyping);
      
      callback(typingUsers.length > 0);
    });
  }

  // User Presence
  static async updateUserPresence(userId: string, isOnline: boolean) {
    try {
      const userRef = doc(db, 'users', userId);
      await setDoc(userRef, {
        isOnline,
        lastSeen: serverTimestamp(),
      }, { merge: true });
    } catch (error) {
      console.error('Error updating user presence:', error);
    }
  }
}
