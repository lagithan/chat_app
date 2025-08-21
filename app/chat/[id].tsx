// app/chat/[id].tsx
import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { DatabaseService } from "@/services/database/sqlite";
import { FirestoreService, Chat, Message } from "@/services/firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Colors } from '@/constants/Colors';

export default function ChatPage() {
  const { id } = useLocalSearchParams();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [chatInfo, setChatInfo] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [otherUserTypingName, setOtherUserTypingName] = useState('');
  
  const db = DatabaseService.getInstance();
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    loadUserProfile();
  }, []);

  // Load chat info when userProfile and id are available
  useEffect(() => {
    if (userProfile && id) {
      loadChatInfo();
    }
  }, [userProfile, id]);

  // Set up real-time listeners when chat info is loaded
  useEffect(() => {
    if (chatInfo && userProfile) {
      loadMessages();
      
      // Set up real-time message listener
      const unsubscribeMessages = FirestoreService.subscribeToMessages(
        chatInfo.id,
        (updatedMessages) => {
          // Save messages to local database
          updatedMessages.forEach(async (message) => {
            try {
              await db.sendMessage(
                message.chatId,
                message.senderId,
                message.senderName,
                message.content
              );
            } catch (error) {
              console.error('Error saving message locally:', error);
            }
          });
          setMessages(updatedMessages);
        },
        (error) => {
          console.error('Message subscription error:', error);
        }
      );

      // Set up typing indicator listener
      const unsubscribeTyping = FirestoreService.subscribeToTyping(
        chatInfo.id,
        userProfile.id,
        (typing, userName) => {
          setOtherUserTyping(typing);
          setOtherUserTypingName(userName || '');
        }
      );

      return () => {
        unsubscribeMessages?.();
        unsubscribeTyping?.();
      };
    }
  }, [chatInfo, userProfile]);

  const loadUserProfile = async () => {
    try {
      const profile = await AsyncStorage.getItem('userProfile');
      if (profile) {
        setUserProfile(JSON.parse(profile));
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadChatInfo = async () => {
    if (!userProfile || !id) return;
    
    try {
      // Try loading from local database first
      let chat = await db.getChatById(id as string);
          
      if (!chat) {
        // If not found locally, try Firebase
        const userChats = await FirestoreService.getUserChats(userProfile.id);
        chat = userChats.find((c) => c.id === id) || null;
              
        if (chat) {
          // Save the complete chat object with all required fields
          const chatToSave = {
            id: chat.id,
            participants: chat.participants,
            participantNames: chat.participantNames,
            createdAt: chat.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
            updatedAt: chat.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
            lastMessage: chat.lastMessage ? {
              ...chat.lastMessage,
              timestamp: chat.lastMessage.timestamp?.toDate?.()?.toISOString() || new Date().toISOString()
            } : undefined,
            isActive: chat.isActive !== undefined ? chat.isActive : true
          };
          await db.saveChat(chatToSave);
          chat = chatToSave;
        }
      }
          
      setChatInfo(chat);
    } catch (error) {
      console.error('Error loading chat info:', error);
    }
  };

  const loadMessages = async () => {
    if (!chatInfo) return;

    try {
      // First load from local database
      const localMessages = await db.getMessagesForChat(chatInfo.id);
      if (localMessages.length > 0) {
        setMessages(localMessages);
      }
    } catch (error) {
      console.error('Error loading local messages:', error);
    }
  };

  const sendMessage = async () => {
    if (!messageText.trim() || !chatInfo || !userProfile || sending) return;

    const content = messageText.trim();
    setMessageText('');
    setSending(true);

    try {
      // Send to Firebase first
      await FirestoreService.sendMessage(
        chatInfo.id,
        userProfile.id,
        userProfile.name || userProfile.displayName || 'Unknown',
        content
      );

      // Also save locally as backup
      await db.sendMessage(
        chatInfo.id,
        userProfile.id,
        userProfile.name || userProfile.displayName || 'Unknown',
        content
      );

      // Stop typing indicator
      if (isTyping) {
        await FirestoreService.updateTypingStatus(chatInfo.id, userProfile.id, false);
        setIsTyping(false);
      }

    } catch (error) {
      console.error('Error sending message:', error);
      
      // If Firebase fails, save locally only
      try {
        await db.sendMessage(
          chatInfo.id,
          userProfile.id,
          userProfile.name || userProfile.displayName || 'Unknown',
          content
        );
        Alert.alert('Message saved locally', 'Will sync when connection is restored');
      } catch (localError) {
        console.error('Error saving message locally:', localError);
        Alert.alert('Error', 'Failed to send message');
      }
    } finally {
      setSending(false);
    }
  };

  const handleTyping = useCallback(async (text: string) => {
    setMessageText(text);

    if (!chatInfo || !userProfile) return;

    const isCurrentlyTyping = text.length > 0;

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Update typing status if it changed
    if (isCurrentlyTyping !== isTyping) {
      setIsTyping(isCurrentlyTyping);
      try {
        await FirestoreService.updateTypingStatus(chatInfo.id, userProfile.id, isCurrentlyTyping);
      } catch (error) {
        console.error('Error updating typing status:', error);
      }
    }

    // Set timeout to stop typing indicator
    if (isCurrentlyTyping) {
      typingTimeoutRef.current = setTimeout(async () => {
        setIsTyping(false);
        try {
          await FirestoreService.updateTypingStatus(chatInfo.id, userProfile.id, false);
        } catch (error) {
          console.error('Error stopping typing status:', error);
        }
      }, 2000);
    }
  }, [chatInfo, userProfile, isTyping]);

  const getOtherParticipantName = () => {
    if (!chatInfo || !userProfile) return 'Unknown';
    
    const otherParticipantId = chatInfo.participants.find(id => id !== userProfile.id);
    return otherParticipantId ? chatInfo.participantNames[otherParticipantId] || 'Unknown' : 'Unknown';
  };

  const formatMessageTime = (timestamp: any) => {
    if (!timestamp) return '';
    
    let date: Date;
    if (typeof timestamp === 'string') {
      date = new Date(timestamp);
    } else if (timestamp.toDate) {
      date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else {
      date = new Date(timestamp);
    }

    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isOwn = item.senderId === userProfile?.id;
    
    return (
      <View style={[styles.messageContainer, isOwn ? styles.ownMessage : styles.otherMessage]}>
        <View style={[styles.messageBubble, isOwn ? styles.ownBubble : styles.otherBubble]}>
          <Text style={[styles.messageText, isOwn ? styles.ownMessageText : styles.otherMessageText]}>
            {item.content}
          </Text>
          <Text style={[styles.messageTime, isOwn ? styles.ownMessageTime : styles.otherMessageTime]}>
            {formatMessageTime(item.timestamp)}
          </Text>
        </View>
      </View>
    );
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

  if (!chatInfo) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Chat not found</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backIcon} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.title}>{getOtherParticipantName()}</Text>
          {otherUserTyping && (
            <Text style={styles.typingIndicator}>
              {otherUserTypingName} is typing...
            </Text>
          )}
        </View>
      </View>

      <KeyboardAvoidingView 
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          style={styles.messagesList}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
        />

        {/* Input Area */}
        <View style={styles.inputContainer}>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.textInput}
              value={messageText}
              onChangeText={handleTyping}
              placeholder="Type your message here ..."
              placeholderTextColor={Colors.textSecondary}
              multiline
              maxLength={1000}
            />
            <TouchableOpacity
              style={[styles.sendButton, (!messageText.trim() || sending) && styles.sendButtonDisabled]}
              onPress={sendMessage}
              disabled={!messageText.trim() || sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <Ionicons name="send" size={20} color={Colors.primary} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
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
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  backIcon: {
    marginRight: 16,
  },
  headerContent: {
    flex: 1,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.text,
  },
  typingIndicator: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  keyboardContainer: {
    flex: 1,
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  messageContainer: {
    marginBottom: 8,
    maxWidth: '80%',
  },
  ownMessage: {
    alignSelf: 'flex-end',
  },
  otherMessage: {
    alignSelf: 'flex-start',
  },
  messageBubble: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  ownBubble: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: '#E5E5EA',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  ownMessageText: {
    color: '#FFFFFF',
  },
  otherMessageText: {
    color: '#000000',
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
  },
  ownMessageTime: {
    color: '#FFFFFF',
    opacity: 0.8,
  },
  otherMessageTime: {
    color: Colors.textSecondary,
  },
  inputContainer: {
    backgroundColor: Colors.background,
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 22,
    paddingHorizontal: 8,
  },
  textInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.text,
    backgroundColor: 'transparent',
    maxHeight: 100,
  },
  sendButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  sendButtonDisabled: {
    opacity: 0.5,
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorText: {
    fontSize: 18,
    color: Colors.textSecondary,
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: Colors.textLight,
    fontSize: 16,
    fontWeight: '600',
  },
});