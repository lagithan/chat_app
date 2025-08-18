 import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import AuthService from '../../services/AuthService';

export default function Welcome() {
  const [fadeAnim] = useState(new Animated.Value(0));
  const [isFirstTime, setIsFirstTime] = useState(true);

  useEffect(() => {
    checkUserStatus();
    
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();
  }, []);

  const checkUserStatus = async () => {
    try {
      const firstTime = await AuthService.isFirstTimeUser();
      setIsFirstTime(firstTime);
      
      // If user is logged in, go to main app
      const loggedIn = await AuthService.isLoggedIn();
      if (loggedIn) {
        router.replace('/(main)/home');
      }
    } catch (error) {
      console.error('Error checking user status:', error);
    }
  };

  const handleGetStarted = () => {
    if (isFirstTime) {
      router.push('/(auth)/profile-setup');
    } else {
      router.push('/(auth)/login');
    }
  };

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        <View style={styles.logoContainer}>
          <View style={styles.logo}>
            <MaterialIcons name="chat" size={80} color="#007AFF" />
          </View>
          <Text style={styles.title}>Quick Chat</Text>
          <Text style={styles.subtitle}>
            Connect instantly with anyone using QR codes
          </Text>
        </View>

        <View style={styles.features}>
          <View style={styles.feature}>
            <MaterialIcons name="qr-code-scanner" size={24} color="#007AFF" />
            <Text style={styles.featureText}>Scan QR codes to connect</Text>
          </View>
          <View style={styles.feature}>
            <MaterialIcons name="flash-on" size={24} color="#007AFF" />
            <Text style={styles.featureText}>Instant messaging</Text>
          </View>
          <View style={styles.feature}>
            <MaterialIcons name="history" size={24} color="#007AFF" />
            <Text style={styles.featureText}>Chat history</Text>
          </View>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleGetStarted}
          >
            <Text style={styles.primaryButtonText}>
              {isFirstTime ? 'Get Started' : 'Login'}
            </Text>
          </TouchableOpacity>

          {!isFirstTime && (
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => router.push('/(auth)/profile-setup')}
            >
              <Text style={styles.secondaryButtonText}>Create New Account</Text>
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 30,
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 60,
  },
  logo: {
    width: 120,
    height: 120,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  features: {
    marginVertical: 40,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  featureText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 15,
  },
  buttonContainer: {
    marginBottom: 30,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 25,
    alignItems: 'center',
    marginBottom: 15,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  secondaryButton: {
    borderWidth: 2,
    borderColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 25,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
