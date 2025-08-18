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
} from 'react-native';
import { CameraView, Camera } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { Colors } from '@/constants/Colors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

export default function QRTab() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanning, setScanning] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [qrValue, setQrValue] = useState('');
  const [userProfile, setUserProfile] = useState<any>(null);

  useEffect(() => {
    requestPermissions();
    loadUserProfile();
  }, []);

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

  const generateQR = () => {
    if (!userProfile) return;
    
    const sessionData = {
      type: 'chat_session',
      hostId: userProfile.id,
      hostName: userProfile.name,
      sessionId: `session_${Date.now()}`,
      timestamp: new Date().toISOString(),
    };
    
    setQrValue(JSON.stringify(sessionData));
    setGenerating(true);
  };

  const handleQRScan = (data: string) => {
    try {
      const sessionData = JSON.parse(data);
      
      if (sessionData.type === 'chat_session') {
        Vibration.vibrate(100);
        setScanning(false);
        
        // Show connection request modal
        Alert.alert(
          'Chat Request',
          `${sessionData.hostName} wants to start a chat with you. Accept?`,
          [
            { text: 'Decline', style: 'cancel' },
            { 
              text: 'Accept', 
              onPress: () => joinChatSession(sessionData)
            }
          ]
        );
      }
    } catch (error) {
      Alert.alert('Error', 'Invalid QR code');
    }
  };

  const joinChatSession = async (sessionData: any) => {
    try {
      // Create chat room
      const chatId = `chat_${sessionData.sessionId}`;
      const chatData = {
        id: chatId,
        participants: [userProfile.id, sessionData.hostId],
        participantNames: {
          [userProfile.id]: userProfile.name,
          [sessionData.hostId]: sessionData.hostName
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Save to local storage
      const existingChats = await AsyncStorage.getItem('chats');
      const chats = existingChats ? JSON.parse(existingChats) : [];
      chats.unshift(chatData);
      await AsyncStorage.setItem('chats', JSON.stringify(chats));

      // Navigate to chat
      router.push(`/chat/${chatId}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to join chat session');
    }
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
        <TouchableOpacity style={styles.notificationButton}>
          <Ionicons name="notifications-outline" size={24} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.generateButton]}
            onPress={generateQR}
          >
            <Ionicons name="qr-code" size={32} color={Colors.textLight} />
            <Text style={styles.actionButtonText}>Generate QR</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionButton, styles.scanButton]}
            onPress={() => setScanning(true)}
          >
            <Ionicons name="scan" size={32} color={Colors.primary} />
            <Text style={[styles.actionButtonText, { color: Colors.primary }]}>Scan QR</Text>
          </TouchableOpacity>
        </View>

        {qrValue && !scanning && (
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
              onPress={() => setQrValue('')}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* QR Scanner Modal */}
      <Modal
        visible={scanning}
        animationType="slide"
        statusBarTranslucent
      >
        <View style={styles.scannerContainer}>
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{
              barcodeTypes: ['qr'],
            }}
            onBarcodeScanned={({ data }) => handleQRScan(data)}
          >
            <View style={styles.overlay}>
              <Text style={styles.scanText}>Scan QR code to join chat</Text>
              <View style={styles.scanArea} />
            </View>
          </CameraView>
          
          <TouchableOpacity 
            style={styles.closeScanButton}
            onPress={() => setScanning(false)}
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
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 40,
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    marginHorizontal: 8,
  },
  generateButton: {
    backgroundColor: Colors.primary,
  },
  scanButton: {
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
    color: Colors.textLight,
  },
  qrContainer: {
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 30,
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
  },
  closeButton: {
    backgroundColor: Colors.textSecondary,
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
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanText: {
    color: Colors.textLight,
    fontSize: 18,
    marginBottom: 40,
    textAlign: 'center',
  },
  scanArea: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: Colors.primary,
    borderRadius: 20,
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