// hooks/useNotifications.ts
import { useState, useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { NotificationService } from '@/services/notifications/push';
import { DatabaseService } from '@/services/database/sqlite';
import { getCurrentUserProfile } from '@/services/firebase/config';
import { NotificationData } from '@/types/chat';

export function useNotifications() {
  const [expoPushToken, setExpoPushToken] = useState<string>('');
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);
  const [badgeCount, setBadgeCount] = useState<number>(0);
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();
  const appState = useRef(AppState.currentState);
  const db = DatabaseService.getInstance();

  useEffect(() => {
    initializeNotifications();
    setupAppStateListener();
    
    return () => {
      cleanup();
    };
  }, []);

  const initializeNotifications = async () => {
    try {
      // Register for push notifications
      const token = await NotificationService.getExpoPushToken();
      if (token) {
        setExpoPushToken(token);
        
        // Save token to database
        const userProfile = await getCurrentUserProfile();
        if (userProfile) {
          await db.savePushToken(userProfile.id, token);
        }
      }

      // Set up notification listeners
      notificationListener.current = Notifications.addNotificationReceivedListener(handleNotificationReceived);
      responseListener.current = Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);

      // Update badge count
      await updateBadgeCount();
      
    } catch (error) {
      console.error('Error initializing notifications:', error);
    }
  };

  const setupAppStateListener = () => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  };

  const handleAppStateChange = async (nextAppState: AppStateStatus) => {
    if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
      // App has come to the foreground
      await updateBadgeCount();
      await NotificationService.clearAllNotifications();
    }
    appState.current = nextAppState;
  };

  const handleNotificationReceived = (notification: Notifications.Notification) => {
    console.log('Notification received:', notification);
    setNotification(notification);
    
    // Update badge count
    updateBadgeCount();
  };

  const handleNotificationResponse = async (response: Notifications.NotificationResponse) => {
    const data = NotificationService.handleNotificationResponse(response);
    
    if (data) {
      await handleNotificationTap(data);
    }
  };

  const handleNotificationTap = async (data: NotificationData) => {
    try {
      switch (data.type) {
        case 'chat':
          if (data.chatId) {
            // Navigate to specific chat
            router.push(`/chat/${data.chatId}`);
            
            // Clear notifications for this chat
            await NotificationService.clearChatNotifications(data.chatId);
            
            // Update badge count
            await updateBadgeCount();
          }
          break;
          
        case 'connection_request':
          // Handle connection request (could show accept/decline dialog)
          if (data.senderName) {
            await showConnectionRequestDialog(data.senderName, data.chatId);
          }
          break;
          
        case 'system':
          // Handle system notifications
          console.log('System notification tapped:', data.message);
          break;
          
        default:
          console.log('Unknown notification type:', data.type);
      }
    } catch (error) {
      console.error('Error handling notification tap:', error);
    }
  };

  const showConnectionRequestDialog = async (senderName: string, sessionId?: string) => {
    // This would typically show an alert or modal
    // For now, we'll just log it
    console.log(`Connection request from ${senderName}`);
    
    // You could implement a custom modal here or use Alert
    // Alert.alert(
    //   'Chat Request',
    //   `${senderName} wants to start a chat with you`,
    //   [
    //     { text: 'Decline', style: 'cancel' },
    //     { text: 'Accept', onPress: () => acceptChatRequest(sessionId) }
    //   ]
    // );
  };

  const updateBadgeCount = async () => {
    try {
      // Get unread count from database
      const chats = await db.getAllChats();
      const totalUnread = chats.reduce((sum, chat) => sum + (chat.unreadCount || 0), 0);
      
      setBadgeCount(totalUnread);
      await NotificationService.setBadgeCount(totalUnread);
      
    } catch (error) {
      console.error('Error updating badge count:', error);
    }
  };

  const showLocalNotification = async (
    title: string, 
    body: string, 
    data?: NotificationData
  ) => {
    try {
      await NotificationService.scheduleLocalNotification(title, body, data);
      await updateBadgeCount();
    } catch (error) {
      console.error('Error showing local notification:', error);
    }
  };

  const clearChatNotifications = async (chatId: string) => {
    try {
      await NotificationService.clearChatNotifications(chatId);
      await db.clearUnreadCount(chatId);
      await updateBadgeCount();
    } catch (error) {
      console.error('Error clearing chat notifications:', error);
    }
  };

  const clearAllNotifications = async () => {
    try {
      await NotificationService.clearAllNotifications();
      await NotificationService.clearBadge();
      setBadgeCount(0);
      
      // Clear all unread counts in database
      const chats = await db.getAllChats();
      for (const chat of chats) {
        await db.clearUnreadCount(chat.id);
      }
    } catch (error) {
      console.error('Error clearing all notifications:', error);
    }
  };

  const sendPushNotification = async (
    targetUserId: string,
    title: string,
    body: string,
    data?: NotificationData
  ) => {
    try {
      const token = await db.getPushToken(targetUserId);
      if (token) {
        const success = await NotificationService.sendPushNotification(token, title, body, data);
        return success;
      }
      return false;
    } catch (error) {
      console.error('Error sending push notification:', error);
      return false;
    }
  };

  const requestPermissions = async () => {
    try {
      const granted = await NotificationService.requestPermissions();
      if (granted) {
        const token = await NotificationService.getExpoPushToken();
        if (token) {
          setExpoPushToken(token);
          
          const userProfile = await getCurrentUserProfile();
          if (userProfile) {
            await db.savePushToken(userProfile.id, token);
          }
        }
      }
      return granted;
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return false;
    }
  };

  const cleanup = () => {
    if (notificationListener.current) {
      Notifications.removeNotificationSubscription(notificationListener.current);
    }
    if (responseListener.current) {
      Notifications.removeNotificationSubscription(responseListener.current);
    }
  };

  // Get notification permission status
  const getPermissionStatus = async () => {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      return status;
    } catch (error) {
      console.error('Error getting permission status:', error);
      return 'undetermined';
    }
  };

  return {
    expoPushToken,
    notification,
    badgeCount,
    showLocalNotification,
    clearChatNotifications,
    clearAllNotifications,
    sendPushNotification,
    requestPermissions,
    getPermissionStatus,
    updateBadgeCount,
  };
}