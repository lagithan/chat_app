import React, { useRef } from 'react';
import { View, StyleSheet, Share, Alert } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import QRCode from 'react-native-qrcode-svg';

interface QRCodeGeneratorProps {
  value: string;
  size?: number;
  color?: string;
  backgroundColor?: string;
}

export default function QRCodeGenerator({
  value,
  size = 200,
  color = '#000000',
  backgroundColor = '#FFFFFF',
}: QRCodeGeneratorProps) {
  const qrRef = useRef(null);

  const shareQRCode = async () => {
    try {
      const uri = await captureRef(qrRef, {
        format: 'png',
        quality: 1.0,
      });
      
      await Share.share({
        url: uri,
        message: `Scan this QR code to join my chat session: ${value}`,
      });
    } catch (error) {
      console.error('Error sharing QR code:', error);
      Alert.alert('Error', 'Failed to share QR code');
    }
  };

  return (
    <View style={styles.container} ref={qrRef}>
      <QRCode
        value={value}
        size={size}
        color={color}
        backgroundColor={backgroundColor}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  svg: {
    borderRadius: 8,
  },
});