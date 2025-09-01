// components/ToastConfig.tsx
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';

const { width } = Dimensions.get('window');

export const toastConfig = {
  info: ({ text1, text2, onPress, props, hide }: any) => (
    <TouchableOpacity
      style={styles.toastContainer}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <View style={styles.toastContent}>
        <View style={styles.iconContainer}>
          <Ionicons name="chatbubble" size={20} color={Colors.primary} />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.text1} numberOfLines={1}>
            {text1}
          </Text>
          <Text style={styles.text2} numberOfLines={2}>
            {text2}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => {
            hide();
            props?.onClose?.();
          }}
        >
          <Ionicons name="close" size={18} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  ),

  success: ({ text1, text2, onPress, hide }: any) => (
    <TouchableOpacity
      style={[styles.toastContainer, styles.successContainer]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <View style={styles.toastContent}>
        <View style={[styles.iconContainer, styles.successIconContainer]}>
          <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.text1} numberOfLines={1}>
            {text1}
          </Text>
          {text2 && (
            <Text style={styles.text2} numberOfLines={2}>
              {text2}
            </Text>
          )}
        </View>
        <TouchableOpacity style={styles.closeButton} onPress={hide}>
          <Ionicons name="close" size={18} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  ),

  error: ({ text1, text2, onPress, hide }: any) => (
    <TouchableOpacity
      style={[styles.toastContainer, styles.errorContainer]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <View style={styles.toastContent}>
        <View style={[styles.iconContainer, styles.errorIconContainer]}>
          <Ionicons name="alert-circle" size={20} color={Colors.error} />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.text1} numberOfLines={1}>
            {text1}
          </Text>
          {text2 && (
            <Text style={styles.text2} numberOfLines={2}>
              {text2}
            </Text>
          )}
        </View>
        <TouchableOpacity style={styles.closeButton} onPress={hide}>
          <Ionicons name="close" size={18} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  ),

  permission: ({ text1, text2, onAccept, onDecline, hide }: any) => (
    <View style={[styles.toastContainer, styles.permissionContainer]}>
      <View style={styles.toastContent}>
        <View style={styles.iconContainer}>
          <Ionicons name="shield-checkmark" size={20} color={Colors.primary} />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.text1} numberOfLines={1}>
            {text1}
          </Text>
          <Text style={styles.text2} numberOfLines={2}>
            {text2}
          </Text>
        </View>
      </View>
      <View style={styles.permissionActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.declineButton]}
          onPress={() => {
            hide();
            onDecline?.();
          }}
        >
          <Text style={styles.declineButtonText}>Decline</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.acceptButton]}
          onPress={() => {
            hide();
            onAccept?.();
          }}
        >
          <Text style={styles.acceptButtonText}>Accept</Text>
        </TouchableOpacity>
      </View>
    </View>
  ),
};

const styles = StyleSheet.create({
  toastContainer: {
    width: width - 40,
    marginHorizontal: 20,
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 16,
    marginTop: Platform.OS === 'ios' ? 10 : 20,
    // Shadow for iOS
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  successContainer: {
    borderLeftColor: Colors.success,
  },
  errorContainer: {
    borderLeftColor: Colors.error,
  },
  permissionContainer: {
    borderLeftColor: Colors.primary,
    paddingBottom: 12,
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconContainer: {
    marginRight: 12,
    marginTop: 2,
  },
  successIconContainer: {
    // Additional styling for success icon if needed
  },
  errorIconContainer: {
    // Additional styling for error icon if needed
  },
  textContainer: {
    flex: 1,
    marginRight: 8,
  },
  text1: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  text2: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  closeButton: {
    padding: 4,
  },
  permissionActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 70,
    alignItems: 'center',
  },
  declineButton: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  acceptButton: {
    backgroundColor: Colors.primary,
  },
  declineButtonText: {
    color: Colors.textSecondary,
    fontWeight: '600',
    fontSize: 14,
  },
  acceptButtonText: {
    color: Colors.textLight,
    fontWeight: '600',
    fontSize: 14,
  },
});