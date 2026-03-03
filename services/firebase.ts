
import { ActivityData } from '../types';

// --- MOCK TYPES ---
export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

// --- MOCK AUTH STATE ---
let currentUser: User | null = null;
const authListeners: ((user: User | null) => void)[] = [];

// Helper to persist mock user session
const saveUserSession = (user: User | null) => {
  currentUser = user;
  if (user) {
    localStorage.setItem('healthy_hub_user', JSON.stringify(user));
  } else {
    localStorage.removeItem('healthy_hub_user');
  }
  authListeners.forEach(listener => listener(user));
};

// Initialize from storage
try {
  const stored = localStorage.getItem('healthy_hub_user');
  if (stored) {
    currentUser = JSON.parse(stored);
  }
} catch (e) {
  console.error("Failed to load auth state", e);
}

// --- MOCK FIRESTORE FUNCTIONS (Internal Helpers) ---
const DB_KEY = 'healthy_hub_db';

const getMockDb = () => {
  try {
    const data = localStorage.getItem(DB_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
};

const saveMockDb = (data: any) => {
  localStorage.setItem(DB_KEY, JSON.stringify(data));
};

// --- AUTO-INITIALIZE DEMO USER ---
// Ensure there is always a user in the DB for testers
const initializeDemoUser = () => {
  const db = getMockDb();
  const demoUid = 'demo_user_001';
  const demoEmail = 'admin@healthyhub.com';
  
  // Only add if DB is empty or demo user missing
  const userExists = Object.values(db).some((u: any) => u.email === demoEmail);
  
  if (!userExists) {
    db[demoUid] = {
      uid: demoUid,
      name: 'Elite User',
      email: demoEmail,
      avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=EliteUser&backgroundColor=b6e3f4`,
      goals: {
        stepGoal: 10000,
        calorieGoal: 2000,
        distanceGoal: 5.0
      },
      currentActivity: {
        steps: 7420,
        calories: 340,
        distance: 5.2,
        history: [
            { day: 'Mon', steps: 8400 },
            { day: 'Tue', steps: 9100 },
            { day: 'Wed', steps: 7800 },
            { day: 'Thu', steps: 11000 },
            { day: 'Fri', steps: 6500 },
            { day: 'Sat', steps: 12400 },
            { day: 'Sun', steps: 7420 },
        ]
      }
    };
    saveMockDb(db);
  }
};

// Initialize the demo data immediately
initializeDemoUser();

// --- EXPORTED MOCK AUTH FUNCTIONS ---

export const auth = {}; // Mock auth object

export const onAuthStateChanged = (authObj: any, callback: (user: User | null) => void) => {
  authListeners.push(callback);
  // Fire immediately
  callback(currentUser);
  // Unsubscribe function
  return () => {
    const index = authListeners.indexOf(callback);
    if (index > -1) authListeners.splice(index, 1);
  };
};

export const signInWithEmailAndPassword = async (authObj: any, email: string, psw: string) => {
  await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network delay
  
  const db = getMockDb();
  // Find user by email (case-insensitive)
  const existingUser = Object.values(db).find((u: any) => u.email?.toLowerCase() === email.toLowerCase()) as any;

  if (existingUser) {
    const user: User = {
      uid: existingUser.uid,
      email: existingUser.email,
      displayName: existingUser.name,
      photoURL: existingUser.avatarUrl
    };
    saveUserSession(user);
    return { user };
  }
  
  throw new Error("User not found or invalid credentials.");
};

export const createUserWithEmailAndPassword = async (authObj: any, email: string, psw: string) => {
  await new Promise(resolve => setTimeout(resolve, 1200));
  
  // Check if email taken
  const db = getMockDb();
  const taken = Object.values(db).some((u: any) => u.email?.toLowerCase() === email.toLowerCase());
  if (taken) throw new Error("Email already in use.");

  const uid = 'user_' + Math.random().toString(36).substr(2, 9);
  const user: User = {
    uid,
    email,
    displayName: null,
    photoURL: null
  };
  
  // Note: Firestore document is created in Auth.tsx via createUserDocument
  saveUserSession(user);
  return { user };
};

export const sendPasswordResetEmail = async (authObj: any, email: string) => {
  await new Promise(resolve => setTimeout(resolve, 1000));
  const db = getMockDb();
  const userExists = Object.values(db).some((u: any) => u.email?.toLowerCase() === email.toLowerCase());
  
  if (!userExists) {
    throw new Error("No account found with this email address.");
  }
  
  return true;
};

export const signOut = async (authObj: any) => {
  saveUserSession(null);
};

export const updateProfile = async (user: User, profile: { displayName?: string, photoURL?: string }) => {
  if (currentUser && currentUser.uid === user.uid) {
    const updated = { ...currentUser, ...profile };
    saveUserSession(updated);

    // CRITICAL: Update the Mock DB as well, otherwise App subscription overwrites it
    const db = getMockDb();
    if (db[user.uid]) {
      if (profile.displayName) db[user.uid].name = profile.displayName;
      if (profile.photoURL) db[user.uid].avatarUrl = profile.photoURL;
      saveMockDb(db);
    }
  }
};

// --- MOCK FIRESTORE FUNCTIONS ---

export const db = {}; // Mock db object

export const createUserDocument = async (user: User, name: string) => {
  const dbData = getMockDb();
  if (!dbData[user.uid]) {
    dbData[user.uid] = {
      uid: user.uid,
      name,
      email: user.email,
      avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}&backgroundColor=b6e3f4`,
      goals: {
        stepGoal: 10000,
        calorieGoal: 2000,
        distanceGoal: 5.0
      },
      currentActivity: {
        steps: 0,
        calories: 0,
        distance: 0,
        history: [
            { day: 'Mon', steps: 0 },
            { day: 'Tue', steps: 0 },
            { day: 'Wed', steps: 0 },
            { day: 'Thu', steps: 0 },
            { day: 'Fri', steps: 0 },
            { day: 'Sat', steps: 0 },
            { day: 'Sun', steps: 0 },
        ]
      }
    };
    saveMockDb(dbData);
  }
};

export const subscribeToUserData = (uid: string, onUpdate: (data: any) => void) => {
  // Initial call
  const dbData = getMockDb();
  if (dbData[uid]) {
    onUpdate(dbData[uid]);
  }

  // Poll for changes
  const interval = setInterval(() => {
    const current = getMockDb();
    if (current[uid]) {
      onUpdate(current[uid]);
    }
  }, 1500);

  return () => clearInterval(interval);
};

export const updateUserActivity = async (uid: string, data: Partial<ActivityData>, goals?: Partial<ActivityData>) => {
  const dbData = getMockDb();
  if (dbData[uid]) {
    if (data) {
      dbData[uid].currentActivity = { ...dbData[uid].currentActivity, ...data };
    }
    if (goals) {
      dbData[uid].goals = { ...dbData[uid].goals, ...goals };
    }
    saveMockDb(dbData);
  }
};
