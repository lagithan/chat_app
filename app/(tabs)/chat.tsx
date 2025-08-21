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

  useEffect(() => {
    loadUserProfile();
    loadChats();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      if (userProfile) {
        loadChats();
        // Set up real-time listener
        const unsubscribe = FirestoreService.subscribeToUserChats(
          userProfile.id,
          async (updatedChats) => {
            // Save each chat to SQLite
            for (const chat of updatedChats) {
              await db.saveChat(chat);
            }

            let newMessages:any = [];
            setChats(prevChats => {
              if (!firstSubscriptionCall.current) {
                newMessages = computeNewMessages(prevChats, updatedChats);
              }

              // Simple merge: combine and deduplicate by chat ID
              const chatMap = new Map();
              // Add existing chats to map
              prevChats.forEach(chat => chatMap.set(chat.id, chat));
              // Add/update with new chats (this will overwrite existing ones if they exist)
              updatedChats.forEach(chat => chatMap.set(chat.id, chat));

              // Convert back to array and sort by last activity
              const getSortTime = (chat: Chat) => chat.lastMessage?.timestamp || chat.createdAt;
              const mergedChats = Array.from(chatMap.values()).sort((a, b) => new Date(getSortTime(b)).getTime() - new Date(getSortTime(a)).getTime());

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
          }
        );

        return () => unsubscribe?.();
      }
    }, [userProfile])
  );

  const computeNewMessages = (prevChats: Chat[], updatedChats: Chat[]) => {
    const newMsgs:any = [];
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
      // First try to load from local SQLite
      const localChats = await db.getAllChats();
      if (localChats.length > 0) {
        setChats(localChats);
        setLoading(false);
      }
    } catch (error) {
      console.error('Error loading chats:', error);
      // If Firebase fails, at least show local chats
      const localChats = await db.getAllChats();
      setChats(localChats);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
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
            {/* You can add unread count here if needed */}
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