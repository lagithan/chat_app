 import { useEffect } from 'react';
import { router } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import AuthService from '../services/AuthService';

export default function Index() {
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const isLoggedIn = await AuthService.isLoggedIn();
      
      if (isLoggedIn) {
        router.replace('/(main)/home');
      } else {
        const isFirstTime = await AuthService.isFirstTimeUser();
        if (isFirstTime) {
          router.replace('/(auth)/welcome');
        } else {
          router.replace('/(auth)/login');
        }
      }
    } catch (error) {
      console.error('Auth check error:', error);
      router.replace('/(auth)/welcome');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Loading Quick Chat...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  text: {
    fontSize: 18,
    color: '#666',
  },
});
