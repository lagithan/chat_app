import React, { useState, useRef } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import * as ImagePicker from 'expo-image-picker';

interface MessageInputProps {
  onSendMessage: (content: string, type?: 'text' | 'image') => void;
  onTypingChange?: (isTyping: boolean) => void;
  replyingTo?: any;
  onCancelReply?: () => void;
}

export default function MessageInput({
  onSendMessage,
  onTypingChange,
  replyingTo,
  onCancelReply,
}: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const recordAnim = useRef(new Animated.Value(1)).current;

  const handleSend = () => {
    if (message.trim()) {
      onSendMessage(message.trim());
      setMessage('');
      onTypingChange?.(false);
    }
  };

  const handleTextChange = (text: string) => {
    setMessage(text);
    onTypingChange?.(text.length > 0);
  };

  const handleImagePicker = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      onSendMessage(result.assets[0].uri, 'image');
    }
  };

  const startRecording = () => {
    setIsRecording(true);
    Animated.loop(
      Animated.sequence([
        Animated.timing(recordAnim, {
          toValue: 1.2,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(recordAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const stopRecording = () => {
    setIsRecording(false);
    recordAnim.stopAnimation();
    recordAnim.setValue(1);
    // Handle voice message recording
    Alert.alert('Voice Message', 'Voice recording feature coming soon!');
  };

  return (
    <View style={styles.container}>
      {replyingTo && (
        <View style={styles.replyContainer}>
          <View style={styles.replyContent}>
            <Text style={styles.replyLabel}>Replying to</Text>
            <Text style={styles.replyText} numberOfLines={1}>
              {replyingTo.content}
            </Text>
          </View>
          <TouchableOpacity onPress={onCancelReply} style={styles.cancelReply}>
            <Ionicons name="close" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      )}
      
      <View style={styles.inputContainer}>
        <TouchableOpacity 
          style={styles.attachButton}
          onPress={handleImagePicker}
        >
          <Ionicons name="add" size={24} color={Colors.primary} />
        </TouchableOpacity>

        <View style={styles.inputWrapper}>
          <TextInput
            ref={inputRef}
            style={styles.textInput}
            value={message}
            onChangeText={handleTextChange}
            placeholder="Type a message..."
            placeholderTextColor={Colors.textSecondary}
            multiline
            maxLength={1000}
          />
          
          {!message.trim() && (
            <TouchableOpacity
              style={styles.voiceButton}
              onPressIn={startRecording}
              onPressOut={stopRecording}
            >
              <Animated.View style={{ transform: [{ scale: recordAnim }] }}>
                <Ionicons 
                  name={isRecording ? "stop" : "mic"} 
                  size={20} 
                  color={isRecording ? Colors.error : Colors.textSecondary} 
                />
              </Animated.View>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity 
          style={[
            styles.sendButton,
            message.trim() ? styles.sendButtonActive : styles.sendButtonInactive
          ]}
          onPress={handleSend}
          disabled={!message.trim()}
        >
          <Ionicons 
            name="send" 
            size={20} 
            color={message.trim() ? Colors.textLight : Colors.textSecondary} 
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  replyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.surface,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  replyContent: {
    flex: 1,
  },
  replyLabel: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
  },
  replyText: {
    fontSize: 14,
    color: Colors.text,
    marginTop: 2,
  },
  cancelReply: {
    padding: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  attachButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: Colors.surface,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
    maxHeight: 100,
    paddingVertical: 8,
  },
  voiceButton: {
    padding: 8,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonActive: {
    backgroundColor: Colors.primary,
  },
  sendButtonInactive: {
    backgroundColor: Colors.border,
  },
});
