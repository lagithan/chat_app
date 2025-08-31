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
import Toast from 'react-native-toast-message';

export default function ChatTab() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const db = DatabaseService.getInstance();
  const firstSubscriptionCall = useRef(true);
  const unsubscribeRef = useRef<(() => void) | null>(null);

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

  const setupRealtimeListener = () => {
    if (!userProfile) return;

    // Clean up existing listener
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }

    // Set up real-time listener
    unsubscribeRef.current = FirestoreService.subscribeToUserChats(
      userProfile.id,
      async (updatedChats) => {
        try {
          // Get current local chats
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

          let newMessages: any = [];
          setChats(prevChats => {
            if (!firstSubscriptionCall.current) {
              newMessages = computeNewMessages(prevChats, updatedChats);
            }

            // Filter out inactive chats and merge with updated data
            const activeChatMap = new Map();
            
            // Add updated active chats from Firestore
            updatedChats
              .filter(chat => chat.isActive !== false) // Only include active chats
              .forEach(chat => activeChatMap.set(chat.id, chat));

            // Convert back to array and sort by last activity
            const getSortTime = (chat: Chat) => {
              if (chat.lastMessage?.timestamp) {
                if (typeof chat.lastMessage.timestamp === 'string') {
                  return new Date(chat.lastMessage.timestamp);
                } else if (chat.lastMessage.timestamp.toDate) {
                  return chat.lastMessage.timestamp.toDate();
                } else {
                  return new Date(chat.lastMessage.timestamp);
                }
              }
              
              if (chat.createdAt) {
                if (typeof chat.createdAt === 'string') {
                  return new Date(chat.createdAt);
                } else if (chat.createdAt.toDate) {
                  return chat.createdAt.toDate();
                } else {
                  return new Date(chat.createdAt);
                }
              }
              
              return new Date(0);
            };
            
            const mergedChats = Array.from(activeChatMap.values()).sort((a, b) => 
              getSortTime(b).getTime() - getSortTime(a).getTime()
            );

            return mergedChats;
          });

          firstSubscriptionCall.current = false;

          // Show professional toast notifications for new incoming messages
          newMessages.forEach((msg: any) => {
            Toast.show({
              type: 'info',
              position: 'top',
              text1: `New message from ${msg.from}`,
              text2: msg.content.length > 50 ? msg.content.substring(0, 47) + '...' : msg.content,
              visibilityTime: 4000,
              autoHide: true,
              onPress: () => router.push(`/chat/${msg.chatId}`),
            });
          });

          setLoading(false);
        } catch (error) {
          console.error('Error in chat subscription:', error);
          setLoading(false);
        }
      },
      (error) => {
        console.error('Chat subscription error:', error);
        setLoading(false);
      }
    );
  };

  const computeNewMessages = (prevChats: Chat[], updatedChats: Chat[]) => {
    const newMsgs: any = [];
    updatedChats.forEach((u: any) => {
      const p = prevChats.find(c => c.id === u.id);
      const uTime = u.lastMessage ? new Date(u.lastMessage.timestamp) : null;
      const pTime = p?.lastMessage ? new Date(p.lastMessage.timestamp) : null;
      if (uTime && (!pTime || uTime > pTime) && u.lastMessage.senderId !== userProfile.id) {
        const otherId = u.participants.find((id: any) => id !== userProfile.id);
        const from = u.participantNames[otherId] || 'Unknown';
        newMsgs.push({
          chatId: u.id,
          from,
          content: u.lastMessage.content
        });
      }
    });
    return newMsgs;
  };

  const loadUserProfile = async () => {
    try {
      const profile = await AsyncStorage.getItem('userProfile');
      if (profile) {
        setUserProfile(JSON.parse(profile));
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const loadChats = async () => {
    if (!userProfile) return;

    try {
      // Load from local SQLite first
      const localChats = await db.getAllChats();
      
      // Filter out any inactive chats from local storage
      const activeLocalChats = localChats.filter(chat => chat.isActive !== false);
      
      if (activeLocalChats.length > 0) {
        setChats(activeLocalChats);
        setLoading(false);
      }

      // Then try to get fresh data from Firestore
      try {
        const firestoreChats = await FirestoreService.getUserChats(userProfile.id);
        const activeFirestoreChats = firestoreChats.filter(chat => chat.isActive !== false);
        
        // Update local database with fresh data
        for (const chat of activeFirestoreChats) {
          await db.saveChat(chat);
        }
        
        // Clean up any chats that no longer exist in Firestore
        const firestoreChatIds = new Set(activeFirestoreChats.map(chat => chat.id));
        const chatsToDelete = localChats.filter(localChat => !firestoreChatIds.has(localChat.id));
        
        for (const chatToDelete of chatsToDelete) {
          await db.deleteChat(chatToDelete.id);
        }
        
        setChats(activeFirestoreChats);
      } catch (firestoreError) {
        console.error('Firestore error, using local data:', firestoreError);
        // If Firestore fails, stick with local data
      }
    } catch (error) {
      console.error('Error loading chats:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    firstSubscriptionCall.current = true; // Reset to avoid toast notifications on refresh
    await loadChats();
    setRefreshing(false);
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return '';
    
    let date: Date;
    if (timestamp.toDate) {
      date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else {
      date = new Date(timestamp);
    }

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
        onPress={() => router.push(`/chat/${item.id}`)}
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