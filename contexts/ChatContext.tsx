// contexts/ChatContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { NotificationService } from '@/services/notifications/NotificationService';

interface ChatContextType {
  currentChatId: string | null;
  setCurrentChatId: (chatId: string | null) => void;
  notificationService: NotificationService;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

interface ChatProviderProps {
  children: ReactNode;
}

export function ChatProvider({ children }: ChatProviderProps) {
  const [currentChatId, setCurrentChatIdState] = useState<string | null>(null);
  const notificationService = NotificationService.getInstance();

  // Custom setter that also updates the notification service
  const setCurrentChatId = (chatId: string | null) => {
    console.log('ChatContext: Setting current chat ID to:', chatId);
    setCurrentChatIdState(chatId);
    notificationService.setCurrentChat(chatId);
  };

  // Handle app state changes
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      console.log('ChatContext: App state changed to:', nextAppState);
      
      if (nextAppState === 'active') {
        // Clear notifications when app becomes active
        notificationService.clearAllNotifications();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription?.remove();
    };
  }, [notificationService]);

  const contextValue: ChatContextType = {
    currentChatId,
    setCurrentChatId,
    notificationService,
  };

  return (
    <ChatContext.Provider value={contextValue}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChatContext(): ChatContextType {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChatContext must be used within a ChatProvider');
  }
  return context;
}