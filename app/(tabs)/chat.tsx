// app/(tabs)/chat.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FirestoreService, Chat } from '@/services/firebase/firestore';
import { DatabaseService } from '@/services/database/sqlite';
import { useNotifications } from '@/hooks/useNotifications';
import { MessageNotification } from '@/services/notifications/NotificationService';

export default function ChatTab() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const db = DatabaseService.getInstance();
  const unsubscribeRef = useRef<(() => void) | null>(null);
  
  // Use the notifications hook
  const { showBatchMessageNotifications, notificationService } = useNotifications();

  useEffect(() => {
    loadUserProfile();
  }, []);

  // Clean up subscription on unmount
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      if (userProfile) {
        loadChats();
        setupRealtimeListener();
      }
      
      // Cleanup function for when screen loses focus
      return () => {
        if (unsubscribeRef.current) {
          unsubscribeRef.current();
          unsubscribeRef.current = null;
        }
      };
    }, [userProfile])
  );

  // Helper function to convert various timestamp formats to Date
  const convertToDate = (timestamp: any): Date => {
    if (!timestamp) return new Date(0);
    
    try {
      // Firestore Timestamp
      if (timestamp && typeof timestamp === 'object' && timestamp.toDate) {
        return timestamp.toDate();
      }
      // Already a Date object
      if (timestamp instanceof Date) {
        return timestamp;
      }
      // String timestamp
      if (typeof timestamp === 'string') {
        return new Date(timestamp);
      }
      // Number timestamp
      if (typeof timestamp === 'number') {
        return new Date(timestamp);
      }
      
      return new Date(0);
    } catch (error) {
      console.error('ChatTab: Error converting timestamp:', error);
      return new Date(0);
    }
  };

  const setupRealtimeListener = () => {
    if (!userProfile) return;

    console.log('ChatTab: Setting up realtime listener for user:', userProfile.id);

    // Clean up existing listener
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }

    // Set up real-time listener
    unsubscribeRef.current = FirestoreService.subscribeToUserChats(
      userProfile.id,
      async (updatedChats) => {
        try {
          console.log('ChatTab: Received', updatedChats.length, 'updated chats');

          // Get current local chats for comparison
          const localChats = await db.getAllChats();
          
          // Find chats that were deleted (exist locally but not in Firestore)
          const firestoreChatIds = new Set(updatedChats.map(chat => chat.id));
          const deletedChats = localChats.filter(localChat => !firestoreChatIds.has(localChat.id));
          
          // Delete removed chats from local database
          for (const deletedChat of deletedChats) {
            await db.deleteChat(deletedChat.id);
          }

          // Save/update existing chats to SQLite
          for (const chat of updatedChats) {
            await db.saveChat(chat);
          }

          // Check for new messages BEFORE updating state
          const newMessageNotifications = checkForNewMessages(updatedChats);

          // Update state
          setChats(prevChats => {
            // Filter out inactive chats and merge with updated data
            const activeChatMap = new Map();
            
            // Add updated active chats from Firestore
            updatedChats
              .filter(chat => chat.isActive !== false)
              .forEach(chat => activeChatMap.set(chat.id, chat));

            // Convert back to array and sort by last activity
            const getSortTime = (chat: Chat) => {
              if (chat.lastMessage?.timestamp) {
                return convertToDate(chat.lastMessage.timestamp);
              }
              
              if (chat.createdAt) {
                return convertToDate(chat.createdAt);
              }
              
              return new Date(0);
            };
            
            const mergedChats = Array.from(activeChatMap.values()).sort((a, b) => 
              getSortTime(b).getTime() - getSortTime(a).getTime()
            );

            return mergedChats;
          });

          // Show notifications for new messages (after state update)
          if (newMessageNotifications.length > 0) {
            console.log('ChatTab: Showing', newMessageNotifications.length, 'notifications');
            // Small delay to ensure context is updated
            setTimeout(() => {
              showBatchMessageNotifications(newMessageNotifications);
            }, 100);
          }

          setLoading(false);
        } catch (error) {
          console.error('ChatTab: Error in chat subscription:', error);
          setLoading(false);
        }
      },
      (error) => {
        console.error('ChatTab: Chat subscription error:', error);
        setLoading(false);
      }
    );
  };

  const checkForNewMessages = (updatedChats: Chat[]): MessageNotification[] => {
    const notifications: MessageNotification[] = [];
    
    console.log('ChatTab: Checking for new messages in', updatedChats.length, 'chats');
    
    updatedChats.forEach((chat) => {
      // Skip if no last message
      if (!chat.lastMessage) {
        console.log('ChatTab: No last message in chat', chat.id);
        return;
      }

      // Skip if message is from current user
      if (chat.lastMessage.senderId === userProfile.id) {
        console.log('ChatTab: Message from current user in chat', chat.id, ', skipping');
        return;
      }

      // Skip if user is currently in this chat
      if (!notificationService.shouldShowNotification(chat.id)) {
        console.log('ChatTab: User is in chat', chat.id, ', skipping notification');
        return;
      }

      const messageTime = convertToDate(chat.lastMessage.timestamp);
      const messageTimestamp = messageTime.getTime();

      // Check if this is a new message using the notification service
      if (notificationService.isNewMessage(chat.id, messageTimestamp)) {
        console.log('ChatTab: New message detected in chat', chat.id, 'from', chat.lastMessage.senderId);
        
        const otherParticipantId = chat.participants.find((id: any) => id !== userProfile.id);
        const senderName = chat.participantNames[otherParticipantId] || 'Unknown';
        
        notifications.push({
          chatId: chat.id,
          senderName,
          content: chat.lastMessage.content,
          timestamp: messageTime,
          senderId: chat.lastMessage.senderId,
        });
      } else {
        console.log('ChatTab: Message in chat', chat.id, 'is not new or already processed');
      }
    });
    
    console.log('ChatTab: Found', notifications.length, 'new message notifications');
    return notifications;
  };

  const loadUserProfile = async () => {
    try {
      const profile = await AsyncStorage.getItem('userProfile');
      if (profile) {
        const parsedProfile = JSON.parse(profile);
        console.log('ChatTab: Loaded user profile:', parsedProfile.id);
        setUserProfile(parsedProfile);
      }
    } catch (error) {
      console.error('ChatTab: Error loading profile:', error);
    }
  };

  const loadChats = async () => {
    if (!userProfile) return;

    try {
      console.log('ChatTab: Loading chats for user:', userProfile.id);

      // Load from local SQLite first
      const localChats = await db.getAllChats();
      const activeLocalChats = localChats.filter(chat => chat.isActive !== false);
      
      if (activeLocalChats.length > 0) {
        console.log('ChatTab: Loaded', activeLocalChats.length, 'chats from local DB');
        setChats(activeLocalChats);
        
        // Initialize notification service with existing last message times
        activeLocalChats.forEach(chat => {
          if (chat.lastMessage?.timestamp) {
            const messageTime = convertToDate(chat.lastMessage.timestamp);
            notificationService.updateLastMessageTime(chat.id, messageTime.getTime());
          }
        });
        
        setLoading(false);
      }

      // Then try to get fresh data from Firestore
      try {
        const firestoreChats = await FirestoreService.getUserChats(userProfile.id);
        const activeFirestoreChats = firestoreChats.filter(chat => chat.isActive !== false);
        
        console.log('ChatTab: Loaded', activeFirestoreChats.length, 'chats from Firestore');
        
        // Update local database with fresh data
        for (const chat of activeFirestoreChats) {
          await db.saveChat(chat);
        }
        
        // Update notification service with current last message times
        activeFirestoreChats.forEach(chat => {
          if (chat.lastMessage?.timestamp) {
            const messageTime = convertToDate(chat.lastMessage.timestamp);
            notificationService.updateLastMessageTime(chat.id, messageTime.getTime());
          }
        });
        
        // Clean up any chats that no longer exist in Firestore
        const firestoreChatIds = new Set(activeFirestoreChats.map(chat => chat.id));
        const chatsToDelete = localChats.filter(localChat => !firestoreChatIds.has(localChat.id));
        
        for (const chatToDelete of chatsToDelete) {
          await db.deleteChat(chatToDelete.id);
        }
        
        setChats(activeFirestoreChats);
      } catch (firestoreError) {
        console.error('ChatTab: Firestore error, using local data:', firestoreError);
      }
    } catch (error) {
      console.error('ChatTab: Error loading chats:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    // Reset notification state to ensure fresh detection
    notificationService.resetNotificationState();
    await loadChats();
    setRefreshing(false);
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return '';
    
    const date = convertToDate(timestamp);

    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const getOtherParticipantName = (chat: Chat) => {
    if (!userProfile) return 'Unknown';
    
    const otherParticipantId = chat.participants.find(id => id !== userProfile.id);
    return otherParticipantId ? chat.participantNames[otherParticipantId] || 'Unknown' : 'Unknown';
  };

  const renderChatItem = ({ item }: { item: Chat }) => {
    const otherName = getOtherParticipantName(item);

    return (
      <TouchableOpacity
        style={styles.chatItem}
        onPress={() => {
          console.log('ChatTab: Navigating to chat:', item.id);
          router.push(`/chat/${item.id}`);
        }}
      >
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {otherName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={[styles.onlineIndicator, { backgroundColor: Colors.success }]} />
        </View>

        <View style={styles.chatContent}>
          <View style={styles.chatHeader}>
            <Text style={styles.chatName}>{otherName}</Text>
            <Text style={styles.chatTime}>
              {item.lastMessage ? formatTime(item.lastMessage.timestamp) : formatTime(item.createdAt)}
            </Text>
          </View>
          
          <View style={styles.chatFooter}>
            <Text style={styles.lastMessage} numberOfLines={1}>
              {item.lastMessage?.content || 'No messages yet'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Chats</Text>
        {/* Debug button - remove in production */}
        <TouchableOpacity 
          onPress={() => {
            console.log('ChatTab: Manual notification reset');
            notificationService.resetNotificationState();
          }}
          style={{ padding: 8 }}
        >
          <Text style={{ color: Colors.primary, fontSize: 12 }}>Reset</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading chats...</Text>
        </View>
      ) : chats.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubbles-outline" size={80} color={Colors.textSecondary} />
          <Text style={styles.emptyText}>No chats yet</Text>
          <Text style={styles.emptySubtext}>Scan a QR code to start chatting</Text>
        </View>
      ) : (
        <FlatList
          data={chats}
          renderItem={renderChatItem}
          keyExtractor={(item) => item.id}
          style={styles.chatList}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[Colors.primary]}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
  },
  notificationButton: {
    padding: 8,
  },
  chatList: {
    flex: 1,
  },
  chatItem: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.background,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: Colors.textLight,
    fontSize: 18,
    fontWeight: 'bold',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.background,
  },
  chatContent: {
    flex: 1,
    justifyContent: 'center',
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chatName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  chatTime: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  chatFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessage: {
    fontSize: 14,
    color: Colors.textSecondary,
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: 16,
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
});