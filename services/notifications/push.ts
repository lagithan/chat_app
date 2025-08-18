import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export class NotificationService {
  static async requestPermissions() {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      throw new Error('Permission not granted for notifications');
    }
    
    return finalStatus;
  }

  static async getExpoPushToken() {
    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#2563eb',
      });
    }

    const token = await Notifications.getExpoPushTokenAsync({
      projectId: 'your-expo-project-id', // Replace with your project ID
    });
    
    return token.data;
  }

  static async scheduleLocalNotification(title: string, body: string, data?: any) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true,
      },
      trigger: { seconds: 1 },
    });
  }

  static async showChatNotification(senderName: string, message: string, chatId: string) {
    await this.scheduleLocalNotification(
      senderName,
      message,
      { type: 'chat', chatId }
    );
  }

  static async showConnectionRequest(senderName: string) {
    await this.scheduleLocalNotification(
      'New Chat Request',
      `${senderName} wants to start a chat with you`,
      { type: 'connection_request' }
    );
  }
}

// utils/animations.ts
import { Animated, Easing } from 'react-native';

export class AnimationUtils {
  static createFadeInAnimation(animatedValue: Animated.Value, duration = 300) {
    return Animated.timing(animatedValue, {
      toValue: 1,
      duration,
      easing: Easing.ease,
      useNativeDriver: true,
    });
  }

  static createSlideUpAnimation(animatedValue: Animated.Value, duration = 300) {
    return Animated.timing(animatedValue, {
      toValue: 0,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
  }

  static createScaleAnimation(animatedValue: Animated.Value, toValue = 1, duration = 200) {
    return Animated.spring(animatedValue, {
      toValue,
      tension: 100,
      friction: 8,
      useNativeDriver: true,
    });
  }

  static createPulseAnimation(animatedValue: Animated.Value) {
    return Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1.1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
  }

  static createTypingAnimation() {
    const dot1 = new Animated.Value(0);
    const dot2 = new Animated.Value(0);
    const dot3 = new Animated.Value(0);

    const animateDot = (dot: Animated.Value, delay: number) => {
      return Animated.sequence([
        Animated.delay(delay),
        Animated.timing(dot, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(dot, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]);
    };

    const animation = Animated.loop(
      Animated.parallel([
        animateDot(dot1, 0),
        animateDot(dot2, 200),
        animateDot(dot3, 400),
      ])
    );

    return { dot1, dot2, dot3, animation };
  }
}
