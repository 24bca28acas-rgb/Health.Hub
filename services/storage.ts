import { createClient } from '@supabase/supabase-js';
import { ActivityData, UserMetrics, UserProfile, DailyActivityDB, FoodLogDB, ChatHistoryDB, SavedWorkoutDB, WorkoutPlan } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// --- SUPABASE CLIENT ---
const realSupabase = createClient(supabaseUrl, supabaseAnonKey);
// Exported at the end of the file to avoid ReferenceError with mockSupabase

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

export const isGuest = (userId: string | null) => {
  return !userId || userId.startsWith('guest_');
};

const notifyAuthListeners = () => {
  authListeners.forEach(listener => listener(currentUser));
};

export const auth = {
  get currentUser() {
    return currentUser;
  }
};

export const DEFAULT_AVATAR = 'https://tngzcpgoshpfwuarskul.supabase.co/storage/v1/object/public/avatars/User%20pfp.jpg';

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
  localStorage.setItem('healthy_hub_guest_session', 'true');
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
  try {
    // 1. Clear Local Mock State FIRST to avoid race conditions in App.tsx listener
    currentUser = null;
    removeStorageItem('current_user');
    localStorage.removeItem('healthy_hub_guest_session');
    
    // 2. Nuclear option: Clear anything that looks like a Supabase key
    // This ensures that even if the official signOut hangs, the next reload won't find a session
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('sb-') || key.includes('supabase')) {
        localStorage.removeItem(key);
      }
    });

    notifyAuthListeners();

    // 3. Clear Supabase Session (if any) with a strict timeout
    // We don't await this indefinitely because we want the UI to respond immediately
    const supabaseSignOut = realSupabase.auth.signOut({ scope: 'local' });
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("SignOut Timeout")), 2000));
    
    await Promise.race([supabaseSignOut, timeout]).catch(err => {
      console.warn("Supabase signOut non-critical failure:", err);
    });
  } catch (e) {
    console.error("Global signOut error:", e);
  }
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

export const uploadProfilePhoto = async (userId: string, file: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64data = reader.result as string;
      // In a real app, this would upload to Supabase Storage
      // For this mock, we store the base64 string in localStorage
      const photos = getStorageItem<Record<string, string>>('profile_photos') || {};
      photos[userId] = base64data;
      setStorageItem('profile_photos', photos);
      resolve(base64data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const deleteProfilePhoto = async (userId: string): Promise<void> => {
  // In a real app, this would delete from Supabase Storage
  const photos = getStorageItem<Record<string, string>>('profile_photos') || {};
  delete photos[userId];
  setStorageItem('profile_photos', photos);
};

// --- DATABASE FUNCTIONS ---

export const fetchFullUserDashboard = async (userId: string) => {
  if (isGuest(userId)) {
    const profiles = getStorageItem<Record<string, UserProfile>>('profiles') || {};
    const profile = profiles[userId];
    if (!profile) return null;
    
    const todayKey = getLocalTodayKey();
    const activities = getStorageItem<DailyActivityDB[]>('daily_activity') || [];
    const activity = activities.find(a => a.userId === userId && a.activityDate === todayKey) || null;
    
    const history = activities
      .filter(a => a.userId === userId)
      .sort((a, b) => b.activityDate.localeCompare(a.activityDate))
      .slice(0, 7);
    
    return { profile, activity, history };
  }
  
  try {
    const today = getLocalTodayKey();
    
    // Fetch in parallel
    const [profileRes, activityRes, historyRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
      supabase.from('daily_activity').select('*').eq('user_id', userId).eq('date', today).maybeSingle(),
      supabase.from('daily_activity').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(7)
    ]);
    
    if (profileRes.error) throw profileRes.error;
    
    const profile = profileRes.data ? {
      id: profileRes.data.id,
      name: profileRes.data.name,
      email: profileRes.data.email,
      avatarUrl: profileRes.data.avatar_url,
      metrics: profileRes.data.metrics,
      goals: profileRes.data.goals,
      currentStreak: profileRes.data.current_streak,
      lastActiveDate: profileRes.data.last_active_date,
      updatedAt: profileRes.data.updated_at
    } : null;
    
    const activity = activityRes.data ? {
      id: activityRes.data.id,
      userId: activityRes.data.user_id,
      activityDate: activityRes.data.date,
      steps: activityRes.data.steps,
      caloriesBurned: activityRes.data.calories_burned,
      caloriesConsumed: activityRes.data.calories_consumed,
      distanceKm: activityRes.data.distance_km,
      hydration: activityRes.data.hydration,
      hydrationGoal: activityRes.data.hydration_goal,
      isTargetMet: activityRes.data.is_target_met,
      updatedAt: activityRes.data.updated_at
    } : null;
    
    const history = historyRes.data ? historyRes.data.map(a => ({
      id: a.id,
      userId: a.user_id,
      activityDate: a.date,
      steps: a.steps,
      caloriesBurned: a.calories_burned,
      caloriesConsumed: a.calories_consumed,
      distanceKm: a.distance_km,
      hydration: a.hydration,
      hydrationGoal: a.hydration_goal,
      isTargetMet: a.is_target_met,
      updatedAt: a.updated_at
    })) : [];
    
    return { profile, activity, history };
  } catch (error) {
    console.error('Error fetching full user dashboard:', error);
    return null;
  }
};

export const loadProfile = async (userId: string) => {
  if (isGuest(userId)) {
    const profiles = getStorageItem<Record<string, UserProfile>>('profiles') || {};
    return profiles[userId] || null;
  }

  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) throw error;
  
  if (!data) return null;

  return {
    id: data.id,
    name: data.name,
    email: data.email,
    avatarUrl: data.avatar_url,
    metrics: data.metrics,
    goals: data.goals,
    currentStreak: data.current_streak,
    lastActiveDate: data.last_active_date,
    updatedAt: data.updated_at
  } as UserProfile;
};

export const completeOnboarding = async (user: User, profileData: any, activityGoals: ActivityData) => {
  const profilePayload = {
    id: user.uid,
    email: profileData.email,
    name: profileData.name,
    avatar_url: profileData.avatarUrl || DEFAULT_AVATAR,
    primary_goal: profileData.primary_goal,
    metrics: profileData.metrics,
    goals: {
        stepGoal: activityGoals.stepGoal,
        calorieGoal: activityGoals.calorieGoal,
        distanceGoal: activityGoals.distanceGoal
    },
    updated_at: new Date().toISOString()
  };

  if (isGuest(user.uid)) {
    const profiles = getStorageItem<Record<string, UserProfile>>('profiles') || {};
    profiles[user.uid] = {
      ...profilePayload,
      avatarUrl: profilePayload.avatar_url,
      updatedAt: profilePayload.updated_at
    } as any;
    setStorageItem('profiles', profiles);
    return profiles[user.uid];
  }

  const { data, error } = await supabase.from('profiles').upsert(profilePayload).select().single();
  if (error) throw error;
  return data;
};

export const updateProfile = async (userId: string, updates: Partial<UserProfile>) => {
  if (isGuest(userId)) {
    const profiles = getStorageItem<Record<string, UserProfile>>('profiles') || {};
    if (profiles[userId]) {
      profiles[userId] = { ...profiles[userId], ...updates, updatedAt: new Date().toISOString() };
      setStorageItem('profiles', profiles);
    }
    return;
  }

  // Map camelCase to snake_case for Supabase
  const supabaseUpdates: any = { ...updates };
  if (updates.avatarUrl) {
    supabaseUpdates.avatar_url = updates.avatarUrl;
    delete supabaseUpdates.avatarUrl;
  }
  if (updates.currentStreak !== undefined) {
    supabaseUpdates.current_streak = updates.currentStreak;
    delete supabaseUpdates.currentStreak;
  }
  if (updates.lastActiveDate) {
    supabaseUpdates.last_active_date = updates.lastActiveDate;
    delete supabaseUpdates.lastActiveDate;
  }
  if (updates.updatedAt) {
    supabaseUpdates.updated_at = updates.updatedAt;
    delete supabaseUpdates.updatedAt;
  } else {
    supabaseUpdates.updated_at = new Date().toISOString();
  }

  const { error } = await supabase.from('profiles').update(supabaseUpdates).eq('id', userId);
  if (error) throw error;
};

export const updateUserMetrics = async (userId: string, metrics: UserMetrics) => {
  await updateProfile(userId, { metrics });
};

export const updateUserTargets = async (userId: string, planData: any) => {
  await updateProfile(userId, { currentPlanName: planData.title } as any);
};

export const fetchChatHistory = async (userId: string) => {
  if (isGuest(userId)) {
    const history = getStorageItem<ChatHistoryDB[]>('chat_history') || [];
    return history
      .filter(h => h.userId === userId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  const { data, error } = await supabase
    .from('chat_history')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching chat history:', error);
    return [];
  }

  return data.map(h => ({
    id: h.id,
    userId: h.user_id,
    message: h.message,
    isUserMessage: h.is_user_message,
    planData: h.plan_data,
    createdAt: h.created_at
  }));
};

export const saveChatMessage = async (userId: string, message: string, isUserMessage: boolean, planData?: any) => {
  if (isGuest(userId)) {
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
    return;
  }

  const { error } = await supabase.from('chat_history').insert({
    user_id: userId,
    message,
    is_user_message: isUserMessage,
    plan_data: planData || null,
    created_at: new Date().toISOString()
  });

  if (error) throw error;
};

export const clearChatHistory = async (userId: string) => {
  if (isGuest(userId)) {
    const history = getStorageItem<ChatHistoryDB[]>('chat_history') || [];
    const filtered = history.filter(h => h.userId !== userId);
    setStorageItem('chat_history', filtered);
    return;
  }

  const { error } = await supabase.from('chat_history').delete().eq('user_id', userId);
  if (error) throw error;
};

export const fetchSavedWorkouts = async (userId: string) => {
  if (isGuest(userId)) {
    const workouts = getStorageItem<SavedWorkoutDB[]>('saved_workouts') || [];
    return workouts
      .filter(w => w.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  
  const { data, error } = await supabase
    .from('saved_workouts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
    
  if (error) {
    console.error('Error fetching saved workouts:', error);
    return [];
  }
  
  return data.map(w => ({
    id: w.id,
    userId: w.user_id,
    planData: w.plan_data,
    createdAt: w.created_at
  }));
};

export const saveWorkout = async (userId: string, plan: WorkoutPlan) => {
  if (isGuest(userId)) {
    const workouts = getStorageItem<SavedWorkoutDB[]>('saved_workouts') || [];
    const newWorkout: SavedWorkoutDB = {
      id: Math.random().toString(36).substr(2, 9),
      userId,
      planData: plan,
      createdAt: new Date().toISOString()
    };
    workouts.push(newWorkout);
    setStorageItem('saved_workouts', workouts);
    return newWorkout;
  }

  const { data, error } = await supabase.from('saved_workouts').insert({
    user_id: userId,
    plan_data: plan,
    created_at: new Date().toISOString()
  }).select().single();
  
  if (error) throw error;
  return data;
};

export const deleteWorkout = async (id: string) => {
  // Try to delete from Supabase first
  const { error } = await supabase.from('saved_workouts').delete().eq('id', id);
  
  // Also clean up local storage if it was a guest workout or for legacy
  const workouts = getStorageItem<SavedWorkoutDB[]>('saved_workouts') || [];
  const filtered = workouts.filter(w => w.id !== id);
  setStorageItem('saved_workouts', filtered);
  
  if (error && !error.message.includes('PGRST205')) {
    throw error;
  }
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
      caloriesConsumed: 0,
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
  return new Date().toLocaleDateString('en-CA');
};

export const upsertDailyActivity = async (userId: string, date: string, steps: number, calories: number, distance: number, hydration: number, hydrationGoal: number, caloriesConsumed: number = 0) => {
  const { error } = await supabase.from('daily_activity').upsert({
    user_id: userId,
    date: date,
    steps,
    calories_burned: calories,
    distance_km: distance,
    hydration,
    hydration_goal: hydrationGoal,
    calories_consumed: caloriesConsumed,
    updated_at: new Date().toISOString()
  });

  if (error) {
    console.error('Supabase Upsert Error:', error);
    throw error;
  }

  // Update local mock storage for legacy compatibility if needed
  const activities = getStorageItem<DailyActivityDB[]>('daily_activity') || [];
  const index = activities.findIndex(a => a.userId === userId && a.activityDate === date);
  
  if (index > -1) {
    activities[index] = {
      ...activities[index],
      steps,
      caloriesBurned: calories,
      distanceKm: distance,
      hydration,
      hydrationGoal,
      caloriesConsumed: caloriesConsumed || activities[index].caloriesConsumed || 0,
      updatedAt: new Date().toISOString()
    };
  } else {
    activities.push({
      id: Math.random().toString(36).substr(2, 9),
      userId,
      activityDate: date,
      steps,
      caloriesBurned: calories,
      caloriesConsumed,
      distanceKm: distance,
      hydration,
      hydrationGoal,
      isTargetMet: false,
      updatedAt: new Date().toISOString()
    });
  }
  setStorageItem('daily_activity', activities);
};

export const logCalorieIntake = async (userId: string, addedAmount: number) => {
  const todayKey = getLocalTodayKey();
  const activities = getStorageItem<DailyActivityDB[]>('daily_activity') || [];
  const index = activities.findIndex(a => a.userId === userId && a.activityDate === todayKey);
  
  let newTotal = addedAmount;
  if (index > -1) {
    newTotal = (activities[index].caloriesConsumed || 0) + addedAmount;
  }

  // Simulate Supabase UPSERT
  const { error } = await supabase.from('daily_activity').upsert({
    user_id: userId,
    date: todayKey,
    calories_consumed: newTotal
  } as any);

  if (error) throw error;

  // Update local mock storage
  if (index > -1) {
    activities[index].caloriesConsumed = newTotal;
    activities[index].updatedAt = new Date().toISOString();
  } else {
    activities.push({
      id: Math.random().toString(36).substr(2, 9),
      userId,
      activityDate: todayKey,
      steps: 0,
      caloriesBurned: 0,
      caloriesConsumed: newTotal,
      distanceKm: 0,
      isTargetMet: false,
      updatedAt: new Date().toISOString()
    });
  }
  setStorageItem('daily_activity', activities);
  return newTotal;
};

export const processStreakUpdate = async (userId: string, steps: number, stepGoal: number): Promise<number | void> => {
  if (steps >= stepGoal) {
    const today = getLocalTodayKey();
    
    // 1. Fetch current profile from Supabase
    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('current_streak, last_active_date')
      .eq('id', userId)
      .maybeSingle();

    if (fetchError) throw fetchError;

    if (profile && profile.last_active_date !== today) {
      const newStreak = (profile.current_streak || 0) + 1;
      
      // 2. Update profile in Supabase
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          current_streak: newStreak,
          last_active_date: today,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (updateError) throw updateError;

      // Update local mock storage for legacy compatibility
      const profiles = getStorageItem<Record<string, UserProfile>>('profiles') || {};
      if (profiles[userId]) {
        profiles[userId] = {
          ...profiles[userId],
          currentStreak: newStreak,
          lastActiveDate: today,
          updatedAt: new Date().toISOString()
        };
        setStorageItem('profiles', profiles);
      }
      
      return newStreak;
    }
  }
};

export const checkAndAwardStreak = async (userId: string, _stepGoal: number) => {
  const today = getLocalTodayKey();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  // 1. Fetch current profile from Supabase
  const { data: profile, error: fetchError } = await supabase
    .from('profiles')
    .select('current_streak, last_active_date')
    .eq('id', userId)
    .maybeSingle();

  if (fetchError) throw fetchError;

  if (profile) {
    if (profile.last_active_date !== today && profile.last_active_date !== yesterdayStr) {
      // Streak broken
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          current_streak: 0,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (updateError) throw updateError;

      // Update local mock storage for legacy compatibility
      const profiles = getStorageItem<Record<string, UserProfile>>('profiles') || {};
      if (profiles[userId]) {
        profiles[userId] = {
          ...profiles[userId],
          currentStreak: 0,
          updatedAt: new Date().toISOString()
        };
        setStorageItem('profiles', profiles);
      }
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
      if (!password || password.length < 6) {
        return { data: { session: null }, error: { message: "Invalid password. Must be at least 6 characters." } };
      }
      const profiles = getStorageItem<Record<string, UserProfile>>('profiles') || {};
      const existingProfile = Object.values(profiles).find(p => p.email === email);
      if (!existingProfile) {
        return { data: { session: null }, error: { message: "Invalid login credentials" } };
      }
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
      return { data: { session: { user, access_token: 'mock_token' }, user }, error: null };
    },
    signUp: async ({ email, password }: any) => {
      if (!password || password.length < 6) {
        return { data: { user: null }, error: { message: "Password must be at least 6 characters." } };
      }
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
      return { data: { user, session: { user, access_token: 'mock_token' } }, error: null };
    },
    onAuthStateChange: (callback: (event: string, session: any) => void) => {
      const unsubscribe = onAuthStateChange((user) => {
        callback('SIGNED_IN', user ? { user } : null);
      });
      return { data: { subscription: { unsubscribe } } };
    }
  },
  from: (table: string) => {
    let lastFilter: { field: string; value: any } | null = null;
    let pendingData: any = null;
    let operation: 'insert' | 'upsert' | 'update' | 'delete' | 'select' = 'select';

    const execute = async () => {
      let result: any = { data: [], error: null };

      if (operation === 'insert' || operation === 'upsert') {
        const dataArray = Array.isArray(pendingData) ? pendingData : [pendingData];
        const savedItems: any[] = [];

        for (const dataToSave of dataArray) {
          if (table === 'daily_activity') {
            const activities = getStorageItem<DailyActivityDB[]>('daily_activity') || [];
            const userId = dataToSave.user_id || dataToSave.userId;
            const date = dataToSave.date || dataToSave.activityDate;
            const index = activities.findIndex(a => a.userId === userId && a.activityDate === date);
            
            if (index > -1) {
              activities[index] = { ...activities[index], ...dataToSave, updatedAt: new Date().toISOString() };
              savedItems.push(activities[index]);
            } else {
              const newActivity = {
                id: Math.random().toString(36).substr(2, 9),
                userId,
                activityDate: date,
                steps: 0,
                caloriesBurned: 0,
                caloriesConsumed: 0,
                distanceKm: 0,
                isTargetMet: false,
                updatedAt: new Date().toISOString(),
                ...dataToSave
              };
              activities.push(newActivity);
              savedItems.push(newActivity);
            }
            setStorageItem('daily_activity', activities);
          } else if (table === 'profiles') {
            const profiles = getStorageItem<Record<string, UserProfile>>('profiles') || {};
            const id = dataToSave.id || dataToSave.uid;
            if (id) {
              profiles[id] = { ...profiles[id], ...dataToSave, updatedAt: new Date().toISOString() };
              setStorageItem('profiles', profiles);
              savedItems.push(profiles[id]);
            }
          } else {
            const items = getStorageItem<any[]>(table) || [];
            const newItem = { id: Math.random().toString(36).substr(2, 9), createdAt: new Date().toISOString(), ...dataToSave };
            items.push(newItem);
            setStorageItem(table, items);
            savedItems.push(newItem);
          }
        }
        result.data = savedItems;
      } else if (operation === 'select' || operation === 'update' || operation === 'delete') {
        if (table === 'profiles') {
          const profiles = getStorageItem<Record<string, UserProfile>>('profiles') || {};
          let profileList = Object.values(profiles);
          if (lastFilter) {
            profileList = profileList.filter(p => p[lastFilter!.field as keyof UserProfile] === lastFilter!.value || p.id === lastFilter!.value || p.email === lastFilter!.value);
          }
          if (operation === 'update' && profileList.length > 0 && pendingData) {
            profileList.forEach(p => { profiles[p.id] = { ...p, ...pendingData, updatedAt: new Date().toISOString() }; });
            setStorageItem('profiles', profiles);
            result.data = profileList.map(p => profiles[p.id]);
          } else if (operation === 'delete' && profileList.length > 0) {
            profileList.forEach(p => { delete profiles[p.id]; });
            setStorageItem('profiles', profiles);
            result.data = profileList;
          } else {
            result.data = profileList;
          }
        } else if (table === 'daily_activity') {
          const activities = getStorageItem<DailyActivityDB[]>('daily_activity') || [];
          let filtered = activities;
          if (lastFilter) {
            filtered = activities.filter(a => a[lastFilter!.field as keyof DailyActivityDB] === lastFilter!.value || a.userId === lastFilter!.value || a.activityDate === lastFilter!.value);
          }
          if (operation === 'update' && filtered.length > 0 && pendingData) {
            filtered.forEach(a => {
              const idx = activities.indexOf(a);
              activities[idx] = { ...a, ...pendingData, updatedAt: new Date().toISOString() };
            });
            setStorageItem('daily_activity', activities);
            result.data = filtered;
          } else if (operation === 'delete' && filtered.length > 0) {
            const remaining = activities.filter(a => !filtered.includes(a));
            setStorageItem('daily_activity', remaining);
            result.data = filtered;
          } else {
            result.data = filtered;
          }
        } else {
          let items = getStorageItem<any[]>(table) || [];
          if (lastFilter) {
            items = items.filter(item => item[lastFilter!.field] === lastFilter!.value);
          }
          if (operation === 'update' && pendingData) {
            const allItems = getStorageItem<any[]>(table) || [];
            const updatedItems: any[] = [];
            const newAllItems = allItems.map(item => {
              if (items.some(i => i.id === item.id)) {
                const updated = { ...item, ...pendingData, updatedAt: new Date().toISOString() };
                updatedItems.push(updated);
                return updated;
              }
              return item;
            });
            setStorageItem(table, newAllItems);
            result.data = updatedItems;
          } else if (operation === 'delete') {
            const allItems = getStorageItem<any[]>(table) || [];
            const newAllItems = allItems.filter(item => !items.some(i => i.id === item.id));
            setStorageItem(table, newAllItems);
            result.data = items;
          } else {
            result.data = items;
          }
        }
      }
      return result;
    };

    const chain: any = {
      select: (_fields?: string) => { if (operation === 'select') operation = 'select'; return chain; },
      insert: (data: any) => { operation = 'insert'; pendingData = data; return chain; },
      upsert: (data: any) => { operation = 'upsert'; pendingData = data; return chain; },
      update: (data: any) => { operation = 'update'; pendingData = data; return chain; },
      delete: () => { operation = 'delete'; return chain; },
      eq: (field: string, value: any) => { lastFilter = { field, value }; return chain; },
      order: (_field: string, _options?: any) => chain,
      limit: (_n: number) => chain,
      maybeSingle: async () => {
        const { data, error } = await execute();
        return { data: (Array.isArray(data) ? data[0] : data) || null, error };
      },
      single: async () => {
        const { data, error } = await execute();
        const result = Array.isArray(data) ? data[0] : data;
        if (!result || error) return { data: null, error: error || { message: 'Not found', code: 'PGRST116' }, status: 406 };
        return { data: result, error: null, status: 200 };
      },
      then: (onfulfilled: any, onrejected: any) => {
        return execute().then(onfulfilled, onrejected);
      }
    };
    return chain;
  },
  rpc: async (fn: string) => {
    if (fn === 'delete_user_account') {
      await deleteUserAccount();
      return { error: null };
    }
    return { error: new Error('Not implemented') };
  },
  channel: (_name: string) => ({
    on: (_event: string, _config: any, _callback: any) => ({
      subscribe: () => ({ unsubscribe: () => {} })
    }),
    subscribe: () => ({ unsubscribe: () => {} })
  }),
  removeChannel: (_channel: any) => {}
};

export const db = {
  // Mock db object if needed by other components
};
