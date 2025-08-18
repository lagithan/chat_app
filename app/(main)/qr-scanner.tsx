import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import QRCodeScanner from '../../components/QRCodeScanner';
import AuthService from '../../services/AuthService';
import DatabaseService, { User, Contact } from '../../services/DatabaseService';
import SocketService from '../../services/SocketService';

interface SessionInfo {
  sessionId: string;
  creatorId?: string;
  creatorName?: string;
  type: 'session_id' | 'manual_entry';
}

export default function QRScannerScreen() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualSessionId, setManualSessionId] = useState('');
  const [joiningSession, setJoiningSession] = useState(false);

  useEffect(() => {
    initializeScanner();
  }, []);

  const initializeScanner = async () => {
    try {
      await DatabaseService.initDatabase();
      
      const user = await AuthService.getCurrentUser();
      if (!user) {
        Alert.alert('Error', 'Please login first', [
          { text: 'OK', onPress: () => router.replace('/(auth)/login') }
        ]);
        return;
      }
      
      setCurrentUser(user);
      setLoading(false);

      SocketService.connect(user.userId, user.fullName || user.username);
    } catch (error) {
      console.error('Error initializing scanner:', error);
      Alert.alert('Error', 'Failed to initialize scanner');
      setLoading(false);
    }
  };

  const handleQRScanned = async (data: string) => {
    try {
      setJoiningSession(true);

      let sessionInfo: SessionInfo;
      try {
        const parsedData = JSON.parse(data);
        sessionInfo = {
          sessionId: parsedData.sessionId,
          creatorId: parsedData.creatorId,
          creatorName: parsedData.creatorName,
          type: 'session_id'
        };
      } catch (parseError) {
        sessionInfo = {
          sessionId: data.trim(),
          type: 'session_id'
        };
      }

      await joinSession(sessionInfo);
    } catch (error) {
      console.error('Error processing QR scan:', error);
      Alert.alert('Error', 'Invalid QR code. Please try again.');
      setJoiningSession(false);
    }
  };

  const handleManualEntry = async () => {
    if (!manualSessionId.trim()) {
      Alert.alert('Error', 'Please enter a session ID');
      return;
    }

    setJoiningSession(true);
    const sessionInfo: SessionInfo = {
      sessionId: manualSessionId.trim(),
      type: 'manual_entry'
    };

    await joinSession(sessionInfo);
  };

  const joinSession = async (sessionInfo: SessionInfo) => {
    try {
      if (!currentUser) {
        throw new Error('User not logged in');
      }

      const { sessionId, creatorId, creatorName } = sessionInfo;

      if (!sessionId) {
        throw new Error('Invalid session data');
      }

      if (creatorId === currentUser.userId) {
        Alert.alert('Error', 'You cannot join your own session!');
        setJoiningSession(false);
        return;
      }

      if (creatorId && creatorName) {
        await DatabaseService.addContact(currentUser.userId, {
          contactUserId: creatorId,
          contactName: creatorName,
          contactAvatar: ''
        });

        await DatabaseService.addContact(creatorId, {
          contactUserId: currentUser.userId,
          contactName: currentUser.fullName || currentUser.username,
          contactAvatar: currentUser.avatar,
        });
      }

      const joinResult = await SocketService.joinQRSession(sessionId, {
        userId: currentUser.userId,
        username: currentUser.fullName || currentUser.username,
      });

      if (joinResult.success) {
        setJoiningSession(false);
        setShowManualEntry(false);
        setManualSessionId('');

        Alert.alert(
          'Success!',
          'You have successfully joined the chat session.',
          [
            {
              text: 'Start Chatting',
              onPress: () => {
                router.replace({
                  pathname: '/(main)/chat/[sessionId]',
                  params: {
                    sessionId: sessionId,
                    userId: currentUser.userId,
                    userName: currentUser.fullName || currentUser.username,
                    contactId: creatorId || 'unknown',
                    contactName: creatorName || 'Unknown User',
                  }
                });
              }
            }
          ]
        );
      } else {
        throw new Error(joinResult.error || 'Failed to join session');
      }
    } catch (error: any) {
      console.error('Error joining session:', error);
      Alert.alert('Error', 'Failed to join session. The session may be invalid or expired.');
      setJoiningSession(false);
    }
  };

  const handleGoBack = () => {
    router.back();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Initializing scanner...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <QRCodeScanner
        onScan={handleQRScanned}
        onClose={handleGoBack}
      />

      <View style={styles.bottomActions}>
        <TouchableOpacity
          style={styles.manualEntryButton}
          onPress={() => setShowManualEntry(true)}
        >
          <MaterialIcons name="dialpad" size={24} color="white" />
          <Text style={styles.manualEntryText}>Enter Session ID Manually</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={showManualEntry}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowManualEntry(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowManualEntry(false)}
            >
              <MaterialIcons name="close" size={24} color="#007AFF" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Join Session</Text>
            <View style={{ width: 24 }} />
          </View>

          <View style={styles.modalContent}>
            <Text style={styles.modalSubtitle}>
              Enter the session ID provided by the person you want to chat with
            </Text>

            <View style={styles.inputContainer}>
              <MaterialIcons name="qr-code" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Enter Session ID"
                value={manualSessionId}
                onChangeText={setManualSessionId}
                autoCapitalize="none"
                autoCorrect={false}
                multiline={false}
              />
            </View>

            <TouchableOpacity
              style={[styles.joinButton, joiningSession && styles.joinButtonDisabled]}
              onPress={handleManualEntry}
              disabled={joiningSession}
            >
              {joiningSession ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <MaterialIcons name="chat" size={20} color="white" />
                  <Text style={styles.joinButtonText}>Join Chat</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.modalInstructions}>
              <Text style={styles.instructionsTitle}>How to get a Session ID:</Text>
              <View style={styles.instructionItem}>
                <Text style={styles.instructionNumber}>1.</Text>
                <Text style={styles.instructionText}>
                  Ask the person to create a new chat session
                </Text>
              </View>
              <View style={styles.instructionItem}>
                <Text style={styles.instructionNumber}>2.</Text>
                <Text style={styles.instructionText}>
                  They should tap "Manual Entry" and share the Session ID with you
                </Text>
              </View>
              <View style={styles.instructionItem}>
                <Text style={styles.instructionNumber}>3.</Text>
                <Text style={styles.instructionText}>
                  Enter that Session ID above to join their chat
                </Text>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {joiningSession && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingContent}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Joining session...</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  bottomActions: {
    position: 'absolute',
    bottom: 50,
    left: 20,
    right: 20,
  },
  manualEntryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 122, 255, 0.9)',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 25,
  },
  manualEntryText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalCloseButton: {
    padding: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 22,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 20,
    paddingHorizontal: 15,
    height: 50,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 30,
  },
  joinButtonDisabled: {
    backgroundColor: '#ccc',
  },
  joinButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  modalInstructions: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  instructionItem: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  instructionNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
    width: 20,
  },
  instructionText: {
    fontSize: 16,
    color: '#666',
    flex: 1,
    lineHeight: 22,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 30,
    alignItems: 'center',
    minWidth: 200,
  },
});