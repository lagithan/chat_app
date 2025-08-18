import { useState, useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { NotificationService } from '@/services/notifications/push';
import AsyncStorage from '@react-native-async-storage/async-storage';

export function useNotifications() {
  const [expoPushToken, setExpoPushToken] = useState<string>('');
  const [notification, setNotification] = useState<any>(null);
  const notificationListener = useRef<any>();
  const responseListener = useRef<any>();

  useEffect(() => {
    registerForPushNotifications();
    
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      setNotification(notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      handleNotificationTap(data);
    });

    return () => {
      Notifications.removeNotificationSubscription(notificationListener.current);
      Notifications.removeNotificationSubscription(responseListener.current);
    };
  }, []);

  const registerForPushNotifications = async () => {
    try {
      await NotificationService.requestPermissions();
      const token = await NotificationService.getExpoPushToken();
      setExpoPushToken(token);
      
      // Save token to storage
      await AsyncStorage.setItem('expoPushToken', token);
    } catch (error) {
      console.error('Error registering for push notifications:', error);
    }
  };

  const handleNotificationTap = (data: any) => {
    // Handle notification tap based on type
    switch (data.type) {
      case 'chat':
        // Navigate to specific chat
        break;
      case 'connection_request':
        // Handle connection request
        break;
      default:
        break;
    }
  };

  const showLocalNotification = async (title: string, body: string, data?: any) => {
    await NotificationService.scheduleLocalNotification(title, body, data);
  };

  return {
    expoPushToken,
    notification,
    showLocalNotification,
  };
}
