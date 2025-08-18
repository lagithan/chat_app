 import { Tabs } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

export default function MainLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#666',
        headerStyle: {
          backgroundColor: '#007AFF',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="home" size={size} color={color} />
          ),
          headerTitle: 'Quick Chat',
        }}
      />
      <Tabs.Screen
        name="chat-history"
        options={{
          title: 'Chats',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="chat" size={size} color={color} />
          ),
          headerTitle: 'Chat History',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="person" size={size} color={color} />
          ),
          headerTitle: 'Profile',
        }}
      />
      
      {/* Hidden tabs - no tab bar icons */}
      <Tabs.Screen
        name="chat"
        options={{
          href: null, // Hide from tab bar
        }}
      />
      <Tabs.Screen
        name="qr-generator"
        options={{
          href: null, // Hide from tab bar
        }}
      />
      <Tabs.Screen
        name="qr-scanner"
        options={{
          href: null, // Hide from tab bar
          headerTitle: 'Scan QR Code',
        }}
      />
    </Tabs>
  );
}
