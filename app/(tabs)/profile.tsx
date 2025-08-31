import React, { useState, useEffect } from 'react';
import { DatabaseService } from '@/services/database/sqlite';
import { FirestoreService } from '@/services/firebase/firestore';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Image,
  TouchableOpacity,
  Alert,
  ScrollView,
  Modal,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';

interface UserProfile {
  id: string;
  name: string;
  deviceId: string;
  profileImage?: string;
  status?: string;
}

export default function ProfileTab() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editLoading, setSaveLoading] = useState(false);
  
  // Edit form state
  const [editName, setEditName] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editProfileImage, setEditProfileImage] = useState<string | undefined>('');

  useEffect(() => {
    loadUserProfile();
    requestPermissions();
  }, []);

  const requestPermissions = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Sorry, we need camera roll permissions to change your profile photo.'
        );
      }
    }
  };

  const loadUserProfile = async () => {
    try {
      const profile = await AsyncStorage.getItem('userProfile');
      if (profile) {
        const parsedProfile = JSON.parse(profile);
        setUserProfile(parsedProfile);
        
        // Initialize edit form with current values
        setEditName(parsedProfile.name || '');
        setEditStatus(parsedProfile.status || 'Available');
        setEditProfileImage(parsedProfile.profileImage || '');
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditProfile = () => {
    if (userProfile) {
      setEditName(userProfile.name);
      setEditStatus(userProfile.status || 'Available');
      setEditProfileImage(userProfile.profileImage || '');
      setEditModalVisible(true);
    }
  };

  const handleImagePicker = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: false,
      });

      if (!result.canceled && result.assets[0]) {
        setEditProfileImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const handleRemoveImage = () => {
    setEditProfileImage('');
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }

    setSaveLoading(true);
    try {
      const updatedProfile: UserProfile = {
        ...userProfile!,
        name: editName.trim(),
        status: editStatus.trim() || 'Available',
        profileImage: editProfileImage || undefined,
      };

      // Save to AsyncStorage
      await AsyncStorage.setItem('userProfile', JSON.stringify(updatedProfile));

      // Save to local SQLite database
      const db = DatabaseService.getInstance();
      await db.saveUserProfile(updatedProfile);

      

      setUserProfile(updatedProfile);
      setEditModalVisible(false);
      
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleCancelEdit = () => {
    // Reset form to original values
    if (userProfile) {
      setEditName(userProfile.name);
      setEditStatus(userProfile.status || 'Available');
      setEditProfileImage(userProfile.profileImage || '');
    }
    setEditModalVisible(false);
  };

  const handleLogout = () => {
    Alert.alert(
      'Reset App',
      'This will clear all your data and chats. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              // Clear AsyncStorage
              await AsyncStorage.clear();
              
              // Reset SQLite database
              const db = DatabaseService.getInstance();
              await db.resetDatabase(); // This will drop and recreate tables
              
              // Navigate to onboarding
              router.replace('/onboarding/setup');
            } catch (error) {
              console.error('Error clearing data:', error);
              Alert.alert('Error', 'Failed to reset app data. Please try again.');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (!userProfile) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Profile not found</Text>
        <TouchableOpacity 
          style={styles.button}
          onPress={() => router.replace('/onboarding/setup')}
        >
          <Text style={styles.buttonText}>Setup Profile</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
        <TouchableOpacity 
          style={styles.editButton}
          onPress={handleEditProfile}
        >
          <Ionicons name="create-outline" size={24} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Section */}
        <View style={styles.profileSection}>
          <View style={styles.profileImageContainer}>
            {userProfile.profileImage ? (
              <Image 
                source={{ uri: userProfile.profileImage }} 
                style={styles.profileImage} 
              />
            ) : (
              <View style={styles.placeholderImage}>
                <Text style={styles.placeholderText}>
                  {userProfile.name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>
          
          <Text style={styles.userName}>{userProfile.name}</Text>
          <Text style={styles.userStatus}>{userProfile.status || 'Available'}</Text>
        </View>

        {/* About Section */}
        <View style={styles.aboutSection}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.aboutItem}>
            <Text style={styles.aboutLabel}>Version</Text>
            <Text style={styles.aboutValue}>1.0.0</Text>
          </View>
          <View style={styles.aboutItem}>
            <Text style={styles.aboutLabel}>Device ID</Text>
            <Text style={styles.aboutValue}>{userProfile.deviceId}</Text>
          </View>
          <View style={styles.aboutItem}>
            <Text style={styles.aboutLabel}>User ID</Text>
            <Text style={styles.aboutValue}>{userProfile.id}</Text>
          </View>
        </View>

        {/* Reset Button */}
        <TouchableOpacity style={styles.resetButton} onPress={handleLogout}>
          <Ionicons name="refresh" size={20} color={Colors.background} />
          <Text style={styles.resetButtonText}>Reset App Data</Text>
        </TouchableOpacity>

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={editModalVisible}
        onRequestClose={handleCancelEdit}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={handleCancelEdit}>
                <Text style={styles.cancelButton}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity 
                onPress={handleSaveProfile}
                disabled={editLoading}
              >
                {editLoading ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                  <Text style={styles.saveButton}>Save</Text>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* Profile Image Section */}
              <View style={styles.editImageSection}>
                <Text style={styles.fieldLabel}>Profile Photo</Text>
                <View style={styles.imageEditContainer}>
                  {editProfileImage ? (
                    <Image 
                      source={{ uri: editProfileImage }} 
                      style={styles.editProfileImage} 
                    />
                  ) : (
                    <View style={styles.editPlaceholderImage}>
                      <Text style={styles.editPlaceholderText}>
                        {editName.charAt(0).toUpperCase() || '?'}
                      </Text>
                    </View>
                  )}
                  
                  <View style={styles.imageButtons}>
                    <TouchableOpacity 
                      style={styles.imageButton}
                      onPress={handleImagePicker}
                    >
                      <Ionicons name="camera" size={20} color={Colors.primary} />
                      <Text style={styles.imageButtonText}>
                        {editProfileImage ? 'Change' : 'Add Photo'}
                      </Text>
                    </TouchableOpacity>
                    
                    {editProfileImage && (
                      <TouchableOpacity 
                        style={styles.removeImageButton}
                        onPress={handleRemoveImage}
                      >
                        <Ionicons name="trash" size={20} color={Colors.error} />
                        <Text style={styles.removeImageButtonText}>Remove</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>

              {/* Name Field */}
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Name</Text>
                <TextInput
                  style={styles.textInput}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Enter your name"
                  placeholderTextColor={Colors.textSecondary}
                  maxLength={50}
                />
              </View>

            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: Colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  errorText: {
    fontSize: 16,
    color: Colors.error,
    marginBottom: 20,
  },
  button: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: Colors.textLight,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
  },
  editButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 30,
    backgroundColor: Colors.surface,
    marginBottom: 20,
  },
  profileImageContainer: {
    marginBottom: 16,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  placeholderImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: Colors.textLight,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
  },
  userStatus: {
    fontSize: 14,
    color: Colors.success,
  },
  aboutSection: {
    backgroundColor: Colors.background,
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    elevation: 2,
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 16,
  },
  aboutItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  aboutLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  aboutValue: {
    fontSize: 14,
    color: Colors.text,
    fontFamily: 'monospace',
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 0,
    backgroundColor: Colors.error,
  },
  resetButtonText: {
    color: Colors.background,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  bottomPadding: {
    height: 40,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    minHeight: '60%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  cancelButton: {
    color: Colors.textSecondary,
    fontSize: 16,
  },
  saveButton: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  modalBody: {
    flex: 1,
    padding: 20,
  },
  editImageSection: {
    marginBottom: 24,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 12,
  },
  imageEditContainer: {
    alignItems: 'center',
  },
  editProfileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
  },
  editPlaceholderImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  editPlaceholderText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: Colors.textLight,
  },
  imageButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  imageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
    gap: 6,
  },
  imageButtonText: {
    color: Colors.primary,
    fontWeight: '500',
  },
  removeImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.error,
    gap: 6,
  },
  removeImageButtonText: {
    color: Colors.error,
    fontWeight: '500',
  },
  fieldContainer: {
    marginBottom: 20,
  },
  textInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.text,
    backgroundColor: Colors.surface,
  },
});