import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  ToastAndroid,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import DatabaseService from '../../../services/DatabaseService';
import SocketService from '../../../services/SocketService';

type Message = {
  sessionId: string;
  senderId: string;
  receiverId: string;
  senderName: string;
  receiverName: string;
  message: string;
  timestamp: number;
};

type User = {
  userId: string;
  username: string;
};

export default function ChatScreen() {
  const params = useLocalSearchParams();
  const sessionId = String(params.sessionId || '');
  const userId = String(params.userId || '');
  const userName = String(params.userName || '');
  const contactId = String(params.contactId || '');
  const contactName = String(params.contactName || '');

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isConnected, setIsConnected] = useState(SocketService.isSocketConnected());
  const flatListRef = useRef<FlatList>(null);

  // Define handler functions for socket events using `useCallback` for memoization
  const handleNewMessage = useCallback((messageData: Partial<Message>) => {
    if (messageData.sessionId && messageData.message) {
      setMessages(prev => [...prev, messageData as Message]);
    }
  }, []);

  const handleUserJoined = useCallback((data: Partial<User>) => {
    // Safely access properties, using optional chaining and a fallback
    ToastAndroid.show(`${data.username || data.userId || 'A user'} joined the chat`, ToastAndroid.SHORT);
  }, []);

  const handleUserLeft = useCallback((data: Partial<User>) => {
    // Safely access properties
    ToastAndroid.show(`${data.username || data.userId || 'A user'} left the chat`, ToastAndroid.SHORT);
  }, []);

  useEffect(() => {
    let unsubMsg: any, unsubJoin: any, unsubLeft: any, unsubConnection: any;

    const init = async () => {
      try {
        await DatabaseService.initDatabase();

        // Load messages from DB
        const savedMessages = await DatabaseService.getMessages(sessionId);
        if (savedMessages) {
          setMessages(savedMessages);
        }

        // Join socket session and handle connection
        SocketService.connect(userId, userName);
        await SocketService.joinQRSession(sessionId, { userId, username: userName });
        setIsConnected(SocketService.isSocketConnected());

        // Listen for events and get the unsubscribe functions
        unsubMsg = SocketService.onMessage(handleNewMessage);
        unsubJoin = SocketService.onUserJoin(handleUserJoined);
        unsubLeft = SocketService.onUserLeft(handleUserLeft);
        unsubConnection = SocketService.onConnectionChange(setIsConnected);

        ToastAndroid.show('Connected to chat session', ToastAndroid.SHORT);
      } catch (error) {
        console.error('Chat initialization error:', error);
        Alert.alert('Error', 'Failed to initialize chat');
      }
    };

    init();

    return () => {
      // Cleanup all event listeners and leave the session
      if (unsubMsg) unsubMsg();
      if (unsubJoin) unsubJoin();
      if (unsubLeft) unsubLeft();
      if (unsubConnection) unsubConnection();
      SocketService.leaveSession(sessionId);
    };
  }, [sessionId, userId, userName, handleNewMessage, handleUserJoined, handleUserLeft]);

  const sendMessage = async () => {
    if (!inputText.trim() || !isConnected) return;

    try {
      const messageData: Message = {
        sessionId,
        senderId: userId,
        receiverId: contactId,
        senderName: userName,
        receiverName: contactName,
        message: inputText.trim(),
        timestamp: Date.now(),
      };

      await SocketService.sendMessage(messageData);
      setInputText('');
    } catch (error) {
      console.error('Send message error:', error);
      Alert.alert('Error', 'Failed to send message');
    }
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <View
      style={[
        styles.messageBubble,
        item.senderId === userId ? styles.sentMessage : styles.receivedMessage,
      ]}
    >
      <Text
        style={[
          styles.messageText,
          item.senderId !== userId && { color: '#222' },
        ]}
      >
        {item.message}
      </Text>
      <Text style={styles.timestamp}>
        {new Date(item.timestamp).toLocaleTimeString()}
      </Text>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{contactName || 'Chat Session'}</Text>
          <Text style={styles.sessionInfo}>
            {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
          </Text>
        </View>

        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(_, index) => index.toString()}
          style={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Type a message..."
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!inputText.trim() || !isConnected) && styles.disabledButton,
            ]}
            onPress={sendMessage}
            disabled={!inputText.trim() || !isConnected}
          >
            <MaterialIcons name="send" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    backgroundColor: '#007AFF',
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: { marginRight: 15 },
  headerTitle: { color: 'white', fontSize: 18, fontWeight: 'bold', flex: 1 },
  sessionInfo: { color: 'white', fontSize: 12 },
  messagesList: { flex: 1, padding: 10 },
  messageBubble: { maxWidth: '80%', padding: 12, marginVertical: 4, borderRadius: 18 },
  sentMessage: { alignSelf: 'flex-end', backgroundColor: '#007AFF' },
  receivedMessage: {
    alignSelf: 'flex-start',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  messageText: { fontSize: 16, color: 'white' },
  timestamp: { fontSize: 10, color: 'rgba(0,0,0,0.5)', marginTop: 4, alignSelf: 'flex-end' },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: 'white',
    alignItems: 'flex-end',
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginRight: 10,
    maxHeight: 100,
  },
  sendButton: { backgroundColor: '#007AFF', padding: 12, borderRadius: 20 },
  disabledButton: { backgroundColor: '#ccc' },
});