import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Share,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import QRCodeGenerator from '../../../components/QRCodeGenerator';
import AuthService from '../../../services/AuthService';
import DatabaseService, { User, Session } from '../../../services/DatabaseService';
import SocketService from '../../../services/SocketService';

export default function QRGeneratorScreen() {
  const { sessionId } = useLocalSearchParams();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [waitingForParticipant, setWaitingForParticipant] = useState(false);
  const [sessionData, setSessionData] = useState<Partial<Session> | null>(null);
  const [qrValue, setQrValue] = useState('');

  useEffect(() => {
    initializeSession();

    const unsubscribeUserJoin = SocketService.onUserJoin((userData: any) => {
      handleUserJoined(userData);
    });

    return () => {
      unsubscribeUserJoin();
    };
  }, [sessionId]);

  const initializeSession = async () => {
    try {
      await DatabaseService.initDatabase();

      const user = await AuthService.getCurrentUser();
      if (!user) {
        Alert.alert('Error', 'Please login first', [
          { text: 'OK', onPress: () => router.replace('/(auth)/login') },
        ]);
        return;
      }

      setCurrentUser(user);

      const sessionInfo: Partial<Session> = {
        id: sessionId as string,
        creatorId: user.userId,
        creatorName: user.fullName || user.username,
        participantId: '',
        participantName: '',
        createdAt: Date.now(),
        lastActivity: Date.now(),
        sessionName: `Chat Session - ${user.fullName || user.username}`,
      };

      setSessionData(sessionInfo);

      const qrData = JSON.stringify({
        sessionId: sessionInfo.id, // Use sessionInfo.id to match the Session interface
        creatorId: user.userId,
        creatorName: user.fullName || user.username,
      });
      setQrValue(qrData);

      // Call the corrected createSession method
      await DatabaseService.createSession({
        id: sessionId as string,
        creatorId: user.userId,
        participantId: '',
        creatorName: user.fullName || user.username,
        participantName: '',
        sessionName: `Chat Session - ${user.fullName || user.username}`,
      });


      SocketService.connect(user.userId, user.fullName || user.username);
      await SocketService.createQRSession(sessionId as string, {
        userId: user.userId,
        username: user.username, // Pass username instead of creatorName
      });

      setWaitingForParticipant(true);
      setLoading(false);
    } catch (error: any) {
      console.error('Error initializing session:', error);
      Alert.alert('Error', `Failed to create session: ${error.message || 'Unknown error'}`);
      setLoading(false);
      SocketService.disconnect();
    }
  };

  const handleUserJoined = async (userData: {
    sessionId: string;
    participantId: string;
    participantName: string;
  }) => {
    if (userData.sessionId === sessionId) {
      try {
        // Update the existing session with participant info
        await DatabaseService.updateSessionWithParticipant(
          sessionId as string,
          userData.participantId,
          userData.participantName
        );

        setWaitingForParticipant(false);
        Alert.alert(
          'User Joined!',
          `${userData.participantName} has joined your chat session.`,
          [
            {
              text: 'Start Chatting',
              onPress: () => {
                router.replace({
                  pathname: '/(main)/chat/[sessionId]',
                  params: {
                    sessionId: sessionId as string,
                    userId: currentUser?.userId,
                    userName: currentUser?.fullName || currentUser?.username,
                    contactId: userData.participantId,
                    contactName: userData.participantName,
                  },
                });
              },
            },
          ]
        );
      } catch (error: any) {
        console.error('Error updating session:', error);
        Alert.alert('Error', `Failed to update session: ${error.message || 'Unknown error'}`);
      }
    }
  };

  const handleShareQR = async () => {
    try {
      const message = `Join my chat session! Scan this QR code or use session ID: ${sessionId}`;
      await Share.share({
        message,
        title: 'Join Chat Session',
      });
    } catch (error) {
      console.error('Error sharing QR:', error);
      Alert.alert('Error', 'Failed to share QR code');
    }
  };

  const handleManualEntry = () => {
    Alert.alert(
      'Session ID',
      `Share this session ID with someone to join manually:\n\n${sessionId}`,
      [
        {
          text: 'Copy',
          onPress: () => {
            // In a real app, you'd use Clipboard API (e.g., expo-clipboard)
            Alert.alert('Copied!', 'Session ID copied to clipboard');
          },
        },
        { text: 'OK' },
      ]
    );
  };

  const handleGoHome = async () => {
    try {
      await DatabaseService.updateSessionActivity(sessionId as string);
      SocketService.leaveSession(sessionId as string);
      router.replace('/(main)/home');
    } catch (error) {
      console.error('Error leaving session:', error);
      router.replace('/(main)/home');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Creating session...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleGoHome}>
          <MaterialIcons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Share QR Code</Text>
        <TouchableOpacity style={styles.shareButton} onPress={handleShareQR}>
          <MaterialIcons name="share" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.qrContainer}>
          <Text style={styles.title}>Scan to Join Chat</Text>
          <Text style={styles.subtitle}>
            Show this QR code to someone nearby to start chatting
          </Text>

          <View style={styles.qrCodeWrapper}>
            <QRCodeGenerator
              value={qrValue}
              size={250}
              backgroundColor="white"
              color="black"
            />
          </View>

          {waitingForParticipant && (
            <View style={styles.waitingContainer}>
              <ActivityIndicator size="small" color="#007AFF" />
              <Text style={styles.waitingText}>Waiting for someone to join...</Text>
            </View>
          )}

          <Text style={styles.userInfo}>
            Session created by: {currentUser?.fullName || currentUser?.username}
          </Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionButton} onPress={handleManualEntry}>
            <MaterialIcons name="dialpad" size={24} color="#007AFF" />
            <Text style={styles.actionText}>Manual Entry</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={handleShareQR}>
            <MaterialIcons name="share" size={24} color="#007AFF" />
            <Text style={styles.actionText}>Share QR</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/(main)/qr-scanner')}
          >
            <MaterialIcons name="qr-code-scanner" size={24} color="#007AFF" />
            <Text style={styles.actionText}>Scan QR</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.instructions}>
        <View style={styles.instructionItem}>
          <MaterialIcons name="smartphone" size={20} color="#666" />
          <Text style={styles.instructionText}>
            Open camera app or QR scanner on another device
          </Text>
        </View>
        <View style={styles.instructionItem}>
          <MaterialIcons name="center-focus-strong" size={20} color="#666" />
          <Text style={styles.instructionText}>
            Point camera at the QR code above
          </Text>
        </View>
        <View style={styles.instructionItem}>
          <MaterialIcons name="chat" size={20} color="#666" />
          <Text style={styles.instructionText}>
            Start chatting instantly once they join!
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
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
  header: {
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
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  shareButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  qrContainer: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 22,
  },
  qrCodeWrapper: {
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 20,
  },
  waitingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  waitingText: {
    marginLeft: 12,
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
  userInfo: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginTop: 10,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    marginTop: 30,
  },
  actionButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  actionText: {
    fontSize: 12,
    color: '#007AFF',
    marginTop: 4,
    fontWeight: '500',
  },
  instructions: {
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginBottom: 30,
    borderRadius: 12,
    padding: 20,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  instructionText: {
    marginLeft: 12,
    fontSize: 14,
    color: '#666',
    flex: 1,
    lineHeight: 20,
  },
});