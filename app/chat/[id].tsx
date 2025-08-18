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
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TypingIndicator from '@/components/chat/TypingIndicator';

export default function ChatScreen() {
  const { id } = useLocalSearchParams();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [chatInfo, setChatInfo] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    loadChatData();
    loadMessages();
  }, []);

  const loadChatData = async () => {
    try {
      const profile = await AsyncStorage.getItem('userProfile');
      if (profile) {
        setCurrentUser(JSON.parse(profile));
      }

      const chats = await AsyncStorage.getItem('chats');
      if (chats) {
        const chatList = JSON.parse(chats);
        const chat = chatList.find((c: any) => c.id === id);
        setChatInfo(chat);
      }
    } catch (error) {
      console.error('Error loading chat data:', error);
    }
  };

  const loadMessages = async () => {
    try {
      const savedMessages = await AsyncStorage.getItem(`messages_${id}`);
      if (savedMessages) {
        setMessages(JSON.parse(savedMessages));
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const saveMessage = async (newMessage: any) => {
    try {
      const updatedMessages = [...messages, newMessage];
      setMessages(updatedMessages);
      await AsyncStorage.setItem(`messages_${id}`, JSON.stringify(updatedMessages));
      
      // Update last message in chat list
      const chats = await AsyncStorage.getItem('chats');
      if (chats) {
        const chatList = JSON.parse(chats);
        const chatIndex = chatList.findIndex((c: any) => c.id === id);
        if (chatIndex !== -1) {
          chatList[chatIndex].lastMessage = newMessage;
          chatList[chatIndex].updatedAt = new Date().toISOString();
          await AsyncStorage.setItem('chats', JSON.stringify(chatList));
        }
      }
    } catch (error) {
      console.error('Error saving message:', error);
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim() || !currentUser) return;

    const newMessage = {
      id: `msg_${Date.now()}`,
      chatId: id,
      senderId: currentUser.id,
      senderName: currentUser.name,
      content: inputText.trim(),
      timestamp: new Date().toISOString(),
      type: 'text',
      status: 'sent',
    };

    setInputText('');
    await saveMessage(newMessage);
    
    // Scroll to bottom
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const handleTyping = (text: string) => {
    setInputText(text);
    
    if (text.length > 0 && !isTyping) {
      setIsTyping(true);
    }
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Set new timeout
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
    }, 1000);
  };

  const renderMessage = ({ item }: { item: any }) => {
    const isMyMessage = item.senderId === currentUser?.id;
    
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
            {new Date(item.timestamp).toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </Text>
        </View>
      </View>
    );
  };

  const getOtherParticipantName = () => {
    if (!chatInfo || !currentUser) return 'Chat';
    
    const otherParticipant = Object.entries(chatInfo.participantNames).find(
      ([userId, name]) => userId !== currentUser.id
    );
    
    return otherParticipant ? otherParticipant[1] as string : 'Chat';
  };

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
            <Text style={styles.headerStatus}>Online</Text>
          </View>
        </View>
        
        <TouchableOpacity style={styles.moreButton}>
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
        
        <TypingIndicator visible={isTyping} userName={getOtherParticipantName()} />
        
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
            />
            <TouchableOpacity 
              style={[
                styles.sendButton,
                inputText.trim() ? styles.sendButtonActive : styles.sendButtonInactive
              ]}
              onPress={sendMessage}
              disabled={!inputText.trim()}
            >
              <Ionicons 
                name="send" 
                size={20} 
                color={inputText.trim() ? Colors.textLight : Colors.textSecondary} 
              />
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
