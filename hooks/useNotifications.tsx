// hooks/useNotifications.ts
import { useCallback } from 'react';
import { useChatContext } from '@/contexts/ChatContext';
import { MessageNotification } from '@/services/notifications/NotificationService';

export function useNotifications() {
  const { notificationService, currentChatId } = useChatContext();

  const showMessageNotification = useCallback((notification: MessageNotification) => {
    console.log('useNotifications: Showing message notification:', notification);
    notificationService.showMessageNotification(notification);
  }, [notificationService]);

  const showBatchMessageNotifications = useCallback((notifications: MessageNotification[]) => {
    console.log('useNotifications: Showing batch notifications:', notifications.length);
    notificationService.showBatchMessageNotifications(notifications);
  }, [notificationService]);

  const showSystemNotification = useCallback((
    title: string, 
    message: string, 
    type: 'success' | 'error' | 'info' = 'info'
  ) => {
    console.log('useNotifications: Showing system notification:', title, message, type);
    notificationService.showSystemNotification(title, message, type);
  }, [notificationService]);

  const clearAllNotifications = useCallback(() => {
    console.log('useNotifications: Clearing all notifications');
    notificationService.clearAllNotifications();
  }, [notificationService]);

  const shouldShowNotification = useCallback((chatId: string) => {
    const shouldShow = notificationService.shouldShowNotification(chatId);
    console.log('useNotifications: Should show notification for', chatId, ':', shouldShow);
    return shouldShow;
  }, [notificationService]);

  const updateLastMessageTime = useCallback((chatId: string, timestamp: number) => {
    notificationService.updateLastMessageTime(chatId, timestamp);
  }, [notificationService]);

  const isNewMessage = useCallback((chatId: string, timestamp: number) => {
    return notificationService.isNewMessage(chatId, timestamp);
  }, [notificationService]);

  const resetNotificationState = useCallback(() => {
    console.log('useNotifications: Resetting notification state');
    notificationService.resetNotificationState();
  }, [notificationService]);

  return {
    showMessageNotification,
    showBatchMessageNotifications,
    showSystemNotification,
    clearAllNotifications,
    shouldShowNotification,
    updateLastMessageTime,
    isNewMessage,
    resetNotificationState,
    currentChatId,
    notificationService, 
  };
}