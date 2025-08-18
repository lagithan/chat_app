// services/notifications/push.ts
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NotificationData } from '@/types/chat';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    // Check if app is in foreground
    const appState = await Notifications.getLastNotificationResponseAsync();
    
    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    };
  },
});

export class NotificationService {
  private static expoPushToken: string | null = null;

  // Request notification permissions
  static async requestPermissions(): Promise<boolean> {
    try {
      if (!Device.isDevice) {
        console.log('Must use physical device for push notifications');
        return false;
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Failed to get push token for push notification!');
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return false;
    }
  }

  // Get Expo push token
  static async getExpoPushToken(): Promise<string | null> {
    try {
      if (this.expoPushToken) {
        return this.expoPushToken;
      }

      // Check if we have permission
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        return null;
      }

      // Configure Android notification channel
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('chat-messages', {
          name: 'Chat Messages',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#007AFF',
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
          bypassDnd: false,
        });

        await Notifications.setNotificationChannelAsync('chat-requests', {
          name: 'Chat Requests',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 500, 200, 500],
          lightColor: '#34C759',
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
          bypassDnd: true,
        });
      }

      // Get the token
      const projectId = process.env.EXPO_PUBLIC_PROJECT_ID || 'your-expo-project-id';
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId,
      });

      this.expoPushToken = tokenData.data;
      
      // Store token locally
      await AsyncStorage.setItem('expoPushToken', this.expoPushToken);
      
      console.log('Expo Push Token:', this.expoPushToken);
      return this.expoPushToken;
    } catch (error) {
      console.error('Error getting push token:', error);
      return null;
    }
  }

  // Schedule local notification
  static async scheduleLocalNotification(
    title: string, 
    body: string, 
    data?: NotificationData,
    channelId?: string
  ): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: data || {},
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: { 
          seconds: 1,
          channelId: channelId || (Platform.OS === 'android' ? 'chat-messages' : undefined),
        },
      });
    } catch (error) {
      console.error('Error scheduling local notification:', error);
    }
  }

  // Show chat message notification
  static async showChatNotification(
    senderName: string, 
    message: string, 
    chatId: string,
    senderId: string
  ): Promise<void> {
    const data: NotificationData = {
      type: 'chat',
      chatId,
      senderId,
      senderName,
      message,
    };

    await this.scheduleLocalNotification(
      senderName,
      message,
      data,
      'chat-messages'
    );
  }

  // Show connection request notification
  static async showConnectionRequest(senderName: string, sessionId: string): Promise<void> {
    const data: NotificationData = {
      type: 'connection_request',
      senderName,
      chatId: sessionId,
    };

    await this.scheduleLocalNotification(
      'New Chat Request',
      `${senderName} wants to start a chat with you`,
      data,
      'chat-requests'
    );
  }

  // Show system notification
  static async showSystemNotification(title: string, message: string): Promise<void> {
    const data: NotificationData = {
      type: 'system',
      message,
    };

    await this.scheduleLocalNotification(title, message, data);
  }

  // Clear all notifications
  static async clearAllNotifications(): Promise<void> {
    try {
      await Notifications.dismissAllNotificationsAsync();
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  }

  // Clear notifications for specific chat
  static async clearChatNotifications(chatId: string): Promise<void> {
    try {
      const notifications = await Notifications.getPresentedNotificationsAsync();
      
      for (const notification of notifications) {
        const data = notification.request.content.data as NotificationData;
        if (data.chatId === chatId) {
          await Notifications.dismissNotificationAsync(notification.request.identifier);
        }
      }
    } catch (error) {
      console.error('Error clearing chat notifications:', error);
    }
  }

  // Handle notification tap
  static handleNotificationResponse(response: Notifications.NotificationResponse): NotificationData | null {
    try {
      const data = response.notification.request.content.data as NotificationData;
      
      // Clear the notification
      Notifications.dismissNotificationAsync(response.notification.request.identifier);
      
      return data;
    } catch (error) {
      console.error('Error handling notification response:', error);
      return null;
    }
  }

  // Get badge count
  static async getBadgeCount(): Promise<number> {
    try {
      return await Notifications.getBadgeCountAsync();
    } catch (error) {
      console.error('Error getting badge count:', error);
      return 0;
    }
  }

  // Set badge count
  static async setBadgeCount(count: number): Promise<void> {
    try {
      await Notifications.setBadgeCountAsync(count);
    } catch (error) {
      console.error('Error setting badge count:', error);
    }
  }

  // Clear badge
  static async clearBadge(): Promise<void> {
    await this.setBadgeCount(0);
  }

  // Send push notification to other user (would typically be done from server)
  static async sendPushNotification(
    expoPushToken: string,
    title: string,
    body: string,
    data?: NotificationData
  ): Promise<boolean> {
    try {
      const message = {
        to: expoPushToken,
        sound: 'default',
        title,
        body,
        data: data || {},
        priority: 'high',
        channelId: data?.type === 'connection_request' ? 'chat-requests' : 'chat-messages',
      };

      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      const responseData = await response.json();
      console.log('Push notification sent:', responseData);
      
      return response.ok;
    } catch (error) {
      console.error('Error sending push notification:', error);
      return false;
    }
  }
}