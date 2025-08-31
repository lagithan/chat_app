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
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { DatabaseService } from "@/services/database/sqlite";
import { FirestoreService, Chat, Message, Permission } from "@/services/firebase/firestore";
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
  const [pendingPermissionRequest, setPendingPermissionRequest] = useState(false);
  const [handledPermissionIds, setHandledPermissionIds] = useState<Set<string>>(new Set());
  
  const db = DatabaseService.getInstance();
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

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

      // Set up single permission listener to handle all permission logic
      const unsubscribePermissions = FirestoreService.subscribeToPermissions(
        chatInfo.id,
        async (permission) => {
          if (!permission) return;
          
          // Avoid handling the same permission multiple times
          if (handledPermissionIds.has(permission.id.toString())) return;
          
          console.log('Processing permission:', {
            permissionId: permission.id,
            senderId: permission.senderId,
            currentUserId: userProfile.id,
            status: permission.status,
            permission: permission.permission,
            isPending: pendingPermissionRequest
          });
          
          // CASE 1: Someone is asking ME for permission (I need to respond)
          if (permission.senderId !== userProfile.id && !permission.permission && permission.status === 'sent') {
            console.log('Received permission request from another user');
            setHandledPermissionIds(prev => new Set(prev).add(permission.id.toString()));
            showPermissionRequestAlert(permission);
          }
          
          // CASE 2: I asked for permission and got a response
          else if (permission.senderId === userProfile.id && permission.status === 'responded' && pendingPermissionRequest) {
            console.log('Received response to my permission request');
            setPendingPermissionRequest(false);
            setHandledPermissionIds(prev => new Set(prev).add(permission.id.toString()));
            
            if (permission.permission) {
              console.log('Permission was granted - saving messages');
              // Permission granted - save messages BEFORE leaving
              Alert.alert(
                'Permission Granted',
                'Your request was approved. Saving messages...',
                [
                  {
                    text: 'OK',
                    onPress: async () => {
                      try {
                        console.log('Starting save process...');
                        console.log('Current chat info:', chatInfo);
                        console.log('Current messages count:', messages.length);
                        
                        const saved = await saveMessagesToSQLite();
                        console.log('Save result:', saved);
                        
                        if (saved) {
                          console.log('Messages saved successfully, now leaving chat');
                          await FirestoreService.leaveChat(chatInfo.id, userProfile.id);
                          Alert.alert('Success', 'Messages saved successfully!', [
                            { text: 'OK', onPress: () => router.push('/(tabs)/chat') }
                          ]);
                        } else {
                          console.error('Failed to save messages');
                          Alert.alert('Error', 'Failed to save messages. Please try again.');
                        }
                      } catch (error) {
                        console.error('Error in permission granted flow:', error);
                        Alert.alert('Error', 'An error occurred while saving messages.');
                      }
                    }
                  }
                ]
              );
            } else {
              console.log('Permission was denied - cleaning up');
              // Permission denied - clean up and leave
              await deleteAllChatData();
              Alert.alert('Permission Denied', 'Your request was denied. Chat data will be deleted.', [
                { text: 'OK', onPress: () => router.push('/(tabs)/chat') }
              ]);
            }
          }
        },
        (error) => {
          console.error('Permission subscription error:', error);
        }
      );

      return () => {
        unsubscribeMessages?.();
        unsubscribeTyping?.();
        unsubscribePermissions?.();
      };
    }
  }, [chatInfo, userProfile, pendingPermissionRequest]);

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

      
      // Stop typing indicator
      if (isTyping) {
        await FirestoreService.updateTypingStatus(chatInfo.id, userProfile.id, false);
        setIsTyping(false);
      }

    } catch (error) {
      console.error('Error sending message:', error);
      
      // If Firebase fails, save locally only
     
    } finally {
      setSending(false);
    }
  };

  // Delete chat and messages from both databases
  const deleteAllChatData = async () => {
    if (!chatInfo) return;

    try {
      // Delete from both databases in parallel
      await Promise.all([
        // Delete from SQLite
        db.deleteChat(chatInfo.id),
      
        // Delete from Firestore (this also deactivates the chat)
        FirestoreService.deleteChat(chatInfo.id)
      ]);

      console.log('Chat and messages deleted from both databases');
    } catch (error) {
      console.error('Error deleting chat data:', error);
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
      setPendingPermissionRequest(true);
      
      // Send permission request
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
      console.error('Error requesting permission:', error);
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
              // Delete all chat data from both databases
              await deleteAllChatData();
              router.push('/(tabs)/chat');
            } catch (error) {
              console.error('Error leaving chat:', error);
              Alert.alert('Error', 'Failed to leave chat');
            }
          }
        }
      ]
    );
  };

  const saveMessagesToSQLite = async () => {
    console.log('=== SAVE MESSAGES DEBUG ===');
    console.log('Chat Info exists:', !!chatInfo);
    console.log('Chat Info ID:', chatInfo?.id);
    console.log('Messages count:', messages.length);
    console.log('User Profile:', userProfile?.id);
    
    if (!chatInfo) {
      console.error('No chat info available for saving');
      return false;
    }
    
    if (!messages || messages.length === 0) {
      console.error('No messages available for saving');
      return false;
    }

    try {
      console.log(`Attempting to save ${messages.length} messages to local database`);
      
      // First, ensure we have the bulk save method available
      if (typeof db.saveExistingMessages !== 'function') {
        console.error('saveExistingMessages method not available on database service');
        
        // Fallback: Save messages one by one (not ideal but will work)
        console.log('Using fallback method to save messages');
        for (const message of messages) {
          try {
            // Create a unique message ID if it doesn't exist
            const messageId = message.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            await db.sendMessage(
              message.chatId,
              message.senderId,
              message.senderName,
              message.content
            );
          } catch (msgError) {
            console.error('Error saving individual message:', msgError);
          }
        }
      } else {
        // Use the bulk save method
        await db.saveExistingMessages(messages);
      }
      
      // Also ensure the chat is saved locally with all required fields
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
      console.log(`Verification: ${savedMessages.length} messages now in database`);
      
      if (savedMessages.length === 0) {
        console.warn('No messages were saved to database');
        return false;
      }
      
      console.log('Messages successfully saved to local database');
      return true;
      
    } catch (error) {
      console.error('Error saving messages to SQLite:', error);
     
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
      console.log('Responding to permission request:', { permissionId, granted });
      
      // Update permission status in Firebase
      await FirestoreService.updatePermissionStatus(chatInfo.id, permissionId, granted);

      if (granted) {
        console.log('Permission granted - OTHER user will save messages');
        // Just notify that permission was granted
        // The OTHER user (who requested permission) will handle saving
        Alert.alert(
          'Permission Granted', 
          'You have allowed the other user to save the chat messages. They will handle the saving process.'
        );
      } else {
        console.log('Permission denied - deleting all chat data');
        // Permission denied - delete everything for both users
        await deleteAllChatData();
        Alert.alert(
          'Permission Denied', 
          'Permission was denied. All chat data has been deleted.',
          [{ text: 'OK', onPress: () => router.push('/(tabs)/chat') }]
        );
      }

    } catch (error) {
      console.error('Error responding to permission:', error);
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

  const renderMessage = ({ item }: { item: any }) => {
    const isOwn = item.senderId == userProfile.id ;
    
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
        <TouchableOpacity style={styles.backIcon} onPress={() => router.push('/chat')}>
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