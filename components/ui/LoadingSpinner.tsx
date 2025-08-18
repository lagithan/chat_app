import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  color?: string;
}

export default function LoadingSpinner({ 
  size = 'medium', 
  color = Colors.primary 
}: LoadingSpinnerProps) {
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animate = () => {
      rotateAnim.setValue(0);
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }).start(() => animate());
    };
    animate();
  }, []);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const getSize = () => {
    switch (size) {
      case 'small': return 20;
      case 'large': return 40;
      default: return 30;
    }
  };

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.spinner,
          {
            width: getSize(),
            height: getSize(),
            borderColor: color + '30',
            borderTopColor: color,
            transform: [{ rotate: spin }],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  spinner: {
    borderWidth: 2,
    borderRadius: 50,
  },
});
