// services/firebase/config.ts
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "your-actual-api-key",
  authDomain: "your-project.firebaseapp.com", 
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Initialize user profile and authentication
export const initializeUser = async () => {
  return new Promise((resolve, reject) => {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Get or create user profile
        let userProfile = await AsyncStorage.getItem('userProfile');
        if (!userProfile) {
          // Create default profile
          const profile = {
            id: user.uid,
            name: `User_${user.uid.slice(0, 6)}`,
            avatar: null,
            createdAt: new Date().toISOString()
          };
          await AsyncStorage.setItem('userProfile', JSON.stringify(profile));
          userProfile = JSON.stringify(profile);
        }
        resolve(JSON.parse(userProfile));
      } else {
        // Sign in anonymously
        try {
          const result = await signInAnonymously(auth);
          const profile = {
            id: result.user.uid,
            name: `User_${result.user.uid.slice(0, 6)}`,
            avatar: null,
            createdAt: new Date().toISOString()
          };
          await AsyncStorage.setItem('userProfile', JSON.stringify(profile));
          resolve(profile);
        } catch (error) {
          reject(error);
        }
      }
    });
  });
};

export default app;