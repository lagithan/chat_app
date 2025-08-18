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
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FirestoreService, Message, Chat } from '@/services/firebase/firestore';
import TypingIndicator from '@/components/chat/TypingIndicator';

export default function ChatScreen() {
  const { id } = useLocalSearchParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [chatInfo, setChatInfo] = useState<Chat | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    loadUserData();
  }, []);

  useEffect(() => {
    if (currentUser && id) {
      loadChatInfo();
      
      // Set up real-time message listener
      const unsubscribeMessages = FirestoreService.subscribeToMessages(
        id as string,
        (newMessages) => {
          setMessages(newMessages);
          setLoading(false);
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

      return () => {
        unsubscribeMessages?.();
        unsubscribeTyping?.();
      };
    }
  }, [currentUser, id]);

  const loadUserData = async () => {
    try {
      const profile = await AsyncStorage.getItem('userProfile');
      if (profile) {
        setCurrentUser(JSON.parse(profile));
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const loadChatInfo = async () => {
    try {
      const userChats = await FirestoreService.getUserChats(currentUser.id);
      const chat = userChats.find((c) => c.id === id);
      setChatInfo(chat || null);
    } catch (error) {
      console.error('Error loading chat info:', error);
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim() || !currentUser || sending) return;

    const messageText = inputText.trim();
    setInputText('');
    setSending(true);

    try {
      await FirestoreService.sendMessage(
        id as string,
        currentUser.id,
        currentUser.name,
        messageText
      );
      
      // Stop typing indicator
      await FirestoreService.updateTypingStatus(id as string, currentUser.id, false);
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message');
      setInputText(messageText); // Restore the message
    } finally {
      setSending(false);
    }
  };

  const handleTyping = async (text: string) => {
    setInputText(text);
    
    if (text.length > 0 && !isTyping) {
      setIsTyping(true);
      await FirestoreService.updateTypingStatus(id as string, currentUser.id, true);
    }
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Set new timeout
    typingTimeoutRef.current = setTimeout(async () => {
      setIsTyping(false);
      await FirestoreService.updateTypingStatus(id as string, currentUser.id, false);
    }, 2000);
  };

  const leaveChat = () => {
    Alert.alert(
      'Leave Chat',
      'Are you sure you want to leave this chat? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              await FirestoreService.leaveChat(id as string, currentUser.id);
              router.back();
            } catch (error) {
              console.error('Error leaving chat:', error);
              Alert.alert('Error', 'Failed to leave chat');
            }
          }
        }
      ]
    );
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
          <Text style={[
            styles.messageTime,
            isMyMessage ? styles.myMessageTime : styles.otherMessageTime
          ]}>
            {formatTime(item.timestamp)}
          </Text>
        </View>
      </View>
    );
  };

  const getOtherParticipantName = () => {
    if (!chatInfo || !currentUser) return 'Chat';
    
    const otherParticipantId = chatInfo.participants.find(id => id !== currentUser.id);
    return otherParticipantId ? chatInfo.participantNames[otherParticipantId] || 'Chat' : 'Chat';
  };

  const showChatOptions = () => {
    Alert.alert(
      'Chat Options',
      'Choose an option',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Leave Chat', style: 'destructive', onPress: leaveChat }
      ]
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

  return (
    <SafeAreaView style={styles.container}>
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
              {otherUserTyping ? 'Typing...' : 'Online'}
            </Text>
          </View>
        </View>
        
        <TouchableOpacity style={styles.moreButton} onPress={showChatOptions}>
          <Ionicons name="ellipsis-vertical" size={20} color={Colors.primary} />
        </TouchableOpacity>
      </View>

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
  messageTime: {
    fontSize: 11,
    marginTop: 4,
  },
  myMessageTime: {
    color: Colors.textLight,
    opacity: 0.8,
  },
  otherMessageTime: {
    color: Colors.textSecondary,
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