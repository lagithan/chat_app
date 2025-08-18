import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import DatabaseService from './DatabaseService';
import UserService from './UserService';

interface User {
  id: number;
  userId: string;
  username: string;
  email?: string;
  fullName?: string;
  avatar?: string;
  bio?: string;
  createdAt: number;
  isActive: number;
}

interface Response<T> {
  success: boolean;
  data?: T;
  error?: string;
}

class AuthService {
  private currentUser: User | null = null;

  async isFirstTimeUser(): Promise<boolean> {
    try {
      const hasUsers = await AsyncStorage.getItem('hasUsers');
      return !hasUsers;
    } catch (error: any) {
      console.error('Error checking first time user:', error);
      return true;
    }
  }

  async createAccount(userData: Partial<User>, password: string): Promise<Response<User>> {
    try {
      const { username, email, fullName, bio } = userData;

      if (!username) {
        throw new Error('Username is required');
      }

      const usernameValidation = UserService.validateUsername(username);
      if (!usernameValidation.isValid) {
        throw new Error(usernameValidation.error);
      }

      const passwordValidation = UserService.validatePassword(password);
      if (!passwordValidation.isValid) {
        throw new Error(passwordValidation.error);
      }

      if (email) {
        const emailValidation = UserService.validateEmail(email);
        if (!emailValidation.isValid) {
          throw new Error(emailValidation.error);
        }
      }

      const existingUser = await DatabaseService.getUserByUsername(username);
      if (existingUser) {
        throw new Error('Username already exists');
      }

      const userId = await UserService.generateUserId(username);
      const userCreateData: Partial<User> = {
        userId,
        username,
        email,
        fullName,
        bio,
        createdAt: Date.now(),
        isActive: 1
      };

      await DatabaseService.createUser(userCreateData);
      await DatabaseService.createAuth(userId, password);
      await AsyncStorage.setItem('hasUsers', 'true');

      this.currentUser = userCreateData as User;
      await AsyncStorage.setItem('currentUser', JSON.stringify({
        userId,
        username,
        fullName
      }));

      return { success: true, data: userCreateData as User };
    } catch (error: any) {
      console.error('Error creating account:', error);
      return { success: false, error: error.message };
    }
  }

  async login(username: string, password: string): Promise<Response<User>> {
    try {
      const user = await DatabaseService.getUserByUsername(username);
      if (!user) {
        throw new Error('User not found');
      }

      const isValid = await DatabaseService.validatePassword(user.userId, password);
      if (!isValid) {
        throw new Error('Invalid password');
      }

      this.currentUser = user;
      await AsyncStorage.setItem('currentUser', JSON.stringify({
        userId: user.userId,
        username: user.username,
        fullName: user.fullName
      }));

      return { success: true, data: user };
    } catch (error: any) {
      console.error('Error during login:', error);
      return { success: false, error: error.message };
    }
  }

  async getCurrentUser(): Promise<User | null> {
    try {
      if (this.currentUser) {
        return this.currentUser;
      }

      const userData = await AsyncStorage.getItem('currentUser');
      if (userData) {
        const { userId } = JSON.parse(userData);
        this.currentUser = await DatabaseService.getUserById(userId);
        return this.currentUser;
      }

      return null;
    } catch (error: any) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  async logout(): Promise<Response<void>> {
    try {
      await AsyncStorage.removeItem('currentUser');
      this.currentUser = null;
      return { success: true };
    } catch (error: any) {
      console.error('Error during logout:', error);
      return { success: false, error: error.message };
    }
  }

  async isLoggedIn(): Promise<boolean> {
    try {
      const user = await this.getCurrentUser();
      return !!user;
    } catch (error: any) {
      console.error('Error checking login status:', error);
      return false;
    }
  }
}

export default new AuthService();