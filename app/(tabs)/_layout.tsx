import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { View, Platform, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function TabLayout() {
  return (
    <SafeAreaView 
      style={{ flex: 1, backgroundColor: Colors.background }}
      edges={['top']} // Only apply safe area to top
    >
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: Colors.primary,
          tabBarInactiveTintColor: Colors.textSecondary,
          headerShown: false,
          tabBarStyle: {
            backgroundColor: Colors.background,
            borderTopColor: Colors.border,
            height: Platform.OS === 'android' ? 100 : 80, // Extra height for Android
            paddingBottom: Platform.OS === 'android' ? 20 : 8, // Extra bottom padding
            paddingTop: 8,
          },
        }}
      >
        <Tabs.Screen
          name="qr"
          options={{
            title: 'QR Code',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="qr-code" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="chat"
          options={{
            title: 'Chats',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="chatbubbles" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="person" size={size} color={color} />
            ),
          }}
        />
      </Tabs>
    </SafeAreaView>
  );
}