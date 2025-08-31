// app/(tabs)/qr.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  Modal,
  Vibration,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { CameraView, Camera } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { Colors } from '@/constants/Colors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { FirestoreService } from '@/services/firebase/firestore';
import { DatabaseService } from '@/services/database/sqlite';
import { useFocusEffect } from '@react-navigation/native';

export default function QRTab() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanning, setScanning] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [qrValue, setQrValue] = useState('');
  const [userProfile, setUserProfile] = useState<any>(null);
  const [sessionId, setSessionId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const db = DatabaseService.getInstance();

  useEffect(() => {
    requestPermissions();
    loadUserProfile();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      setQrValue('');
      setSessionId('');
      setScanning(false);
      setLoading(false);
    }, [])
  );

  const requestPermissions = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    setHasPermission(status === 'granted');
  };

  const loadUserProfile = async () => {
    try {
      const profile = await AsyncStorage.getItem('userProfile');
      if (profile) {
        setUserProfile(JSON.parse(profile));
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const generateQR = async () => {
    if (!userProfile) {
      Alert.alert('Error', 'User profile not found');
      return;
    }

    setGenerating(true);
    try {
      // Create session in Firebase (no expiration)
      const newSessionId = await FirestoreService.createQRSession(
        userProfile.id,
        userProfile.name
      );

      const sessionData = {
        type: 'chat_session',
        sessionId: newSessionId,
        hostId: userProfile.id,
        hostName: userProfile.name,
        timestamp: new Date().toISOString(),
      };

      setSessionId(newSessionId);
      setQrValue(JSON.stringify(sessionData));
    } catch (error) {
      console.error('Error generating QR:', error);
      Alert.alert('Error', 'Failed to generate QR code');
    } finally {
      setGenerating(false);
    }
  };

  const handleQRScan = async (data: string) => {
  if (loading) return; // Prevent multiple scans
  
  setLoading(true);
  
  try {
    const sessionData = JSON.parse(data);
    
    if (sessionData.type === 'chat_session') {
      Vibration.vibrate(100);
      
      // Check if user is trying to scan their own QR
      if (sessionData.hostId === userProfile?.id) {
        Alert.alert(
          'Error', 
          'You cannot join your own chat session',
          [
            {
              text: 'OK',
              onPress: () => {
                setLoading(false);
                setScanning(false);
              }
            }
          ]
        );
        return;
      }
      
      // Show connection request modal
      Alert.alert(
        'Chat Request',
        `${sessionData.hostName} wants to start a chat with you. Accept?`,
        [
          {
            text: 'Decline',
            style: 'cancel',
            onPress: () => {
              setLoading(false);
              setScanning(false);
            }
          },
          {
            text: 'Accept',
            onPress: () => {
              setScanning(false);
              joinChatSession(sessionData);
            }
          }
        ]
      );
    } else {
      Alert.alert(
        'Error', 
        'Invalid QR code format',
        [
          {
            text: 'OK',
            onPress: () => {
              setLoading(false);
              setScanning(false);
            }
          }
        ]
      );
    }
  } catch (error) {
    console.error('Error parsing QR code:', error);
    Alert.alert(
      'Error', 
      'Invalid QR code',
      [
        {
          text: 'OK',
          onPress: () => {
            setLoading(false);
            setScanning(false);
          }
        }
      ]
    );
  }
};

const joinChatSession = async (sessionData: any) => {
  try {
    if (!userProfile) {
      Alert.alert('Error', 'User profile not found');
      return;
    }

    // Create chat from session in Firebase
    const chatId = await FirestoreService.createChatFromSession(
      sessionData.sessionId,
      userProfile.id,
      userProfile.name
    );

    // Save chat to SQLite local database
    const chatData = {
      id: chatId,
      participants: [sessionData.hostId, userProfile.id],
      participantNames: {
        [sessionData.hostId]: sessionData.hostName,
        [userProfile.id]: userProfile.name
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: true
    };
    
    await db.saveChat(chatData);

    // Navigate to chat
    router.push(`/chat/${chatId}`);
  } catch (error: any) {
    console.error('Error joining chat session:', error);
    let errorMsg = 'Failed to join chat session. Please try again.';
    if (error?.message === 'Session not found') {
      errorMsg = 'Chat session not found or already used. Please scan a new QR code.';
    }
    Alert.alert('Error', errorMsg);
  } finally {
    setLoading(false);
  }
};

  const closeQRCode = () => {
    setQrValue('');
    setSessionId('');
  };

  if (hasPermission === null) {
    return (
      <View style={styles.container}>
        <Text>Requesting camera permission...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>No access to camera</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermissions}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>QR Code</Text>
      </View>

      <View style={styles.content}>
        {qrValue && !scanning ? (
          <View style={styles.qrContainer}>
            <Text style={styles.qrTitle}>Share this QR code to start chatting</Text>
            <View style={styles.qrWrapper}>
              <QRCode
                value={qrValue}
                size={200}
                color={Colors.primary}
                backgroundColor={Colors.background}
              />
            </View>
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={closeQRCode}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.placeholderContainer}>
            <Ionicons name="qr-code-outline" size={80} color={Colors.textSecondary} />
            <Text style={styles.placeholderTitle}>Ready to Connect?</Text>
            <Text style={styles.placeholderText}>
              Generate a QR code to share or scan one to join a chat session.
            </Text>
          </View>
        )}
      </View>

      <View style={styles.bottomActions}>
        <TouchableOpacity 
          style={[styles.actionButton, styles.generateButton]}
          onPress={generateQR}
          disabled={generating}
        >
          {generating ? (
            <ActivityIndicator color={Colors.textLight} />
          ) : (
            <Ionicons name="qr-code" size={32} color={Colors.textLight} />
          )}
          <Text style={styles.actionButtonText}>
            {generating ? 'Generating...' : 'Generate QR'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.actionButton, styles.scanButton]}
          onPress={() => setScanning(true)}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={Colors.primary} />
          ) : (
            <Ionicons name="scan" size={32} color={Colors.primary} />
          )}
          <Text style={[styles.actionButtonText, { color: Colors.primary }]}>
            {loading ? 'Joining...' : 'Scan QR'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* QR Scanner Modal */}
      <Modal
        visible={scanning}
        animationType="slide"
        statusBarTranslucent
      >
        <View style={styles.scannerContainer}>
          {/* Camera View */}
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{
              barcodeTypes: ['qr'],
            }}
            onBarcodeScanned={({ data }) => {
              if (!loading) {
                handleQRScan(data);
              }
            }}
          />
          
          {/* Overlay positioned outside camera */}
          <View style={styles.overlay}>
            <Text style={styles.scanText}>
              {loading ? 'Processing...' : 'Scan QR code to join chat'}
            </Text>
            <View style={styles.scanArea} />
            {loading && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color={Colors.textLight} />
                <Text style={styles.loadingText}>Joining chat...</Text>
              </View>
            )}
          </View>
          
          {/* Close button */}
          <TouchableOpacity 
            style={styles.closeScanButton}
            onPress={() => {
              setScanning(false);
              setLoading(false);
            }}
            disabled={loading}
          >
            <Ionicons name="close" size={32} color={Colors.textLight} />
          </TouchableOpacity>
        </View>
      </Modal>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
  },
  notificationButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderContainer: {
    alignItems: 'center',
    padding: 40,
  },
  placeholderTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
    marginTop: 20,
    marginBottom: 10,
  },
  placeholderText: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    maxWidth: 280,
  },
  bottomActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopColor: Colors.border,
    // Only show shadows on iOS, not Android
    ...(Platform.OS === 'ios' && {
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    }),
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 16,
    marginHorizontal: 8,
    // Only show shadows on iOS, not Android
    ...(Platform.OS === 'ios' && {
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    }),
  },
  generateButton: {
    backgroundColor: Colors.primary,
  },
  scanButton: {
    backgroundColor: Colors.background,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
    color: Colors.textLight,
  },
  qrContainer: {
    alignItems: 'center',
    borderRadius: 20,
    padding: 30,
    // Only show shadows on iOS, not Android
    ...(Platform.OS === 'ios' && {
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    }),
  },
  qrTitle: {
    fontSize: 16,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 20,
  },
  qrWrapper: {
    padding: 20,
    backgroundColor: Colors.background,
    borderRadius: 16,
    marginBottom: 20,
    // Only show shadows on iOS, not Android
    ...(Platform.OS === 'ios' && {
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
    }),
  },
  closeButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  closeButtonText: {
    color: Colors.textLight,
    fontWeight: '600',
  },
  scannerContainer: {
    flex: 1,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanText: {
    color: Colors.textLight,
    fontSize: 18,
    marginBottom: 40,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  scanArea: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: Colors.primary,
    borderRadius: 20,
  },
  loadingOverlay: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: Colors.textLight,
    fontSize: 16,
    marginTop: 16,
  },
  closeScanButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 8,
  },
  errorText: {
    fontSize: 16,
    color: Colors.error,
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: Colors.textLight,
    fontWeight: '600',
  },
});