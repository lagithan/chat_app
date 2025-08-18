import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Colors } from '@/constants/Colors';

interface TypingIndicatorProps {
  visible: boolean;
  userName?: string;
}

export default function TypingIndicator({ visible, userName = 'Someone' }: TypingIndicatorProps) {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      startAnimation();
    } else {
      stopAnimation();
    }
  }, [visible]);

  const startAnimation = () => {
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

    animation.start();
  };

  const stopAnimation = () => {
    dot1.setValue(0);
    dot2.setValue(0);
    dot3.setValue(0);
  };

  if (!visible) return null;

  return (
    <View style={styles.container}>
      <View style={styles.bubble}>
        <Text style={styles.text}>{userName} is typing</Text>
        <View style={styles.dotsContainer}>
          <Animated.View
            style={[
              styles.dot,
              {
                opacity: dot1,
                transform: [
                  {
                    scale: dot1.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.8, 1.2],
                    }),
                  },
                ],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.dot,
              {
                opacity: dot2,
                transform: [
                  {
                    scale: dot2.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.8, 1.2],
                    }),
                  },
                ],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.dot,
              {
                opacity: dot3,
                transform: [
                  {
                    scale: dot3.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.8, 1.2],
                    }),
                  },
                ],
              },
            ]}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.otherMessage,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-start',
    maxWidth: '80%',
  },
  text: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginRight: 8,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.typing,
    marginHorizontal: 1,
  },
});
