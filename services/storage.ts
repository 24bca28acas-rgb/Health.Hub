
import { ActivityData, UserMetrics, UserProfile, DailyActivityDB, FoodLogDB, ChatHistoryDB, SavedWorkoutDB, WorkoutPlan } from '../types';

// --- MOCK USER TYPE ---
export interface User {
  uid: string;
  id: string; // Added for Supabase compatibility
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  isAnonymous: boolean;
}

const STORAGE_PREFIX = 'healthy_hub_';

const getStorageItem = <T>(key: string): T | null => {
  const item = localStorage.getItem(STORAGE_PREFIX + key);
  return item ? JSON.parse(item) : null;
};

const setStorageItem = <T>(key: string, value: T): void => {
  localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
};

const removeStorageItem = (key: string): void => {
  localStorage.removeItem(STORAGE_PREFIX + key);
};

// --- MOCK AUTH STATE ---
let currentUser: User | null = getStorageItem<User>('current_user');
const authListeners: ((user: User | null) => void)[] = [];

const notifyAuthListeners = () => {
  authListeners.forEach(listener => listener(currentUser));
};

export const auth = {
  get currentUser() {
    return currentUser;
  }
};

export const DEFAULT_AVATAR = 'https://api.dicebear.com/7.x/avataaars/svg?seed=EliteUser&backgroundColor=b6e3f4';

// --- AUTH FUNCTIONS ---

export const signInAsGuest = async () => {
  const uid = 'guest_' + Math.random().toString(36).substr(2, 9);
  currentUser = {
    uid,
    id: uid,
    email: null,
    displayName: 'Guest User',
    photoURL: DEFAULT_AVATAR,
    isAnonymous: true
  };
  setStorageItem('current_user', currentUser);
  notifyAuthListeners();
  return { user: currentUser };
};

export const getGuestUser = () => {
  return currentUser;
};

export const sanitizeUserMetadata = async (user: User) => {
  return user;
};

export const sendPasswordResetEmail = async (_email: string) => {
  console.log('Password reset email sent (mock)');
};

export const createUserDocument = async (user: User, name: string) => {
  const profilePayload: UserProfile = {
    id: user.uid,
    email: user.email || '',
    name: name,
    avatarUrl: DEFAULT_AVATAR,
    updatedAt: new Date().toISOString()
  } as UserProfile;
  
  const profiles = getStorageItem<Record<string, UserProfile>>('profiles') || {};
  profiles[user.uid] = profilePayload;
  setStorageItem('profiles', profiles);
};

export const signInWithGoogle = async () => {
  const uid = 'google_' + Math.random().toString(36).substr(2, 9);
  currentUser = {
    uid,
    id: uid,
    email: 'google.user@example.com',
    displayName: 'Google User',
    photoURL: DEFAULT_AVATAR,
    isAnonymous: false
  };
  setStorageItem('current_user', currentUser);
  notifyAuthListeners();
  return { user: currentUser };
};

export const signOut = async () => {
  currentUser = null;
  removeStorageItem('current_user');
  notifyAuthListeners();
};

export const onAuthStateChange = (callback: (user: User | null) => void) => {
  authListeners.push(callback);
  callback(currentUser);
  return () => {
    const index = authListeners.indexOf(callback);
    if (index > -1) authListeners.splice(index, 1);
  };
};

export const getUser = () => {
  return { data: { user: currentUser } };
};

export const getSession = () => {
  return { data: { session: currentUser ? { user: currentUser } : null } };
};

// --- DATABASE FUNCTIONS ---

export const fetchFullUserDashboard = async (userId: string) => {
  const profiles = getStorageItem<Record<string, UserProfile>>('profiles') || {};
  const profile = profiles[userId];
  if (!profile) return null;
  
  const todayKey = new Date().toISOString().split('T')[0];
  const activities = getStorageItem<DailyActivityDB[]>('daily_activity') || [];
  let activity = activities.find(a => a.userId === userId && a.activityDate === todayKey) || null;
  
  // Aggregate activity_logs into today's calories
  const activityLogs = getStorageItem<any[]>('activity_logs') || [];
  const todayLogs = activityLogs.filter(log => 
    log.userId === userId && 
    log.createdAt && 
    log.createdAt.startsWith(todayKey)
  );
  
  const loggedCalories = todayLogs.reduce((sum, log) => sum + (log.caloriesBurned || 0), 0);
  
  if (activity) {
    activity = {
      ...activity,
      caloriesBurned: (activity.caloriesBurned || 0) + loggedCalories
    };
  } else if (loggedCalories > 0) {
    // Create a temporary activity object if none exists but we have logs
    activity = {
      id: 'temp-' + todayKey,
      userId,
      activityDate: todayKey,
      steps: 0,
      caloriesBurned: loggedCalories,
      distanceKm: 0,
      isTargetMet: false,
      updatedAt: new Date().toISOString()
    };
  }
  
  const history = activities
    .filter(a => a.userId === userId)
    .sort((a, b) => b.activityDate.localeCompare(a.activityDate))
    .slice(0, 7);
  
  return { profile, activity, history, activityLogs: todayLogs };
};

export const loadProfile = async (userId: string) => {
  const profiles = getStorageItem<Record<string, UserProfile>>('profiles') || {};
  return profiles[userId] || null;
};

export const completeOnboarding = async (user: User, profileData: any, activityGoals: ActivityData) => {
  const profilePayload: UserProfile = {
    id: user.uid,
    email: profileData.email,
    name: profileData.name,
    avatarUrl: profileData.avatarUrl || DEFAULT_AVATAR,
    primary_goal: profileData.primary_goal, // Added for routing evaluation
    metrics: profileData.metrics,
    goals: {
        stepGoal: activityGoals.stepGoal,
        calorieGoal: activityGoals.calorieGoal,
        distanceGoal: activityGoals.distanceGoal
    },
    updatedAt: new Date().toISOString()
  } as UserProfile;

  const profiles = getStorageItem<Record<string, UserProfile>>('profiles') || {};
  profiles[user.uid] = profilePayload;
  setStorageItem('profiles', profiles);
  return profilePayload;
};

export const updateProfile = async (userId: string, updates: Partial<UserProfile>) => {
  const profiles = getStorageItem<Record<string, UserProfile>>('profiles') || {};
  if (profiles[userId]) {
    profiles[userId] = { ...profiles[userId], ...updates, updatedAt: new Date().toISOString() };
    setStorageItem('profiles', profiles);
  }
};

export const updateUserMetrics = async (userId: string, metrics: UserMetrics) => {
  await updateProfile(userId, { metrics });
};

export const updateUserTargets = async (userId: string, planData: any) => {
  await updateProfile(userId, { currentPlanName: planData.title } as any);
};

export const fetchChatHistory = async (userId: string) => {
  const history = getStorageItem<ChatHistoryDB[]>('chat_history') || [];
  return history
    .filter(h => h.userId === userId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
};

export const saveChatMessage = async (userId: string, message: string, isUserMessage: boolean, planData?: any) => {
  const history = getStorageItem<ChatHistoryDB[]>('chat_history') || [];
  const newMessage: ChatHistoryDB = {
    id: Math.random().toString(36).substr(2, 9),
    userId,
    message,
    isUserMessage,
    planData: planData || null,
    createdAt: new Date().toISOString()
  };
  history.push(newMessage);
  setStorageItem('chat_history', history);
};

export const clearChatHistory = async (userId: string) => {
  const history = getStorageItem<ChatHistoryDB[]>('chat_history') || [];
  const filtered = history.filter(h => h.userId !== userId);
  setStorageItem('chat_history', filtered);
};

export const fetchSavedWorkouts = async (userId: string) => {
  const workouts = getStorageItem<SavedWorkoutDB[]>('saved_workouts') || [];
  return workouts
    .filter(w => w.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
};

export const saveWorkout = async (userId: string, plan: WorkoutPlan) => {
  const workouts = getStorageItem<SavedWorkoutDB[]>('saved_workouts') || [];
  const newWorkout: SavedWorkoutDB = {
    id: Math.random().toString(36).substr(2, 9),
    userId,
    planData: plan,
    createdAt: new Date().toISOString()
  };
  workouts.push(newWorkout);
  setStorageItem('saved_workouts', workouts);
};

export const deleteWorkout = async (id: string) => {
  const workouts = getStorageItem<SavedWorkoutDB[]>('saved_workouts') || [];
  const filtered = workouts.filter(w => w.id !== id);
  setStorageItem('saved_workouts', filtered);
};

export const logActivity = async (userId: string, activityType: string, durationMinutes: number, intensity: string, caloriesBurned: number, notes?: string) => {
  const logs = getStorageItem<any[]>('activity_logs') || [];
  const newLog = {
    id: Math.random().toString(36).substr(2, 9),
    userId,
    activityType,
    durationMinutes,
    intensity,
    caloriesBurned,
    notes: notes || null,
    createdAt: new Date().toISOString()
  };
  logs.push(newLog);
  setStorageItem('activity_logs', logs);
};

export const submitAiFeedback = async (imageUrl: string, prediction: string, feedback: string) => {
  if (!currentUser) return;
  const feedbacks = getStorageItem<any[]>('ai_feedback') || [];
  const newFeedback = {
    id: Math.random().toString(36).substr(2, 9),
    userId: currentUser.uid,
    imageUrl,
    prediction,
    feedback,
    createdAt: new Date().toISOString()
  };
  feedbacks.push(newFeedback);
  setStorageItem('ai_feedback', feedbacks);
};

export const incrementMapSession = async (userId: string, steps: number, calories: number, distanceKm: number) => {
  const todayKey = getLocalTodayKey();
  const activities = getStorageItem<DailyActivityDB[]>('daily_activity') || [];
  const index = activities.findIndex(a => a.userId === userId && a.activityDate === todayKey);
  
  if (index > -1) {
    activities[index] = {
      ...activities[index],
      steps: (activities[index].steps || 0) + steps,
      caloriesBurned: (activities[index].caloriesBurned || 0) + calories,
      distanceKm: (activities[index].distanceKm || 0) + distanceKm,
      updatedAt: new Date().toISOString()
    };
  } else {
    activities.push({
      id: Math.random().toString(36).substr(2, 9),
      userId,
      activityDate: todayKey,
      steps,
      caloriesBurned: calories,
      distanceKm,
      isTargetMet: false,
      updatedAt: new Date().toISOString()
    });
  }
  setStorageItem('daily_activity', activities);
};

export const performMaintenance = (force: boolean = false) => {
  if (force) {
    try {
      // Clear non-essential local storage items
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && !key.startsWith(STORAGE_PREFIX)) {
          localStorage.removeItem(key);
        }
      }
    } catch (e) {
      console.error('Maintenance failed', e);
    }
  }
};

export const getLocalTodayKey = () => {
  return new Date().toISOString().split('T')[0];
};

export const upsertDailyActivity = async (userId: string, date: string, steps: number, calories: number, distance: number) => {
  const activities = getStorageItem<DailyActivityDB[]>('daily_activity') || [];
  const index = activities.findIndex(a => a.userId === userId && a.activityDate === date);
  
  if (index > -1) {
    activities[index] = {
      ...activities[index],
      steps,
      caloriesBurned: calories,
      distanceKm: distance,
      updatedAt: new Date().toISOString()
    };
  } else {
    activities.push({
      id: Math.random().toString(36).substr(2, 9),
      userId,
      activityDate: date,
      steps,
      caloriesBurned: calories,
      distanceKm: distance,
      isTargetMet: false,
      updatedAt: new Date().toISOString()
    });
  }
  setStorageItem('daily_activity', activities);
};

export const processStreakUpdate = async (userId: string, steps: number, stepGoal: number): Promise<number | void> => {
  if (steps >= stepGoal) {
    const profiles = getStorageItem<Record<string, UserProfile>>('profiles') || {};
    const profile = profiles[userId];
    if (profile) {
      const today = getLocalTodayKey();
      if (profile.lastActiveDate !== today) {
        const newStreak = (profile.currentStreak || 0) + 1;
        profiles[userId] = {
          ...profile,
          currentStreak: newStreak,
          lastActiveDate: today,
          updatedAt: new Date().toISOString()
        };
        setStorageItem('profiles', profiles);
        return newStreak;
      }
    }
  }
};

export const checkAndAwardStreak = async (userId: string, _stepGoal: number) => {
  const profiles = getStorageItem<Record<string, UserProfile>>('profiles') || {};
  const profile = profiles[userId];
  if (profile) {
    const today = getLocalTodayKey();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    if (profile.lastActiveDate !== today && profile.lastActiveDate !== yesterdayStr) {
      // Streak broken
      profiles[userId] = {
        ...profile,
        currentStreak: 0,
        updatedAt: new Date().toISOString()
      };
      setStorageItem('profiles', profiles);
    }
  }
};

export const fetchDayData = async (userId: string, date: string) => {
  const activities = getStorageItem<DailyActivityDB[]>('daily_activity') || [];
  const activity = activities.find(a => a.userId === userId && a.activityDate === date) || null;
  
  const foodLogs = getStorageItem<any[]>('food_logs') || [];
  const dayFood = foodLogs.filter(f => {
    const logDate = f.createdAt.split('T')[0];
    return f.userId === userId && logDate === date;
  });
  
  return { activity, food: dayFood };
};

export const deleteUserAccount = async () => {
  if (!currentUser) return;
  const userId = currentUser.uid;
  
  // Delete profile
  const profiles = getStorageItem<Record<string, UserProfile>>('profiles') || {};
  delete profiles[userId];
  setStorageItem('profiles', profiles);
  
  // Clear other data
  const activities = getStorageItem<DailyActivityDB[]>('daily_activity') || [];
  setStorageItem('daily_activity', activities.filter(a => a.userId !== userId));
  
  const history = getStorageItem<ChatHistoryDB[]>('chat_history') || [];
  setStorageItem('chat_history', history.filter(h => h.userId !== userId));
  
  const workouts = getStorageItem<SavedWorkoutDB[]>('saved_workouts') || [];
  setStorageItem('saved_workouts', workouts.filter(w => w.userId !== userId));
  
  await signOut();
};

// --- LEGACY SUPABASE OBJECT FOR COMPATIBILITY ---
export const supabase = {
  auth: {
    getUser: async () => {
      return { data: { user: currentUser ? { id: currentUser.uid, ...currentUser } : null } };
    },
    getSession: async () => {
      return { data: { session: currentUser ? { user: { id: currentUser.uid, ...currentUser } } : null } };
    },
    signOut: async () => {
      await signOut();
    },
    signInWithPassword: async ({ email, password }: any) => {
      // 1. Basic validation
      if (!password || password.length < 6) {
        return { data: { session: null }, error: { message: "Invalid password. Must be at least 6 characters." } };
      }
      
      // 2. Simulate user lookup
      const profiles = getStorageItem<Record<string, UserProfile>>('profiles') || {};
      const existingProfile = Object.values(profiles).find(p => p.email === email);

      // 3. If user doesn't exist, return error (this prevents "any" user from logging in)
      if (!existingProfile) {
        return { data: { session: null }, error: { message: "Invalid login credentials" } };
      }

      // 4. Simulate password check (in a real app, this would be hashed)
      // For this mock, we'll just accept anything >= 6 chars for existing users
      // but we can still simulate a specific "wrong" password
      if (password === 'wrongpassword') {
        return { data: { session: null }, error: { message: "Invalid login credentials" } };
      }

      const user = {
        uid: existingProfile.id,
        id: existingProfile.id,
        email: existingProfile.email,
        displayName: existingProfile.name,
        photoURL: existingProfile.avatarUrl || DEFAULT_AVATAR,
        isAnonymous: false
      };
      
      currentUser = user;
      setStorageItem('current_user', currentUser);
      notifyAuthListeners();
      
      return { 
        data: { 
          session: { user, access_token: 'mock_token' },
          user
        }, 
        error: null 
      };
    },
    signUp: async ({ email, password }: any) => {
      if (!password || password.length < 6) {
        return { data: { user: null }, error: { message: "Password must be at least 6 characters." } };
      }

      // Check if user already exists
      const profiles = getStorageItem<Record<string, UserProfile>>('profiles') || {};
      const existingProfile = Object.values(profiles).find(p => p.email === email);
      if (existingProfile) {
        return { data: { user: null }, error: { message: "User already registered" } };
      }

      const uid = 'user_' + Math.random().toString(36).substr(2, 9);
      const user = {
        uid,
        id: uid,
        email: email,
        displayName: email.split('@')[0],
        photoURL: DEFAULT_AVATAR,
        isAnonymous: false
      };
      
      currentUser = user;
      setStorageItem('current_user', currentUser);
      notifyAuthListeners();
      
      return { 
        data: { 
          user,
          session: { user, access_token: 'mock_token' }
        }, 
        error: null 
      };
    },
    onAuthStateChange: (callback: (event: string, session: any) => void) => {
      const unsubscribe = onAuthStateChange((user) => {
        callback('SIGNED_IN', user ? { user } : null);
      });
      return { data: { subscription: { unsubscribe } } };
    }
  },
  from: (table: string) => ({
    select: (_fields: string) => ({
      eq: (field: string, value: any) => ({
        maybeSingle: async () => {
          if (table === 'profiles' && field === 'id') {
            const profiles = getStorageItem<Record<string, UserProfile>>('profiles') || {};
            return { data: profiles[value] || null };
          }
          return { data: null };
        },
        single: async () => {
          if (table === 'profiles' && field === 'id') {
            const profiles = getStorageItem<Record<string, UserProfile>>('profiles') || {};
            const profile = profiles[value];
            if (!profile) {
              return { data: null, error: { message: 'JSON object requested, but no rows were returned', code: 'PGRST116' }, status: 406 };
            }
            return { data: profile, error: null, status: 200 };
          }
          return { data: null, error: { message: 'Not found', code: 'PGRST116' }, status: 406 };
        }
      })
    }),
    insert: async (data: any) => {
      if (table === 'daily_activity' || table === 'workouts' || table === 'activity_logs') {
        const logs = getStorageItem<any[]>('activity_logs') || [];
        const newLog = {
          id: Math.random().toString(36).substr(2, 9),
          createdAt: new Date().toISOString(),
          ...data
        };
        logs.push(newLog);
        setStorageItem('activity_logs', logs);
        return { data: [newLog], error: null };
      }
      return { data: null, error: { message: 'Table not found' } };
    }
  }),
  rpc: async (fn: string) => {
    if (fn === 'delete_user_account') {
      await deleteUserAccount();
      return { error: null };
    }
    return { error: new Error('Not implemented') };
  }
};

export const db = {
  // Mock db object if needed by other components
};
