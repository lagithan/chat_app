import { useState, useEffect, useRef } from 'react';
import { FirestoreService } from '@/services/firebase/firestore';
import { DatabaseService } from '@/services/database/sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';

export function useChat(chatId: string) {
  const [messages, setMessages] = useState<any[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const unsubscribeMessages = useRef<(() => void) | null>(null);
  const unsubscribeTyping = useRef<(() => void) | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const db = DatabaseService.getInstance();

  useEffect(() => {
    loadCurrentUser();
    subscribeToChat();
    
    return () => {
      if (unsubscribeMessages.current) {
        unsubscribeMessages.current();
      }
      if (unsubscribeTyping.current) {
        unsubscribeTyping.current();
      }
    };
  }, [chatId]);

  const loadCurrentUser = async () => {
    try {
      const profile = await AsyncStorage.getItem('userProfile');
      if (profile) {
        setCurrentUser(JSON.parse(profile));
      }
    } catch (error) {
      console.error('Error loading current user:', error);
    }
  };

  const subscribeToChat = () => {
    if (!chatId) return;

    // Subscribe to messages
    unsubscribeMessages.current = FirestoreService.subscribeToMessages(
      chatId,
      (newMessages) => {
        setMessages(newMessages);
        // Save to local database
        newMessages.forEach(message => {
          db.saveMessage(message);
        });
        setLoading(false);
      }
    );

    // Subscribe to typing indicators
    if (currentUser) {
      unsubscribeTyping.current = FirestoreService.subscribeToTyping(
        chatId,
        currentUser.id,
        setIsTyping
      );
    }
  };

  const sendMessage = async (content: string) => {
    if (!currentUser || !content.trim()) return;

    const messageData = {
      senderId: currentUser.id,
      senderName: currentUser.name,
      content: content.trim(),
      type: 'text',
    };

    try {
      await FirestoreService.sendMessage(chatId, messageData);
    } catch (error) {
      console.error('Error sending message:', error);
      // Save to local database as fallback
      const localMessage = {
        id: `local_${Date.now()}`,
        chatId,
        ...messageData,
        timestamp: new Date(),
        status: 'pending',
      };
      await db.saveMessage(localMessage);
      setMessages(prev => [...prev, localMessage]);
    }
  };

  const updateTypingStatus = async (isTypingNow: boolean) => {
    if (!currentUser) return;

    if (isTypingNow) {
      await FirestoreService.updateTypingStatus(chatId, currentUser.id, true);
      
      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Set timeout to stop typing
      typingTimeoutRef.current = setTimeout(() => {
        FirestoreService.updateTypingStatus(chatId, currentUser.id, false);
      }, 2000);
    } else {
      await FirestoreService.updateTypingStatus(chatId, currentUser.id, false);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    }
  };

  return {
    messages,
    isTyping,
    currentUser,
    loading,
    sendMessage,
    updateTypingStatus,
  };
}
