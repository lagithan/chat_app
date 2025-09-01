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
  Animated,
  Easing,
} from 'react-native';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { DatabaseService } from "@/services/database/sqlite";
import { FirestoreService, Chat, Message, Permission } from "@/services/firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Colors } from '@/constants/Colors';
import { useChatContext } from '@/contexts/ChatContext';

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
  const [pendingPermissionRequest, setPendingPermissionRequest] = useState(false);
  const [handledPermissionIds, setHandledPermissionIds] = useState<Set<string>>(new Set());
  
  const db = DatabaseService.getInstance();
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  // Use chat context to track current chat
  const { setCurrentChatId } = useChatContext();

  const dotPosition1 = useRef(new Animated.Value(0)).current;
  const dotPosition2 = useRef(new Animated.Value(0)).current;
  const dotPosition3 = useRef(new Animated.Value(0)).current;

  const translateY1 = dotPosition1.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -5],
  });
  const translateY2 = dotPosition2.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -5],
  });
  const translateY3 = dotPosition3.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -5],
  });

  const typingAnimationRef = useRef<{anim1?: Animated.CompositeAnimation, anim2?: Animated.CompositeAnimation, anim3?: Animated.CompositeAnimation}>({});

  // Set current chat when entering the page, clear when leaving
  useFocusEffect(
    React.useCallback(() => {
      if (id) {
        console.log('ChatPage: Setting current chat to:', id);
        setCurrentChatId(id as string);
      }
      
      // Clear current chat when leaving the page
      return () => {
        console.log('ChatPage: Clearing current chat');
        setCurrentChatId(null);
      };
    }, [id, setCurrentChatId])
  );

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
          console.log('ChatPage: Received', updatedMessages.length, 'messages');
          
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
              console.error('ChatPage: Error saving message locally:', error);
            }
          });
          setMessages(updatedMessages);
        },
        (error) => {
          console.error('ChatPage: Message subscription error:', error);
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

      // Set up permission listener
      const unsubscribePermissions = FirestoreService.subscribeToPermissions(
        chatInfo.id,
        async (permission) => {
          if (!permission) return;
          
          // Avoid handling the same permission multiple times
          if (handledPermissionIds.has(permission.id.toString())) return;
          
          console.log('ChatPage: Processing permission:', {
            permissionId: permission.id,
            senderId: permission.senderId,
            currentUserId: userProfile.id,
            status: permission.status,
            permission: permission.permission,
            isPending: pendingPermissionRequest
          });
          
          // Someone is asking ME for permission
          if (permission.senderId !== userProfile.id && !permission.permission && permission.status === 'sent') {
            console.log('ChatPage: Received permission request from another user');
            setHandledPermissionIds(prev => new Set(prev).add(permission.id.toString()));
            showPermissionRequestAlert(permission);
          }
          
          // I asked for permission and got a response
          else if (permission.senderId === userProfile.id && permission.status === 'responded' && pendingPermissionRequest) {
            console.log('ChatPage: Received response to my permission request');
            setPendingPermissionRequest(false);
            setHandledPermissionIds(prev => new Set(prev).add(permission.id.toString()));
            
            if (permission.permission) {
              console.log('ChatPage: Permission was granted - saving messages');
              Alert.alert(
                'Permission Granted',
                'Your request was approved. Saving messages...',
                [
                  {
                    text: 'OK',
                    onPress: async () => {
                      try {
                        const saved = await saveMessagesToSQLite();
                        
                        if (saved) {
                          await FirestoreService.leaveChat(chatInfo.id, userProfile.id);
                          Alert.alert('Success', 'Messages saved successfully!', [
                            { text: 'OK', onPress: () => router.push('/(tabs)/chat') }
                          ]);
                        } else {
                          Alert.alert('Error', 'Failed to save messages. Please try again.');
                        }
                      } catch (error) {
                        console.error('ChatPage: Error in permission granted flow:', error);
                        Alert.alert('Error', 'An error occurred while saving messages.');
                      }
                    }
                  }
                ]
              );
            } else {
              console.log('ChatPage: Permission was denied - cleaning up');
              await deleteAllChatData();
              Alert.alert('Permission Denied', 'Your request was denied. Chat data will be deleted.', [
                { text: 'OK', onPress: () => router.push('/(tabs)/chat') }
              ]);
            }
          }
        },
        (error) => {
          console.error('ChatPage: Permission subscription error:', error);
        }
      );

      return () => {
        console.log('ChatPage: Cleaning up subscriptions');
        unsubscribeMessages?.();
        unsubscribeTyping?.();
        unsubscribePermissions?.();
      };
    }
  }, [chatInfo, userProfile, pendingPermissionRequest]);

  // Typing indicator animation
  useEffect(() => {
    const animateDot = (dot: Animated.Value | Animated.ValueXY, delay: number) => {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, {
            toValue: 1,
            duration: 250,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 250,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.delay(500),
        ])
      );
      animation.start();
      return animation;
    };

    if (otherUserTyping) {
      const anim1 = animateDot(dotPosition1, 0);
      const anim2 = animateDot(dotPosition2, 200);
      const anim3 = animateDot(dotPosition3, 400);
      typingAnimationRef.current = { anim1, anim2, anim3 };
    } else {
      typingAnimationRef.current.anim1?.stop();
      typingAnimationRef.current.anim2?.stop();
      typingAnimationRef.current.anim3?.stop();
      dotPosition1.setValue(0);
      dotPosition2.setValue(0);
      dotPosition3.setValue(0);
    }

    return () => {
      typingAnimationRef.current.anim1?.stop();
      typingAnimationRef.current.anim2?.stop();
      typingAnimationRef.current.anim3?.stop();
    };
  }, [otherUserTyping]);

  useEffect(() => {
    if (otherUserTyping) {
      flatListRef.current?.scrollToEnd({ animated: true });
    }
  }, [otherUserTyping]);

  const loadUserProfile = async () => {
    try {
      const profile = await AsyncStorage.getItem('userProfile');
      if (profile) {
        const parsedProfile = JSON.parse(profile);
        console.log('ChatPage: Loaded user profile:', parsedProfile.id);
        setUserProfile(parsedProfile);
      }
    } catch (error) {
      console.error('ChatPage: Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadChatInfo = async () => {
    if (!userProfile || !id) return;
    
    try {
      console.log('ChatPage: Loading chat info for:', id);
      
      // Try loading from local database first
      let chat = await db.getChatById(id as string);
          
      if (!chat) {
        console.log('ChatPage: Chat not found locally, trying Firestore');
        // If not found locally, try Firebase
        const userChats = await FirestoreService.getUserChats(userProfile.id);
        chat = userChats.find((c) => c.id === id) || null;
              
        if (chat) {
          console.log('ChatPage: Found chat in Firestore, saving locally');
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

      if (chat) {
        console.log('ChatPage: Loaded chat:', chat.id);
      } else {
        console.log('ChatPage: Chat not found');
      }
          
      setChatInfo(chat);
    } catch (error) {
      console.error('ChatPage: Error loading chat info:', error);
    }
  };

  const loadMessages = async () => {
    if (!chatInfo) return;

    try {
      console.log('ChatPage: Loading messages for chat:', chatInfo.id);
      // First load from local database
      const localMessages = await db.getMessagesForChat(chatInfo.id);
      console.log('ChatPage: Loaded', localMessages.length, 'messages from local DB');
      if (localMessages.length > 0) {
        setMessages(localMessages);
      }
    } catch (error) {
      console.error('ChatPage: Error loading local messages:', error);
    }
  };

  const sendMessage = async () => {
    if (!messageText.trim() || !chatInfo || !userProfile || sending) return;

    const content = messageText.trim();
    setMessageText('');
    setSending(true);

    try {
      console.log('ChatPage: Sending message:', content.substring(0, 50) + '...');
      
      // Send to Firebase first
      await FirestoreService.sendMessage(
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
      console.error('ChatPage: Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const deleteAllChatData = async () => {
    if (!chatInfo) return;

    try {
      console.log('ChatPage: Deleting all chat data for:', chatInfo.id);
      // Delete from both databases in parallel
      await Promise.all([
        db.deleteChat(chatInfo.id),
        FirestoreService.deleteChat(chatInfo.id)
      ]);

      console.log('ChatPage: Chat and messages deleted from both databases');
    } catch (error) {
      console.error('ChatPage: Error deleting chat data:', error);
      Alert.alert('Warning', 'Some data may not have been fully deleted');
    }
  };

  const handleLeaveChat = async () => {
    if (!chatInfo || !userProfile) return;

    Alert.alert(
      'Leave Chat',
      'Do you want to request permission to save the chat messages before leaving?',
      [
        {
          text: 'Leave Without Saving',
          style: 'destructive',
          onPress: () => leaveWithoutPermission(),
        },
        {
          text: 'Request Permission',
          onPress: () => requestSavePermission(),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const requestSavePermission = async () => {
    if (!chatInfo || !userProfile) return;

    try {
      console.log('ChatPage: Requesting save permission');
      setPendingPermissionRequest(true);
      
      await FirestoreService.sendPermission(
        chatInfo.id,
        userProfile.id,
        userProfile.name || userProfile.displayName || 'Unknown',
        'save_messages'
      );

      Alert.alert(
        'Permission Requested',
        'Your request to save messages has been sent. You will be notified when the other user responds.',
        [{ text: 'OK' }]
      );

    } catch (error) {
      console.error('ChatPage: Error requesting permission:', error);
      Alert.alert('Error', 'Failed to send permission request');
      setPendingPermissionRequest(false);
    }
  };

  const leaveWithoutPermission = async () => {
    if (!chatInfo || !userProfile) return;

    Alert.alert(
      'Confirm Delete',
      'This will permanently delete all messages and chat data. Are you sure?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete and Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAllChatData();
              router.push('/(tabs)/chat');
            } catch (error) {
              console.error('ChatPage: Error leaving chat:', error);
              Alert.alert('Error', 'Failed to leave chat');
            }
          }
        }
      ]
    );
  };

  const saveMessagesToSQLite = async () => {
    console.log('ChatPage: === SAVE MESSAGES DEBUG ===');
    console.log('ChatPage: Chat Info exists:', !!chatInfo);
    console.log('ChatPage: Chat Info ID:', chatInfo?.id);
    console.log('ChatPage: Messages count:', messages.length);
    console.log('ChatPage: User Profile:', userProfile?.id);
    
    if (!chatInfo) {
      console.error('ChatPage: No chat info available for saving');
      return false;
    }
    
    if (!messages || messages.length === 0) {
      console.error('ChatPage: No messages available for saving');
      return false;
    }

    try {
      console.log(`ChatPage: Attempting to save ${messages.length} messages to local database`);
      
      if (typeof db.saveExistingMessages !== 'function') {
        console.error('ChatPage: saveExistingMessages method not available');
        
        // Fallback: Save messages one by one
        console.log('ChatPage: Using fallback method to save messages');
        for (const message of messages) {
          try {
            await db.sendMessage(
              message.chatId,
              message.senderId,
              message.senderName,
              message.content
            );
          } catch (msgError) {
            console.error('ChatPage: Error saving individual message:', msgError);
          }
        }
      } else {
        // Use the bulk save method
        await db.saveExistingMessages(messages);
      }
      
      // Also ensure the chat is saved locally
      const chatToSave = {
        id: chatInfo.id,
        participants: chatInfo.participants,
        participantNames: chatInfo.participantNames,
        createdAt: chatInfo.createdAt,
        updatedAt: new Date().toISOString(),
        lastMessage: chatInfo.lastMessage,
        isActive: true
      };
      
      await db.saveChat(chatToSave);
      
      // Verify the save worked
      const savedMessages = await db.getMessagesForChat(chatInfo.id);
      console.log(`ChatPage: Verification: ${savedMessages.length} messages now in database`);
      
      return savedMessages.length > 0;
      
    } catch (error) {
      console.error('ChatPage: Error saving messages to SQLite:', error);
      return false;
    }
  };

  const showPermissionRequestAlert = (permission: Permission) => {
    Alert.alert(
      'Permission Request',
      `${permission.senderName} wants to save the chat messages before leaving. Do you allow this?`,
      [
        {
          text: 'Deny',
          style: 'destructive',
          onPress: () => handlePermissionResponse(permission.id.toString(), false),
        },
        {
          text: 'Allow',
          onPress: () => handlePermissionResponse(permission.id.toString(), true),
        },
      ]
    );
  };

  const handlePermissionResponse = async (permissionId: string, granted: boolean) => {
    if (!chatInfo) return;

    try {
      console.log('ChatPage: Responding to permission request:', { permissionId, granted });
      
      await FirestoreService.updatePermissionStatus(chatInfo.id, permissionId, granted);

      if (granted) {
        console.log('ChatPage: Permission granted');
        Alert.alert(
          'Permission Granted', 
          'You have allowed the other user to save the chat messages.'
        );
      } else {
        console.log('ChatPage: Permission denied - deleting all chat data');
        await deleteAllChatData();
        Alert.alert(
          'Permission Denied', 
          'Permission was denied. All chat data has been deleted.',
          [{ text: 'OK', onPress: () => router.push('/(tabs)/chat') }]
        );
      }

    } catch (error) {
      console.error('ChatPage: Error responding to permission:', error);
      Alert.alert('Error', 'Failed to respond to permission request');
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
        console.error('ChatPage: Error updating typing status:', error);
      }
    }

    // Set timeout to stop typing indicator
    if (isCurrentlyTyping) {
      typingTimeoutRef.current = setTimeout(async () => {
        setIsTyping(false);
        try {
          await FirestoreService.updateTypingStatus(chatInfo.id, userProfile.id, false);
        } catch (error) {
          console.error('ChatPage: Error stopping typing status:', error);
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

  const renderMessage = ({ item }: { item: any }) => {
    const isOwn = item.senderId == userProfile.id;
    
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

  const renderTypingIndicator = () => {
    if (!otherUserTyping) return null;

    return (
      <View style={[styles.messageContainer, styles.otherMessage]}>
        <View style={[styles.messageBubble, styles.otherBubble]}>
          <View style={styles.typingIndicator}>
            <Animated.View style={[styles.dot, { transform: [{ translateY: translateY1 }] }]} />
            <Animated.View style={[styles.dot, { transform: [{ translateY: translateY2 }] }]} />
            <Animated.View style={[styles.dot, { transform: [{ translateY: translateY3 }] }]} />
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backIcon} onPress={() => router.push('/(tabs)/chat')}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.title}>{chatInfo ? getOtherParticipantName() : 'Loading...'}</Text>
        </View>
        {chatInfo && (
          <TouchableOpacity 
            style={styles.leaveButton} 
            onPress={handleLeaveChat}
            disabled={pendingPermissionRequest}
          >
            {pendingPermissionRequest ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <Ionicons name="exit-outline" size={24} color={Colors.primary} />
            )}
          </TouchableOpacity>
        )}
      </View>

      <KeyboardAvoidingView 
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Loading chat...</Text>
          </View>
        ) : !chatInfo ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Chat not found</Text>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <Text style={styles.backButtonText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
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
              extraData={otherUserTyping}
              ListFooterComponent={renderTypingIndicator}
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
          </>
        )}
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
    paddingVertical: 24,
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
  leaveButton: {
    padding: 8,
    marginLeft: 8,
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 20,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.textSecondary,
    marginHorizontal: 2,
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
    paddingVertical: 40,
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