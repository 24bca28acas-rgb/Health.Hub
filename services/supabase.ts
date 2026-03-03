
import { createClient, type User, type SupportedStorage } from '@supabase/supabase-js';
import { ActivityData, UserMetrics, UserProfile, DailyActivityDB, FoodLogDB, ChatHistoryDB, SavedWorkoutDB, WorkoutPlan } from '../types';

export type { User } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://tngzcpgoshpfwuarskul.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_OyoWs8f9j8fNI9Y4YbPilg_tFtAQUNX';
const PROJECT_ID = 'tngzcpgoshpfwuarskul';

export const performMaintenance = (force: boolean = false) => {
  try {
    const currentAuthKey = `sb-${PROJECT_ID}-auth-token`;
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('sb-') && !key.includes(PROJECT_ID)) {
        localStorage.removeItem(key);
      }
    });
    if (force) {
        const heavyKeys = ['food_history', 'chat_history', 'workout_lab_cache', 'bmi_metrics', 'app_state', 'streak_data'];
        heavyKeys.forEach(k => {
          if (k !== currentAuthKey) localStorage.removeItem(k);
        });
        return;
    }
  } catch (e) {}
};

const adaptiveStorage: SupportedStorage = {
  getItem: (key) => { try { return localStorage.getItem(key); } catch (e) { return null; } },
  setItem: (key, value) => {
    try { localStorage.setItem(key, value); } catch (e: any) {
      if (e.name === 'QuotaExceededError' || e.message.includes('quota')) {
        performMaintenance(true); 
        try { localStorage.setItem(key, value); } catch (retryError) {
          localStorage.clear(); 
          try { localStorage.setItem(key, value); } catch (finalError) {
            throw finalError;
          }
        }
      } else {
        throw e;
      }
    }
  },
  removeItem: (key) => { try { localStorage.removeItem(key); } catch (e) {} }
};

// CRITICAL: Web-Specific Configuration for No-Router Environment
// Prevent multiple GoTrueClient instances during HMR
export const supabase = (window as any)._supabaseClient || createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { 
    persistSession: true, 
    autoRefreshToken: true,
    detectSessionInUrl: false, // Prevents URL manipulation which causes 404s in preview
    storageKey: `sb-${PROJECT_ID}-auth-token`, 
    storage: adaptiveStorage 
  }
});

if (!(window as any)._supabaseClient) {
  (window as any)._supabaseClient = supabase;
}

export const DEFAULT_AVATAR = "https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png";

export const getLocalTodayKey = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

export const getYesterdayKey = (): string => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const isGuest = (userId: string | undefined): boolean => {
  if (!userId) return false;
  return userId.startsWith('guest_') || localStorage.getItem('healthy_hub_guest_session') === 'true';
};

// --- BIOMETRIC & STREAK SYNC ENGINE ---

/**
 * Basic Upsert (Overwrites values - used by Pedometer mostly)
 */
export const upsertDailyActivity = async (userId: string, steps: number, calories: number, distance: number) => {
  if (isGuest(userId)) return;
  const todayKey = getLocalTodayKey();
  try {
    const { error } = await supabase.from('daily_activity').upsert({ 
      user_id: userId, 
      activity_date: todayKey, 
      steps, 
      calories_burned: calories, 
      distance_km: distance,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id, activity_date' });
    if (error) throw error;
  } catch (e) {
    console.error(`Biometric Sync Failure:`, e);
  }
};

/**
 * INCREMENTAL UPDATE (Used by Map Tracking)
 * Fetches current DB value and ADDS to it to prevent overwriting background steps.
 */
export const incrementMapSession = async (userId: string, sessionSteps: number, sessionCals: number, sessionDist: number) => {
  if (isGuest(userId)) return;
  const todayKey = getLocalTodayKey();

  try {
    // 1. Fetch current data
    const { data: currentData } = await supabase
      .from('daily_activity')
      .select('steps, calories_burned, distance_km')
      .eq('user_id', userId)
      .eq('activity_date', todayKey)
      .maybeSingle();

    const existingSteps = currentData?.steps || 0;
    const existingCals = currentData?.calories_burned || 0;
    const existingDist = currentData?.distance_km || 0;

    // 2. Add Session Data
    const newSteps = existingSteps + sessionSteps;
    const newCals = existingCals + sessionCals;
    const newDist = existingDist + sessionDist;

    // 3. Upsert New Total
    const { error } = await supabase.from('daily_activity').upsert({
      user_id: userId,
      activity_date: todayKey,
      steps: newSteps,
      calories_burned: newCals,
      distance_km: newDist,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id, activity_date' });

    if (error) throw error;
    console.log("Map Session Synced via Delta Logic");
  } catch (e) {
    console.error("Map Sync Error:", e);
  }
};

/**
 * RETROSPECTIVE STREAK CHECK
 * Checks yesterday's activity on app load. If goal met & not awarded, increments streak.
 */
export const checkAndAwardStreak = async (userId: string, stepGoal: number) => {
  if (isGuest(userId)) return;
  const yesterday = getYesterdayKey();

  try {
    // 1. Check Yesterday's Data
    const { data: activity } = await supabase
      .from('daily_activity')
      .select('steps, streak_awarded')
      .eq('user_id', userId)
      .eq('activity_date', yesterday)
      .maybeSingle();

    if (!activity) return;

    // 2. If Goal Met AND Not Awarded
    if (activity.steps >= stepGoal && !activity.streak_awarded) {
      
      // 3. Increment Profile Streak
      const { data: profile } = await supabase.from('profiles').select('current_streak').eq('id', userId).single();
      const newStreak = (profile?.current_streak || 0) + 1;

      await supabase.from('profiles').update({ 
        current_streak: newStreak,
        last_active_date: yesterday 
      }).eq('id', userId);

      // 4. Mark Activity as Awarded
      await supabase.from('daily_activity').update({ 
        streak_awarded: true 
      }).eq('user_id', userId).eq('activity_date', yesterday);

      console.log(`🏆 Retrospective Streak Awarded! New streak: ${newStreak}`);
    }
  } catch (e) {
    console.error("Streak Check Error:", e);
  }
};

/**
 * Immediate Streak Update (Runs during Pedometer Sync)
 */
export const processStreakUpdate = async (userId: string, steps: number, goal: number) => {
  if (isGuest(userId) || steps < goal) return;
  
  try {
    const today = getLocalTodayKey();
    const yesterday = getYesterdayKey();

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('current_streak, last_active_date')
      .eq('id', userId)
      .single();

    if (error) throw error;

    const lastActive = profile.last_active_date;
    let newStreak = profile.current_streak || 0;

    if (lastActive === today) {
        return; // Already handled
    } else if (lastActive === yesterday) {
        newStreak += 1;
    } else {
        newStreak = 1;
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        current_streak: newStreak,
        last_active_date: today
      })
      .eq('id', userId);

    if (updateError) throw updateError;
    return newStreak;
  } catch (e) {
    console.error("Streak Sync Failure:", e);
  }
};

export const fetchFullUserDashboard = async (userId: string) => {
  if (isGuest(userId)) return null;
  try {
    const todayKey = getLocalTodayKey();
    const { data: profileData } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    const { data: activityData } = await supabase.from('daily_activity').select('*').eq('user_id', userId).eq('activity_date', todayKey).maybeSingle();
    const { data: historyData } = await supabase.from('daily_activity').select('*').eq('user_id', userId).order('activity_date', { ascending: false }).limit(7);
    
    return {
      profile: mapProfileToAppFormat(profileData),
      todayActivity: activityData || null,
      history: historyData || []
    };
  } catch (e) {
    return null;
  }
};

const mapProfileToAppFormat = (dbProfile: any): UserProfile => {
  const safeGoals = dbProfile.goals || {};
  return {
    id: dbProfile.id,
    name: dbProfile.name || 'Elite Member',
    email: dbProfile.email || '',
    avatarUrl: dbProfile.avatar_url || DEFAULT_AVATAR,
    currentStreak: dbProfile.current_streak || 0,
    lastActiveDate: dbProfile.last_active_date,
    goals: {
        stepGoal: safeGoals.stepGoal || dbProfile.daily_step_goal || 10000,
        calorieGoal: safeGoals.calorieGoal || 2000,
        distanceGoal: safeGoals.distanceGoal || 5.0,
        proteinGoal: safeGoals.proteinGoal
    },
    metrics: dbProfile.metrics || {}
  };
};

export const onAuthStateChanged = (callback: (user: User | null) => void) => {
  const guestActive = localStorage.getItem('healthy_hub_guest_session') === 'true';
  if (guestActive) callback(getGuestUser());
  return supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.user) {
      localStorage.removeItem('healthy_hub_guest_session');
      callback(session.user);
    } else if (!guestActive) {
      callback(null);
    }
  }).data.subscription.unsubscribe;
};

export const getGuestUser = (): User => ({
  id: 'guest_elite_member',
  email: 'guest@healthyhub.com',
  app_metadata: {},
  user_metadata: { full_name: 'Guest Elite' },
  aud: 'authenticated',
  created_at: new Date().toISOString()
});

export const signInAsGuest = () => {
  localStorage.setItem('healthy_hub_guest_session', 'true');
  window.location.reload();
};

export const signInWithEmailAndPassword = async (email: string, psw: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: psw });
  if (error) throw error;
  return data;
};

export const signOut = async () => {
  localStorage.removeItem('healthy_hub_guest_session');
  await supabase.auth.signOut({ scope: 'local' });
};

export const createUserWithEmailAndPassword = async (email: string, psw: string) => {
  const { data, error } = await supabase.auth.signUp({ email, password: psw });
  if (error) throw error;
  return { data };
};

export const createUserDocument = async (user: User, name: string) => {
  await supabase.from('profiles').upsert({ id: user.id, email: user.email, name, avatar_url: DEFAULT_AVATAR });
};

export const updateProfile = async (user: User, profile: { displayName?: string, photoURL?: string }) => {
  await supabase.auth.updateUser({ data: { full_name: profile.displayName, avatar_url: profile.photoURL } });
  const updateData: any = {};
  if (profile.displayName) updateData.name = profile.displayName;
  if (profile.photoURL) updateData.avatar_url = profile.photoURL;
  if (Object.keys(updateData).length > 0) {
    await supabase.from('profiles').update(updateData).eq('id', user.id);
  }
};

export const sendPasswordResetEmail = async (email: string) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw error;
};

export const fetchChatHistory = async (userId: string) => {
  const { data, error } = await supabase.from('chat_history').select('*').eq('user_id', userId).order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
};

export const saveChatMessage = async (userId: string, message: string, isUserMessage: boolean, planData?: any) => {
  await supabase.from('chat_history').insert({ user_id: userId, message, is_user_message: isUserMessage, plan_data: planData });
};

export const clearChatHistory = async (userId: string) => {
  await supabase.from('chat_history').delete().eq('user_id', userId);
};

export const updateUserMetrics = async (userId: string, metrics: UserMetrics) => {
  await supabase.from('profiles').update({ metrics, height: metrics.height, weight: metrics.weight }).eq('id', userId);
};

export const updateUserTargets = async (userId: string, planData: any) => {
  await supabase.from('profiles').update({
    goals: {
        stepGoal: planData.target_steps || planData.steps,
        calorieGoal: planData.target_calories || planData.calories,
        distanceGoal: 5.0, // Default preserve
        proteinGoal: planData.target_protein || planData.protein
    },
    daily_step_goal: planData.target_steps || planData.steps,
    current_plan_name: planData.plan_name
  }).eq('id', userId);
};

export const fetchSavedWorkouts = async (userId: string) => {
  const { data, error } = await supabase.from('saved_workouts').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const saveWorkout = async (userId: string, plan: WorkoutPlan) => {
  await supabase.from('saved_workouts').insert({ user_id: userId, plan_data: plan });
};

export const deleteWorkout = async (id: string) => {
  await supabase.from('saved_workouts').delete().eq('id', id);
};

export const submitAiFeedback = async (imageUrl: string, prediction: string, feedback: string) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from('ai_feedback').insert({ user_id: user.id, image_url: imageUrl, prediction, feedback });
};

export const completeOnboarding = async (user: User, profileData: any, activityGoals: ActivityData) => {
  // CRITICAL: Construct the payload with the ID field explicit for RLS 'Using (auth.uid() = id)' policy.
  const profilePayload = {
    id: user.id, // MANDATORY FOR RLS
    email: profileData.email,
    name: profileData.name,
    avatar_url: profileData.avatarUrl || DEFAULT_AVATAR,
    metrics: profileData.metrics, // Stored as JSONB
    goals: { // Stored as JSONB
        stepGoal: activityGoals.stepGoal,
        calorieGoal: activityGoals.calorieGoal,
        distanceGoal: activityGoals.distanceGoal
    },
    // Map to specific columns if they exist in schema for older SQL compatibility
    daily_step_goal: activityGoals.stepGoal,
    height: profileData.metrics.height,
    weight: profileData.metrics.weight,
    updated_at: new Date().toISOString()
  };

  const { error: profileError } = await supabase
    .from('profiles')
    .upsert(profilePayload);

  if (profileError) throw profileError;

  return mapProfileToAppFormat({ ...profileData, id: user.id, goals: profilePayload.goals });
};
