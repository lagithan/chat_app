import { useEffect } from 'react';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, ActivityIndicator } from 'react-native';
import { Colors } from '@/constants/Colors';

export default function Index() {
  useEffect(() => {
    checkFirstTimeUser();
  }, []);

  const checkFirstTimeUser = async () => {
    try {
      const userProfile = await AsyncStorage.getItem('userProfile');
      if (userProfile) {
        router.replace('/(tabs)/chat');
      } else {
        router.replace('/onboarding/setup');
      }
    } catch (error) {
      console.error('Error checking user profile:', error);
      router.replace('/onboarding/setup');
    }
  };

  return (
    <View style={{ 
      flex: 1, 
      justifyContent: 'center', 
      alignItems: 'center',
      backgroundColor: Colors.primary 
    }}>
      <ActivityIndicator size="large" color={Colors.textLight} />
    </View>
  );
}
