// services/sync/syncService.ts
import * as Network from 'expo-network';
import { DatabaseService } from '@/services/database/sqlite';
import { FirestoreService } from '@/services/firebase/firestore';
import { NotificationService } from '@/services/notifications/push';
import { getCurrentUserProfile } from '@/services/firebase/config';
import { Message, Chat } from '@/types/chat';

export class SyncService {
  private static instance: SyncService;
  private db: DatabaseService;
  private isOnline: boolean = true;
  private syncInProgress: boolean = false;
  private syncListeners: (() => void)[] = [];

  private constructor() {
    this.db = DatabaseService.getInstance();
    this.setupNetworkListener();
  }

  static getInstance(): SyncService {
    if (!SyncService.instance) {
      SyncService.instance = new SyncService();
    }
    return SyncService.instance;
  }

 private async setupNetworkListener() {
  const checkConnection = async () => {
    const state = await Network.getNetworkStateAsync();
    const wasOnline = this.isOnline;
    this.isOnline = state.isConnected ?? false;

    if (!wasOnline && this.isOnline) {
      // Just came back online, start sync
      this.syncPendingData();
    }
  };

  // Initial check
  await checkConnection();

  // Poll every 5 seconds (you can adjust interval)
  setInterval(checkConnection, 5000);
}


  // Subscribe to sync status changes
  onSyncStatusChange(callback: () => void) {
    this.syncListeners.push(callback);
    return () => {
      this.syncListeners = this.syncListeners.filter(listener => listener !== callback);
    };
  }

  private notifySyncListeners() {
    this.syncListeners.forEach(listener => listener());
  }

  // Check if device is online
  isDeviceOnline(): boolean {
    return this.isOnline;
  }

  // Check if sync is in progress
  isSyncing(): boolean {
    return this.syncInProgress;
  }

  // Sync all pending data when coming back online
  async syncPendingData(): Promise<void> {
    if (!this.isOnline || this.syncInProgress) return;

    this.syncInProgress = true;
    this.notifySyncListeners();

    try {
      const currentUser = await getCurrentUserProfile();
      if (!currentUser) return;

      console.log('Starting sync process...');

      // Sync pending messages
      await this.syncPendingMessages();

      // Sync chat updates
      await this.syncChatUpdates(currentUser.id);

      // Clean up completed sync items
      const syncQueue = await this.db.getSyncQueue();
      for (const item of syncQueue) {
        await this.db.removeSyncQueueItem(item.id);
      }

      console.log('Sync completed successfully');
      
      // Show success notification
      await NotificationService.showSystemNotification(
        'Sync Complete',
        'All messages have been synchronized'
      );

    } catch (error) {
      console.error('Error during sync:', error);
      
      // Show error notification
      await NotificationService.showSystemNotification(
        'Sync Failed',
        'Some messages could not be synchronized'
      );
    } finally {
      this.syncInProgress = false;
      this.notifySyncListeners();
    }
  }

  private async syncPendingMessages(): Promise<void> {
    const syncQueue = await this.db.getSyncQueue();
    const messageItems = syncQueue.filter(item => 
      item.operation === 'send_message' && item.tableName === 'messages'
    );

    for (const item of messageItems) {
      try {
        const messageData = item.data as Message;
        
        // Send to Firebase
        await FirestoreService.sendMessage(
          messageData.chatId,
          messageData.senderId,
          messageData.senderName,
          messageData.content
        );

        // Update local message status
        await this.db.updateMessageStatus(messageData.id, 'sent');
        
        // Remove from sync queue
        await this.db.removeSyncQueueItem(item.id);
        
        console.log(`Synced message: ${messageData.id}`);
        
      } catch (error) {
        console.error(`Failed to sync message ${item.recordId}:`, error);
        
        // Update retry count or mark as failed
        await this.handleSyncFailure(item);
      }
    }
  }

  private async syncChatUpdates(userId: string): Promise<void> {
    try {
      // Get latest chats from Firebase
      const firebaseChats = await FirestoreService.getUserChats(userId);
      
      // Update local database
      for (const chat of firebaseChats) {
        await this.db.saveChat(chat);
      }
      
      console.log(`Synced ${firebaseChats.length} chats`);
      
    } catch (error) {
      console.error('Error syncing chat updates:', error);
    }
  }

  private async handleSyncFailure(item: any): Promise<void> {
    const maxRetries = 3;
    
    if (item.retryCount >= maxRetries) {
      // Mark as permanently failed
      const messageData = item.data as Message;
      await this.db.updateMessageStatus(messageData.id, 'failed');
      await this.db.removeSyncQueueItem(item.id);
      
      console.log(`Message ${item.recordId} marked as permanently failed`);
    } else {
      // Increment retry count (would need to update sync queue table schema)
      console.log(`Will retry message ${item.recordId} later`);
    }
  }

  // Send message with offline support
  async sendMessageWithSync(
    chatId: string,
    senderId: string,
    senderName: string,
    content: string
  ): Promise<Message> {
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const message: Message = {
      id: messageId,
      chatId,
      senderId,
      senderName,
      content,
      timestamp: new Date(),
      type: 'text',
      status: this.isOnline ? 'sending' : 'failed'
    };

    // Save to local database immediately
    await this.db.saveMessage(message);

    if (this.isOnline) {
      try {
        // Try to send to Firebase
        await FirestoreService.sendMessage(chatId, senderId, senderName, content);
        
        // Update status to sent
        message.status = 'sent';
        await this.db.updateMessageStatus(messageId, 'sent');
        
      } catch (error) {
        console.error('Error sending message online:', error);
        
        // Add to sync queue for later
        message.status = 'failed';
        await this.db.updateMessageStatus(messageId, 'failed');
        await this.db.addToSyncQueue('send_message', 'messages', messageId, message);
      }
    } else {
      // Device is offline, add to sync queue
      await this.db.addToSyncQueue('send_message', 'messages', messageId, message);
    }

    return message;
  }

  // Handle incoming messages from Firebase
  async handleIncomingMessage(message: Message): Promise<void> {
    try {
      // Save to local database
      await this.db.saveMessage(message);
      
      // Show notification if from other user
      const currentUser = await getCurrentUserProfile();
      if (currentUser && message.senderId !== currentUser.id) {
        await NotificationService.showChatNotification(
          message.senderName,
          message.content,
          message.chatId,
          message.senderId
        );
      }
      
    } catch (error) {
      console.error('Error handling incoming message:', error);
    }
  }

  // Handle incoming chat updates from Firebase
  async handleIncomingChatUpdate(chat: Chat): Promise<void> {
    try {
      await this.db.saveChat(chat);
    } catch (error) {
      console.error('Error handling incoming chat update:', error);
    }
  }

  // Force sync (for manual refresh)
  async forcSync(): Promise<boolean> {
    if (!this.isOnline) {
      await NotificationService.showSystemNotification(
        'Sync Failed',
        'No internet connection available'
      );
      return false;
    }

    await this.syncPendingData();
    return true;
  }

  // Get sync queue count for UI indicators
  async getPendingSyncCount(): Promise<number> {
    const syncQueue = await this.db.getSyncQueue();
    return syncQueue.length;
  }

  // Clear all sync data (for reset/logout)
  async clearSyncData(): Promise<void> {
    await this.db.clearSyncQueue();
  }

  // Background sync (would be called from background task)
  async backgroundSync(): Promise<void> {
    if (this.isOnline && !this.syncInProgress) {
      console.log('Running background sync...');
      await this.syncPendingData();
    }
  }

  // Get detailed sync status for debugging
  async getSyncStatus(): Promise<{
    isOnline: boolean;
    isSyncing: boolean;
    pendingCount: number;
    lastSyncTime?: Date;
  }> {
    const pendingCount = await this.getPendingSyncCount();
    
    return {
      isOnline: this.isOnline,
      isSyncing: this.syncInProgress,
      pendingCount,
      // Could store last sync time in AsyncStorage
    };
  }
}

// Export singleton instance
export const syncService = SyncService.getInstance();