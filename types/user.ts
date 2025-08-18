export interface User {
  id: string;
  name: string;
  profileImage?: string;
  isOnline: boolean;
  lastSeen: Date;
  deviceId: string;
}

export interface UserProfile {
  name: string;
  profileImage?: string;
}
