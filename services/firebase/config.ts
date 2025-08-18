// services/firebase/config.ts
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDgZUFTxstaFJQged_N_fSfoZY0VzH0wfI",
  authDomain: "qr-connect-65c84.firebaseapp.com",
  projectId: "qr-connect-65c84",
  storageBucket: "qr-connect-65c84.firebasestorage.app",
  messagingSenderId: "280643455321",
  appId: "1:280643455321:web:fb03a1d9318429d49d2448",
  measurementId: "G-VG7TY5P1QD"
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore
export const db = getFirestore(app);

// Initialize Auth
export const auth = getAuth(app);


// User profile interface
export interface UserProfile {
  id: string;
  name: string;
  profileImage?: string;
  deviceId: string;
  createdAt: string;
  lastSeen?: string;
  isOnline?: boolean;
}

// Initialize anonymous authentication and user profile
export const initializeUser = async (): Promise<UserProfile> => {
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (user) {
          // User is signed in, get or create profile
          let userProfile = await AsyncStorage.getItem('userProfile');
          
          if (!userProfile) {
            // Create new profile for existing anonymous user
            const profile: UserProfile = {
              id: user.uid,
              name: `User_${user.uid.slice(0, 6)}`,
              deviceId: `device_${Date.now()}`,
              createdAt: new Date().toISOString(),
              isOnline: true
            };
            
            await AsyncStorage.setItem('userProfile', JSON.stringify(profile));
            userProfile = JSON.stringify(profile);
          }
          
          const profile = JSON.parse(userProfile) as UserProfile;
          unsubscribe();
          resolve(profile);
        } else {
          // No user signed in, create anonymous user
          const result = await signInAnonymously(auth);
          const profile: UserProfile = {
            id: result.user.uid,
            name: `User_${result.user.uid.slice(0, 6)}`,
            deviceId: `device_${Date.now()}`,
            createdAt: new Date().toISOString(),
            isOnline: true
          };
          
          await AsyncStorage.setItem('userProfile', JSON.stringify(profile));
          unsubscribe();
          resolve(profile);
        }
      } catch (error) {
        unsubscribe();
        reject(error);
      }
    });
  });
};

// Get current user profile from storage
export const getCurrentUserProfile = async (): Promise<UserProfile | null> => {
  try {
    const profile = await AsyncStorage.getItem('userProfile');
    return profile ? JSON.parse(profile) : null;
  } catch (error) {
    console.error('Error getting user profile:', error);
    return null;
  }
};

// Update user profile
export const updateUserProfile = async (updates: Partial<UserProfile>): Promise<void> => {
  try {
    const currentProfile = await getCurrentUserProfile();
    if (currentProfile) {
      const updatedProfile = { ...currentProfile, ...updates };
      await AsyncStorage.setItem('userProfile', JSON.stringify(updatedProfile));
    }
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
};

// Sign out and clear profile
export const signOutUser = async (): Promise<void> => {
  try {
    await auth.signOut();
    await AsyncStorage.removeItem('userProfile');
  } catch (error) {
    console.error('Error signing out:', error);
    throw error;
  }
};

export default app;