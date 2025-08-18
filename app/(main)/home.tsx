import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { v4 as uuidv4 } from 'uuid';
import AuthService from '../../services/AuthService';
import DatabaseService, { User, Contact } from '../../services/DatabaseService';
import SocketService from '../../services/SocketService';

export default function Home() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [recentChats, setRecentChats] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    initializeHome();
  }, []);

  const initializeHome = async () => {
    try {
      const user = await AuthService.getCurrentUser();
      setCurrentUser(user);
      
      if (user) {
        await loadRecentChats(user.userId);
        await connectToServer();
      }
    } catch (error) {
      console.error('Error initializing home:', error);
    }
  };

  const loadRecentChats = async (userId: string) => {
    try {
      setLoading(true);
      const contacts = await DatabaseService.getUserContacts(userId);
      setRecentChats(contacts);
    } catch (error) {
      console.error('Error loading recent chats:', error);
    } finally {
      setLoading(false);
    }
  };

  const connectToServer = async () => {
    try {
      if (currentUser) {
        SocketService.connect(currentUser.userId, currentUser.fullName || currentUser.username);
      }
    } catch (error) {
      console.log('Server connection failed (offline mode)');
    }
  };

  const createNewSession = () => {
    if (!currentUser) return;
    
    const sessionId = uuidv4();
    
    router.push({
      pathname: '/(main)/qr-generator/[sessionId]',
      params: {
        sessionId,
        userId: currentUser.userId,
        userName: currentUser.fullName || currentUser.username,
        serverUrl: 'ws://localhost:3001',
      }
    });
  };

  const joinSession = () => {
    router.push('/(main)/qr-scanner');
  };

  const openChat = async (contact: Contact) => {
    if (!currentUser) return;
    
    const sessionId = `${currentUser.userId}_${contact.contactUserId}`;
    
    try {
      // Create session in the database
      await DatabaseService.createSession({
        id:sessionId,
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
        }
      });
    } catch (error) {
      console.error('Error creating chat session:', error);
      Alert.alert('Error', 'Failed to open chat. Please try again.');
    }
  };

  const onRefresh = () => {
    if (currentUser) {
      loadRecentChats(currentUser.userId);
    }
  };

  if (!currentUser) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <View style={styles.avatar}>
            <MaterialIcons name="person" size={30} color="#007AFF" />
          </View>
          <View style={styles.userText}>
            <Text style={styles.welcomeText}>Welcome back,</Text>
            <Text style={styles.userName}>{currentUser.fullName || currentUser.username}</Text>
          </View>
        </View>
      </View>

      <View style={styles.quickActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.primaryAction]}
          onPress={createNewSession}
        >
          <MaterialIcons name="qr-code" size={30} color="white" />
          <Text style={styles.actionButtonText}>Create New Chat</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.secondaryAction]}
          onPress={joinSession}
        >
          <MaterialIcons name="qr-code-scanner" size={30} color="#007AFF" />
          <Text style={[styles.actionButtonText, styles.secondaryActionText]}>
            Join Chat
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.recentChatsSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Chats</Text>
          <TouchableOpacity onPress={() => router.push('/(main)/chat-history')}>
            <Text style={styles.viewAllText}>View All</Text>
          </TouchableOpacity>
        </View>

        {recentChats.length > 0 ? (
          recentChats.slice(0, 5).map((contact, index) => (
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
                    : ''
                  }
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
            <MaterialIcons name="chat" size={50} color="#ccc" />
            <Text style={styles.emptyText}>No recent chats</Text>
            <Text style={styles.emptySubtext}>
              Create a new chat or scan a QR code to get started
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 50,
    height: 50,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  userText: {
    flex: 1,
  },
  welcomeText: {
    fontSize: 14,
    color: '#666',
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  quickActions: {
    flexDirection: 'row',
    padding: 20,
    gap: 15,
  },
  actionButton: {
    flex: 1,
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
  },
  primaryAction: {
    backgroundColor: '#007AFF',
  },
  secondaryAction: {
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  actionButtonText: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
  },
  secondaryActionText: {
    color: '#007AFF',
  },
  recentChatsSection: {
    backgroundColor: 'white',
    margin: 20,
    borderRadius: 15,
    padding: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  viewAllText: {
    fontSize: 16,
    color: '#007AFF',
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
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