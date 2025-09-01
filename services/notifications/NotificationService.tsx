// services/notifications/NotificationService.ts
import Toast from 'react-native-toast-message';
import { router } from 'expo-router';
import { Vibration, Platform } from 'react-native';

export interface MessageNotification {
  chatId: string;
  senderName: string;
  content: string;
  timestamp: Date;
  senderId: string;
}

export class NotificationService {
  private static instance: NotificationService;
  private currentChatId: string | null = null;
  private lastMessageTimestamps: Map<string, number> = new Map(); // Track last message time per chat

  private constructor() {}

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  // Set the current active chat
  setCurrentChat(chatId: string | null) {
    console.log('NotificationService: Setting current chat to:', chatId);
    this.currentChatId = chatId;
  }

  // Get current chat
  getCurrentChat(): string | null {
    return this.currentChatId;
  }

  // Check if should show notification for this chat
  shouldShowNotification(chatId: string): boolean {
    const shouldShow = this.currentChatId !== chatId;
    console.log('NotificationService: Should show notification for chat', chatId, ':', shouldShow, '(current:', this.currentChatId, ')');
    return shouldShow;
  }

  // Update last message timestamp for a chat
  updateLastMessageTime(chatId: string, timestamp: number) {
    this.lastMessageTimestamps.set(chatId, timestamp);
    console.log('NotificationService: Updated last message time for', chatId, ':', new Date(timestamp).toLocaleTimeString());
  }

  // Check if this is a new message
  isNewMessage(chatId: string, timestamp: number): boolean {
    const lastTime = this.lastMessageTimestamps.get(chatId) || 0;
    const isNew = timestamp > lastTime;
    console.log('NotificationService: Message check for', chatId, '- New:', isNew, 'Current:', new Date(timestamp).toLocaleTimeString(), 'Last:', new Date(lastTime).toLocaleTimeString());
    return isNew;
  }

  // Show notification for new message
  showMessageNotification(notification: MessageNotification) {
    console.log('NotificationService: Attempting to show notification for:', notification.chatId, 'from:', notification.senderName);
    
    // Don't show notification if user is in this chat
    if (!this.shouldShowNotification(notification.chatId)) {
      console.log('NotificationService: User is in current chat, skipping notification');
      return;
    }

    const messageTime = notification.timestamp.getTime();
    
    // Check if this is actually a new message
    if (!this.isNewMessage(notification.chatId, messageTime)) {
      console.log('NotificationService: Not a new message, skipping notification');
      return;
    }

    // Update our record of the last message time
    this.updateLastMessageTime(notification.chatId, messageTime);

    console.log('NotificationService: Showing notification from', notification.senderName);

    // Truncate long messages
    const truncatedContent = notification.content.length > 50 
      ? notification.content.substring(0, 47) + '...' 
      : notification.content;

    // Vibrate on new message
    if (Platform.OS !== 'web') {
      Vibration.vibrate(200);
    }

    // Show toast notification
    Toast.show({
      type: 'success',
      text1: `New message from ${notification.senderName}`,
      text2: truncatedContent,
      position: 'top',
      visibilityTime: 4000,
      autoHide: true,
      onPress: () => {
        console.log('NotificationService: Toast pressed, navigating to chat:', notification.chatId);
        Toast.hide();
        router.push(`/chat/${notification.chatId}`);
      },
    });
  }

  // Show multiple notifications
  showBatchMessageNotifications(notifications: MessageNotification[]) {
    if (!notifications || notifications.length === 0) {
      console.log('NotificationService: No notifications to show');
      return;
    }

    console.log('NotificationService: Processing', notifications.length, 'notifications');

    // Process each notification individually to check if it's new
    notifications.forEach(notification => {
      this.showMessageNotification(notification);
    });
  }

  // Clear all notifications
  clearAllNotifications() {
    Toast.hide();
  }

  // Show system notification
  showSystemNotification(title: string, message: string, type: 'success' | 'error' | 'info' = 'info') {
    Toast.show({
      type: type === 'info' ? 'success' : type,
      text1: title,
      text2: message,
      position: 'top',
      visibilityTime: 3000,
      autoHide: true,
    });
  }

  // Reset notification state (useful for debugging)
  resetNotificationState() {
    this.lastMessageTimestamps.clear();
    console.log('NotificationService: Notification state reset');
  }
}