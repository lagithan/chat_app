import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Alert,
  Clipboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';

interface MessageBubbleProps {
  message: any;
  isMyMessage: boolean;
  onReaction?: (messageId: string, reaction: string) => void;
  onReply?: (message: any) => void;
}

export default function MessageBubble({ 
  message, 
  isMyMessage, 
  onReaction, 
  onReply 
}: MessageBubbleProps) {
  const [showActions, setShowActions] = useState(false);
  const [scaleAnim] = useState(new Animated.Value(1));

  const handleLongPress = () => {
    setShowActions(true);
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1.05,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const copyMessage = () => {
    Clipboard.setString(message.content);
    setShowActions(false);
    Alert.alert('Copied', 'Message copied to clipboard');
  };

  const getStatusIcon = () => {
    if (!isMyMessage) return null;
    
    switch (message.status) {
      case 'sending':
        return <Ionicons name="time-outline" size={12} color={Colors.textLight} style={styles.statusIcon} />;
      case 'sent':
        return <Ionicons name="checkmark" size={12} color={Colors.textLight} style={styles.statusIcon} />;
      case 'delivered':
        return <Ionicons name="checkmark-done" size={12} color={Colors.textLight} style={styles.statusIcon} />;
      case 'read':
        return <Ionicons name="checkmark-done" size={12} color="#00ff00" style={styles.statusIcon} />;
      default:
        return null;
    }
  };

  const reactions = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

  return (
    <View style={[
      styles.container,
      isMyMessage ? styles.myMessageContainer : styles.otherMessageContainer
    ]}>
      <TouchableOpacity
        onLongPress={handleLongPress}
        activeOpacity={0.8}
      >
        <Animated.View
          style={[
            styles.bubble,
            isMyMessage ? styles.myBubble : styles.otherBubble,
            { transform: [{ scale: scaleAnim }] }
          ]}
        >
          {message.replyTo && (
            <View style={styles.replyContainer}>
              <View style={styles.replyBar} />
              <Text style={styles.replyText} numberOfLines={1}>
                {message.replyTo.content}
              </Text>
            </View>
          )}
          
          <Text style={[
            styles.messageText,
            isMyMessage ? styles.myMessageText : styles.otherMessageText
          ]}>
            {message.content}
          </Text>
          
          <View style={styles.messageFooter}>
            <Text style={[
              styles.timestamp,
              isMyMessage ? styles.myTimestamp : styles.otherTimestamp
            ]}>
              {new Date(message.timestamp).toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </Text>
            {getStatusIcon()}
          </View>

          {message.reactions && Object.keys(message.reactions).length > 0 && (
            <View style={styles.reactionsContainer}>
              {Object.entries(message.reactions).map(([reaction, count]: [string, any]) => (
                <View key={reaction} style={styles.reactionBubble}>
                  <Text style={styles.reactionEmoji}>{reaction}</Text>
                  <Text style={styles.reactionCount}>{count}</Text>
                </View>
              ))}
            </View>
          )}
        </Animated.View>
      </TouchableOpacity>

      {showActions && (
        <View style={[
          styles.actionsContainer,
          isMyMessage ? styles.myActionsContainer : styles.otherActionsContainer
        ]}>
          <View style={styles.reactionsRow}>
            {reactions.map((reaction) => (
              <TouchableOpacity
                key={reaction}
                style={styles.reactionButton}
                onPress={() => {
                  onReaction?.(message.id, reaction);
                  setShowActions(false);
                }}
              >
                <Text style={styles.reactionEmoji}>{reaction}</Text>
              </TouchableOpacity>
            ))}
          </View>
          
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                onReply?.(message);
                setShowActions(false);
              }}
            >
              <Ionicons name="arrow-undo" size={16} color={Colors.primary} />
              <Text style={styles.actionText}>Reply</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.actionButton}
              onPress={copyMessage}
            >
              <Ionicons name="copy" size={16} color={Colors.primary} />
              <Text style={styles.actionText}>Copy</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {showActions && (
        <TouchableOpacity
          style={styles.overlay}
          onPress={() => setShowActions(false)}
          activeOpacity={1}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 2,
    paddingHorizontal: 16,
    position: 'relative',
  },
  myMessageContainer: {
    alignItems: 'flex-end',
  },
  otherMessageContainer: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 10,
    position: 'relative',
  },
  myBubble: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: Colors.otherMessage,
    borderBottomLeftRadius: 4,
  },
  replyContainer: {
    flexDirection: 'row',
    marginBottom: 8,
    opacity: 0.8,
  },
  replyBar: {
    width: 3,
    backgroundColor: Colors.primary,
    marginRight: 8,
    borderRadius: 2,
  },
  replyText: {
    fontSize: 12,
    fontStyle: 'italic',
    flex: 1,
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
    marginTop: 4,
    justifyContent: 'flex-end',
  },
  timestamp: {
    fontSize: 11,
  },
  myTimestamp: {
    color: Colors.textLight,
    opacity: 0.8,
  },
  otherTimestamp: {
    color: Colors.textSecondary,
  },
  statusIcon: {
    marginLeft: 4,
  },
  reactionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  reactionBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 4,
    marginTop: 2,
  },
  reactionEmoji: {
    fontSize: 12,
  },
  reactionCount: {
    fontSize: 10,
    marginLeft: 2,
    color: Colors.textSecondary,
  },
  actionsContainer: {
    position: 'absolute',
    top: -80,
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 8,
    elevation: 8,
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    zIndex: 1000,
  },
  myActionsContainer: {
    right: 16,
  },
  otherActionsContainer: {
    left: 16,
  },
  reactionsRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  reactionButton: {
    padding: 8,
    marginHorizontal: 2,
  },
  actionsRow: {
    flexDirection: 'row',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 4,
    borderRadius: 8,
    backgroundColor: Colors.surface,
  },
  actionText: {
    fontSize: 12,
    color: Colors.primary,
    marginLeft: 4,
  },
  overlay: {
    position: 'absolute',
    top: -1000,
    left: -1000,
    right: -1000,
    bottom: -1000,
    zIndex: 999,
  },
});
