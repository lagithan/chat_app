 import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import AuthService from '../../services/AuthService';
import DatabaseService, { Contact } from '../../services/DatabaseService';

export default function ChatHistory() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [chats, setChats] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadChatHistory();
  }, []);

  const loadChatHistory = async () => {
    setLoading(true);
    try {
      const user = await AuthService.getCurrentUser();
      if (user) {
        setCurrentUser(user);
        const contacts = await DatabaseService.getUserContacts(user.userId);
        setChats(contacts);
      } else {
        router.replace('/(auth)/login');
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
      Alert.alert('Error', 'Failed to load chat history. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadChatHistory();
    setRefreshing(false);
  };

  const openChat = async (contact: Contact) => {
    if (!currentUser) return;
    
    const sessionId = `${currentUser.userId}_${contact.contactUserId}`;
    
    try {
      // Ensure the session exists in the database
      await DatabaseService.createSession({
        id: sessionId,
        creatorId: currentUser.userId,
        creatorName: currentUser.fullName || currentUser.username,
        participantId: contact.contactUserId,
        participantName: contact.contactName,
        sessionName: `Chat with ${contact.contactName}`,
      });

      router.push({
        pathname: '/(main)/chat/[sessionId]',
        params: {
          sessionId,
          userId: currentUser.userId,
          userName: currentUser.fullName || currentUser.username,
          contactId: contact.contactUserId,
          contactName: contact.contactName,
        },
      });
    } catch (error) {
      console.error('Error opening chat:', error);
      Alert.alert('Error', 'Failed to open chat. Please try again.');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.fullContainer}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chat History</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {chats.length > 0 ? (
          chats.map((contact, index) => (
            <TouchableOpacity
              key={index}
              style={styles.chatItem}
              onPress={() => openChat(contact)}
            >
              <View style={styles.chatAvatar}>
                <MaterialIcons name="person" size={24} color="#007AFF" />
              </View>
              <View style={styles.chatInfo}>
                <Text style={styles.chatName}>{contact.contactName}</Text>
                <Text style={styles.lastMessage} numberOfLines={1}>
                  {contact.lastMessage || 'No messages yet'}
                </Text>
              </View>
              <View style={styles.chatMeta}>
                <Text style={styles.chatTime}>
                  {contact.lastMessageTime
                    ? new Date(contact.lastMessageTime).toLocaleDateString()
                    : ''}
                </Text>
                {contact.unreadCount > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadText}>{contact.unreadCount}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyState}>
            <MaterialIcons name="chat-bubble-outline" size={50} color="#ccc" />
            <Text style={styles.emptyText}>No chat history</Text>
            <Text style={styles.emptySubtext}>
              Start a new chat to see it appear here.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fullContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  container: {
    flex: 1,
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  backButton: {
    width: 40,
  },
  headerSpacer: {
    width: 40,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: 'white',
    borderRadius: 15,
    marginBottom: 10,
    padding: 15,
  },
  chatAvatar: {
    width: 40,
    height: 40,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  chatInfo: {
    flex: 1,
  },
  chatName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  lastMessage: {
    fontSize: 14,
    color: '#666',
  },
  chatMeta: {
    alignItems: 'flex-end',
  },
  chatTime: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  unreadBadge: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  unreadText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#999',
    marginTop: 15,
    marginBottom: 5,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#ccc',
    textAlign: 'center',
    lineHeight: 20,
  },
});
