// app/_layout.tsx
import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, Text } from 'react-native';
import { Colors } from '@/constants/Colors';
import { DatabaseService } from '@/services/database/sqlite';
import { initializeUser, getCurrentUserProfile } from '@/services/firebase/config';


export default function RootLayout() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Initialize notifications
  // const { requestPermissions } = useNotifications();

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      console.log('Initializing app...');
      
      // Initialize SQLite database
      const db = DatabaseService.getInstance();
      console.log('Database initialized');

      // Initialize Firebase and user authentication
      await initializeUser();
      console.log('Firebase user initialized');

      // // Request notification permissions
      // // const permissionGranted = await requestPermissions();
      // if (permissionGranted) {
      //   console.log('Notification permissions granted');
      // } else {
      //   console.log('Notification permissions denied');
      // }

      
      setIsInitialized(true);
      console.log('App initialization completed');
      
    } catch (error) {
      console.error('App initialization error:', error);
      setError(error instanceof Error ? error.message : 'Unknown initialization error');
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading screen during initialization
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar style="light" backgroundColor={Colors.primary} />
        <ActivityIndicator size="large" color={Colors.textLight} />
        <Text style={styles.loadingText}>Initializing...</Text>
      </View>
    );
  }

  // Show error screen if initialization failed
  if (error) {
    return (
      <View style={styles.errorContainer}>
        <StatusBar style="dark" />
        <Text style={styles.errorTitle}>Initialization Failed</Text>
        <Text style={styles.errorText}>{error}</Text>
        <Text style={styles.errorSubtext}>Please restart the app</Text>
      </View>
    );
  }

  // Main app navigation
  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen 
          name="chat/[id]" 
          options={{
            presentation: 'card',
            animation: 'slide_from_right'
          }}
        />
      </Stack>
    </>
  );
}

const styles = {
  loadingContainer: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    backgroundColor: Colors.primary,
  },
  loadingText: {
    color: Colors.textLight,
    fontSize: 16,
    marginTop: 16,
    fontWeight: '500' as const,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    backgroundColor: Colors.background,
    paddingHorizontal: 40,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold' as const,
    color: Colors.error,
    marginBottom: 16,
    textAlign: 'center' as const,
  },
  errorText: {
    fontSize: 16,
    color: Colors.text,
    textAlign: 'center' as const,
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
  },
};