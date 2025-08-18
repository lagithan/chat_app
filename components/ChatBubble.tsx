import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface ChatBubbleProps {
  message: string;
  timestamp: number;
  isMe: boolean;
  senderName?: string;
  delivered?: boolean;
  read?: boolean;
}

export default function ChatBubble({
  message,
  timestamp,
  isMe,
  senderName,
  delivered = false,
  read = false,
}: ChatBubbleProps) {
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <View style={[styles.container, isMe ? styles.myMessage : styles.theirMessage]}>
      <View style={[styles.bubble, isMe ? styles.myBubble : styles.theirBubble]}>
        {!isMe && senderName && (
          <Text style={styles.senderName}>{senderName}</Text>
        )}
        <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.theirMessageText]}>
          {message}
        </Text>
        <View style={[styles.messageInfo, isMe ? styles.myMessageInfo : styles.theirMessageInfo]}>
          <Text style={[styles.timestamp, isMe ? styles.myTimestamp : styles.theirTimestamp]}>
            {formatTime(timestamp)}
          </Text>
          {isMe && (
            <View style={styles.deliveryStatus}>
              {read ? (
                <MaterialIcons name="done-all" size={16} color="#007AFF" />
              ) : delivered ? (
                <MaterialIcons name="done-all" size={16} color="#ccc" />
              ) : (
                <MaterialIcons name="done" size={16} color="#ccc" />
              )}
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    marginHorizontal: 16,
  },
  myMessage: {
    alignItems: 'flex-end',
  },
  theirMessage: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  myBubble: {
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 4,
  },
  theirBubble: {
    backgroundColor: '#E5E5EA',
    borderBottomLeftRadius: 4,
  },
  senderName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  myMessageText: {
    color: 'white',
  },
  theirMessageText: {
    color: '#000',
  },
  messageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  myMessageInfo: {
    justifyContent: 'flex-end',
  },
  theirMessageInfo: {
    justifyContent: 'flex-start',
  },
  timestamp: {
    fontSize: 11,
    marginRight: 4,
  },
  myTimestamp: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  theirTimestamp: {
    color: '#8E8E93',
  },
  deliveryStatus: {
    marginLeft: 4,
  },
});