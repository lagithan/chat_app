// app/chat/[id].tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Vibration,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FirestoreService } from '@/services/firebase/firestore';
import { DatabaseService } from '@/services/database/sqlite';
import { NotificationService } from '@/services/notifications/push';
import TypingIndicator from '@/components/chat/TypingIndicator';
import { Message, Chat, User } from '@/types/chat';

export default function ChatScreen() {
  const { id } = useLocalSearchParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [chatInfo, setChatInfo] = useState<Chat | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const db = DatabaseService.getInstance();

  useEffect(() => {
    loadUserData();
    loadOfflineMessages();
  }, []);

  useEffect(() => {
    if (currentUser && id) {
      loadChatInfo();
      setupRealtimeListeners();
      markMessagesAsRead();
      
      return () => {
        cleanupListeners();
      };
    }
  }, [currentUser, id]);

  const loadUserData = async () => {
    try {
      const profile = await AsyncStorage.getItem('userProfile');
      if (profile) {
        const user = JSON.parse(profile);
        setCurrentUser(user);
        await db.updateUserLastSeen(user.id);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const loadOfflineMessages = async () => {
    try {
      if (id) {
        const offlineMessages = await db.getMessagesForChat(id as string);
        setMessages(offlineMessages);
        setLoading(false);
      }
    } catch (error) {
      console.error('Error loading offline messages:', error);
    }
  };

  const loadChatInfo = async () => {
    try {
      // Try loading from local database first
      let chat = await db.getChatById(id as string);
      
      if (!chat && currentUser) {
        // If not found locally, try Firebase
        const userChats = await FirestoreService.getUserChats(currentUser.id);
        chat = userChats.find((c) => c.id === id) || null;
        
        if (chat) {
          await db.saveChat(chat);
        }
      }
      
      setChatInfo(chat);
    } catch (error) {
      console.error('Error loading chat info:', error);
    }
  };

  const setupRealtimeListeners = () => {
    if (!currentUser || !id) return;

    try {
      // Set up real-time message listener
      const unsubscribeMessages = FirestoreService.subscribeToMessages(
        id as string,
        async (newMessages) => {
          setMessages(newMessages);
          setLoading(false);
          
          // Save messages to local database
          for (const message of newMessages) {
            await db.saveMessage(message);
            
            // Show notification if message is from other user and app is in background
            if (message.senderId !== currentUser.id) {
              await NotificationService.showChatNotification(
                message.senderName,
                message.content,
                message.chatId,
                message.senderId
              );
              
              // Vibrate for new messages
              Vibration.vibrate(100);
            }
          }
          
          // Scroll to bottom when new messages arrive
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 100);
        }
      );

      // Set up typing indicator listener
      const unsubscribeTyping = FirestoreService.subscribeToTyping(
        id as string,
        currentUser.id,
        (isTyping, userName) => {
          setOtherUserTyping(isTyping);
        }
      );

      // Store unsubscribe functions
      ChatScreen.unsubscribeMessages = unsubscribeMessages;
      ChatScreen.unsubscribeTyping = unsubscribeTyping;
    } catch (error) {
      console.error('Error setting up real-time listeners:', error);
      setIsConnected(false);
    }
  };

  const cleanupListeners = () => {
    if (ChatScreen.unsubscribeMessages) {
      ChatScreen.unsubscribeMessages();
    }
    if (ChatScreen.unsubscribeTyping) {
      ChatScreen.unsubscribeTyping();
    }
  };

  const markMessagesAsRead = async () => {
    if (!currentUser || !id) return;
    
    try {
      await db.markMessagesAsRead(id as string, currentUser.id);
      await NotificationService.clearChatNotifications(id as string);
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim() || !currentUser || sending) return;

    const messageText = inputText.trim();
    const tempId = `temp_${Date.now()}`;
    
    // Create temporary message for immediate UI update
    const tempMessage: Message = {
      id: tempId,
      chatId: id as string,
      senderId: currentUser.id,
      senderName: currentUser.name,
      content: messageText,
      timestamp: new Date(),
      type: 'text',
      status: 'sending'
    };

    setInputText('');
    setSending(true);
    setMessages(prev => [...prev, tempMessage]);

    try {
      // Send to Firebase
      await FirestoreService.sendMessage(
        id as string,
        currentUser.id,
        currentUser.name,
        messageText
      );
      
      // Update message status to sent
      setMessages(prev => 
        prev.map(msg => 
          msg.id === tempId 
            ? { ...msg, status: 'sent' as const }
            : msg
        )
      );
      
      // Stop typing indicator
      await FirestoreService.updateTypingStatus(id as string, currentUser.id, false);
      setIsTyping(false);
      
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Save to local database for later sync
      const offlineMessage: Message = {
        ...tempMessage,
        id: `offline_${Date.now()}`,
        status: 'failed'
      };
      
      await db.saveMessage(offlineMessage);
      await db.addToSyncQueue('send_message', 'messages', offlineMessage.id, offlineMessage);
      
      // Update UI to show failed status
      setMessages(prev => 
        prev.map(msg => 
          msg.id === tempId 
            ? { ...msg, status: 'failed' as const }
            : msg
        )
      );
      
      Alert.alert('Error', 'Failed to send message. It will be sent when you\'re back online.');
    } finally {
      setSending(false);
    }
  };

  const handleTyping = async (text: string) => {
    setInputText(text);
    
    if (text.length > 0 && !isTyping && currentUser) {
      setIsTyping(true);
      try {
        await FirestoreService.updateTypingStatus(id as string, currentUser.id, true);
      } catch (error) {
        console.error('Error updating typing status:', error);
      }
    }
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Set new timeout
    typingTimeoutRef.current = setTimeout(async () => {
      setIsTyping(false);
      if (currentUser) {
        try {
          await FirestoreService.updateTypingStatus(id as string, currentUser.id, false);
        } catch (error) {
          console.error('Error clearing typing status:', error);
        }
      }
    }, 2000);
  };

  const showChatOptions = () => {
    Alert.alert(
      'Chat Options',
      'Choose an option',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear Chat History', 
          onPress: clearChatHistory,
          style: 'destructive' 
        },
        { 
          text: 'Leave Chat', 
          style: 'destructive', 
          onPress: confirmLeaveChat 
        }
      ]
    );
  };

  const clearChatHistory = () => {
    Alert.alert(
      'Clear Chat History',
      'This will delete all messages in this chat. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              // Clear messages from local database
              await db.db.runSync('DELETE FROM messages WHERE chat_id = ?', [id]);
              setMessages([]);
              
              Alert.alert('Success', 'Chat history cleared');
            } catch (error) {
              console.error('Error clearing chat history:', error);
              Alert.alert('Error', 'Failed to clear chat history');
            }
          }
        }
      ]
    );
  };

  const confirmLeaveChat = () => {
    Alert.alert(
      'Leave Chat',
      'Are you sure you want to leave this chat? You will no longer receive messages from this conversation.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: leaveChat
        }
      ]
    );
  };

  const leaveChat = async () => {
    if (!currentUser) return;

    try {
      // Leave chat in Firebase
      await FirestoreService.leaveChat(id as string, currentUser.id);
      
      // Update local database
      await db.db.runSync(
        'UPDATE chats SET is_active = 0 WHERE id = ?',
        [id]
      );
      
      // Clear notifications for this chat
      await NotificationService.clearChatNotifications(id as string);
      
      // Navigate back
      router.back();
      
      Alert.alert('Success', 'You have left the chat');
    } catch (error) {
      console.error('Error leaving chat:', error);
      Alert.alert('Error', 'Failed to leave chat. Please try again.');
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMyMessage = item.senderId === currentUser?.id;
    
    const formatTime = (timestamp: any) => {
      let date: Date;
      if (timestamp?.toDate) {
        date = timestamp.toDate();
      } else if (timestamp instanceof Date) {
        date = timestamp;
      } else {
        date = new Date(timestamp);
      }
      
      return date.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    };

    const getStatusIcon = () => {
      switch (item.status) {
        case 'sending':
          return <ActivityIndicator size={12} color={Colors.textLight} />;
        case 'sent':
          return <Ionicons name="checkmark" size={12} color={Colors.textLight} />;
        case 'delivered':
          return <Ionicons name="checkmark-done" size={12} color={Colors.textLight} />;
        case 'read':
          return <Ionicons name="checkmark-done" size={12} color={Colors.success} />;
        case 'failed':
          return <Ionicons name="alert-circle" size={12} color={Colors.error} />;
        default:
          return null;
      }
    };
    
    return (
      <View style={[
        styles.messageContainer,
        isMyMessage ? styles.myMessageContainer : styles.otherMessageContainer
      ]}>
        <View style={[
          styles.messageBubble,
          isMyMessage ? styles.myMessageBubble : styles.otherMessageBubble
        ]}>
          <Text style={[
            styles.messageText,
            isMyMessage ? styles.myMessageText : styles.otherMessageText
          ]}>
            {item.content}
          </Text>
          <View style={styles.messageFooter}>
            <Text style={[
              styles.messageTime,
              isMyMessage ? styles.myMessageTime : styles.otherMessageTime
            ]}>
              {formatTime(item.timestamp)}
            </Text>
            {isMyMessage && (
              <View style={styles.messageStatus}>
                {getStatusIcon()}
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  const getOtherParticipantName = () => {
    if (!chatInfo || !currentUser) return 'Chat';
    
    const otherParticipantId = chatInfo.participants.find(id => id !== currentUser.id);
    return otherParticipantId ? chatInfo.participantNames[otherParticipantId] || 'Chat' : 'Chat';
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading chat...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        
        <View style={styles.headerInfo}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {getOtherParticipantName().charAt(0).toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={styles.headerName}>{getOtherParticipantName()}</Text>
            <Text style={styles.headerStatus}>
              {otherUserTyping ? 'Typing...' : isConnected ? 'Online' : 'Offline'}
            </Text>
          </View>
        </View>
        
        <TouchableOpacity style={styles.moreButton} onPress={showChatOptions}>
          <Ionicons name="ellipsis-vertical" size={20} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Connection status */}
      {!isConnected && (
        <View style={styles.offlineIndicator}>
          <Ionicons name="cloud-offline" size={16} color={Colors.textLight} />
          <Text style={styles.offlineText}>Messages will sync when back online</Text>
        </View>
      )}

      <KeyboardAvoidingView 
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={90}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          style={styles.messagesList}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />
        
        {otherUserTyping && (
          <TypingIndicator visible={true} userName={getOtherParticipantName()} />
        )}
        
        {/* Input Container */}
        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.textInput}
              value={inputText}
              onChangeText={handleTyping}
              placeholder="Type a message..."
              placeholderTextColor={Colors.textSecondary}
              multiline
              maxLength={1000}
              editable={!sending}
            />
            <TouchableOpacity 
              style={[
                styles.sendButton,
                (inputText.trim() && !sending) ? styles.sendButtonActive : styles.sendButtonInactive
              ]}
              onPress={sendMessage}
              disabled={!inputText.trim() || sending}
            >
              {sending ? (
                <ActivityIndicator size={16} color={Colors.textLight} />
              ) : (
                <Ionicons 
                  name="send" 
                  size={20} 
                  color={(inputText.trim() && !sending) ? Colors.textLight : Colors.textSecondary} 
                />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Add static properties to store unsubscribe functions
ChatScreen.unsubscribeMessages = null;
ChatScreen.unsubscribeTyping = null;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.background,
  },
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  headerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: Colors.textLight,
    fontSize: 16,
    fontWeight: 'bold',
  },
  headerName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  headerStatus: {
    fontSize: 12,
    color: Colors.success,
  },
  moreButton: {
    padding: 8,
  },
  offlineIndicator: {
    backgroundColor: Colors.warning,
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  offlineText: {
    color: Colors.textLight,
    fontSize: 12,
    marginLeft: 4,
  },
  content: {
    flex: 1,
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    paddingVertical: 16,
  },
  messageContainer: {
    marginVertical: 2,
    paddingHorizontal: 16,
  },
  myMessageContainer: {
    alignItems: 'flex-end',
  },
  otherMessageContainer: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  myMessageBubble: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  otherMessageBubble: {
    backgroundColor: Colors.otherMessage,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  myMessageText: {
    color: Colors.textLight,
  },
  otherMessageText: {
    color: Colors.text,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  messageTime: {
    fontSize: 11,
  },
  myMessageTime: {
    color: Colors.textLight,
    opacity: 0.8,
  },
  otherMessageTime: {
    color: Colors.textSecondary,
  },
  messageStatus: {
    marginLeft: 4,
  },
  inputContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: Colors.surface,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
    maxHeight: 100,
    paddingVertical: 8,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButtonActive: {
    backgroundColor: Colors.primary,
  },
  sendButtonInactive: {
    backgroundColor: Colors.border,
  },
});