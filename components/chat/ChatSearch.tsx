import React, { useState, useEffect } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Text,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';

interface ChatSearchProps {
  visible: boolean;
  onClose: () => void;
  messages: any[];
  onMessageSelect: (message: any) => void;
}

export default function ChatSearch({ 
  visible, 
  onClose, 
  messages, 
  onMessageSelect 
}: ChatSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);

  useEffect(() => {
    if (searchQuery.trim()) {
      const results = messages.filter(message =>
        message.content.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery, messages]);

  const highlightText = (text: string, query: string) => {
    if (!query) return text;
    
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, index) => (
      <Text
        key={index}
        style={part.toLowerCase() === query.toLowerCase() ? styles.highlightedText : {}}
      >
        {part}
      </Text>
    ));
  };

  const renderSearchResult = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.resultItem}
      onPress={() => {
        onMessageSelect(item);
        onClose();
      }}
    >
      <View style={styles.resultHeader}>
        <Text style={styles.senderName}>{item.senderName}</Text>
        <Text style={styles.timestamp}>
          {new Date(item.timestamp).toLocaleDateString()}
        </Text>
      </View>
      <Text style={styles.resultContent}>
        {highlightText(item.content, searchQuery)}
      </Text>
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      statusBarTranslucent
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={Colors.primary} />
          </TouchableOpacity>
          
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={Colors.textSecondary} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search messages..."
              placeholderTextColor={Colors.textSecondary}
              autoFocus
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.content}>
          {searchQuery.trim() === '' ? (
            <View style={styles.emptyState}>
              <Ionicons name="search" size={48} color={Colors.textSecondary} />
              <Text style={styles.emptyText}>Search through your messages</Text>
            </View>
          ) : searchResults.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="document-text-outline" size={48} color={Colors.textSecondary} />
              <Text style={styles.emptyText}>No messages found</Text>
            </View>
          ) : (
            <FlatList
              data={searchResults}
              renderItem={renderSearchResult}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      </View>
    </Modal>
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
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
    marginLeft: 8,
  },
  content: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 16,
  },
  resultItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  senderName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  timestamp: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  resultContent: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
  },
  highlightedText: {
    backgroundColor: Colors.primary + '30',
    fontWeight: 'bold',
  },
});