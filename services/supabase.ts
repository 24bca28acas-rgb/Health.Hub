
import { createClient, type User, type SupportedStorage } from '@supabase/supabase-js';
import { ActivityData, UserMetrics, UserProfile, DailyActivityDB, FoodLogDB, ChatHistoryDB, SavedWorkoutDB, WorkoutPlan } from '../types';

export type { User } from '@supabase/supabase-js';

console.log("Supabase URL Status: ", !!import.meta.env.VITE_SUPABASE_URL);

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://tngzcpgoshpfwuarskul.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRuZ3pjcGdvc2hwZnd1YXJza3VsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0NjY5NTksImV4cCI6MjA4NjA0Mjk1OX0.OKH4nWdTFa7OZ6NoAfAeuD6HFlJGvmJ-aYfdZ3rpBp4';
const PROJECT_ID = SUPABASE_URL.split('//')[1]?.split('.')[0] || 'tngzcpgoshpfwuarskul';

export const performMaintenance = (force: boolean = false) => {
  try {
    const currentAuthKey = `sb-${PROJECT_ID}-auth-token`;
    const keys = Object.keys(localStorage);
    
    // Always clear old project tokens
    keys.forEach(key => {
      if (key.startsWith('sb-') && !key.includes(PROJECT_ID)) {
        localStorage.removeItem(key);
      }
    });

    if (force) {
        // Clear non-essential application state
        const nonEssentialKeys = [
          'food_history', 
          'chat_history', 
          'workout_lab_cache', 
          'bmi_metrics', 
          'app_state', 
          'streak_data',
          'ai_thinking_mode',
          'adaptive_goals_enabled',
          'hydration_reminders_enabled'
        ];
        
        nonEssentialKeys.forEach(k => {
          if (k !== currentAuthKey) {
            localStorage.removeItem(k);
          }
        });

        // If still forced and needed, we can clear everything except auth
        // but let's stick to these for now.
        return;
    }
  } catch (e) {
    console.warn("Maintenance failed", e);
  }
};

const memoryStorage = new Map<string, string>();

// Helper to check if localStorage is actually usable (not 0 quota or disabled)
const checkStorageHealth = (): boolean => {
  try {
    const testKey = '__health_check__';
    localStorage.setItem(testKey, '1');
    localStorage.removeItem(testKey);
    return true;
  } catch (e) {
    return false;
  }
};

let isLocalStorageAvailable = checkStorageHealth();

const adaptiveStorage: SupportedStorage = {
  getItem: (key) => {
    if (!isLocalStorageAvailable) return memoryStorage.get(key) ?? null;
    try {
      return localStorage.getItem(key) ?? memoryStorage.get(key) ?? null;
    } catch (e) {
      return memoryStorage.get(key) ?? null;
    }
  },
  setItem: (key, value) => {
    if (!isLocalStorageAvailable) {
      memoryStorage.set(key, value);
      return;
    }

    try {
      localStorage.setItem(key, value);
    } catch (e: any) {
      const isQuotaError = e.name === 'QuotaExceededError' || e.message?.toLowerCase().includes('quota');
      
      if (isQuotaError) {
        // Only attempt maintenance if we think storage is actually functional
        console.warn(`[Storage] Quota exceeded for "${key}". Attempting cleanup...`);
        performMaintenance(true);
        
        try {
          localStorage.setItem(key, value);
        } catch (retryError) {
          // If it still fails, check if storage is even functional anymore
          isLocalStorageAvailable = checkStorageHealth();
          
          if (!isLocalStorageAvailable) {
            console.warn("[Storage] LocalStorage appears disabled or zero-quota. Switching to memory fallback.");
            memoryStorage.set(key, value);
          } else {
            // Destructive fallback only if storage is functional but still full
            try {
              // Instead of full clear, let's be more surgical to avoid logging out if possible
              const currentAuthKey = `sb-${PROJECT_ID}-auth-token`;
              Object.keys(localStorage).forEach(k => {
                if (k !== currentAuthKey) localStorage.removeItem(k);
              });
              localStorage.setItem(key, value);
            } catch (finalError) {
              memoryStorage.set(key, value);
            }
          }
        }
      } else {
        // Non-quota error (SecurityError, etc) - likely disabled
        isLocalStorageAvailable = false;
        memoryStorage.set(key, value);
      }
    }
  },
  removeItem: (key) => {
    if (isLocalStorageAvailable) {
      try {
        localStorage.removeItem(key);
      } catch (e) {}
    }
    memoryStorage.delete(key);
  }
};

// CRITICAL: Web-Specific Configuration for No-Router Environment
// Prevent multiple GoTrueClient instances during HMR
const authStorageKey = `sb-${PROJECT_ID}-auth-token`;

// Emergency cleanup for bloated JWTs (e.g. base64 images saved in user_metadata)
try {
  const existingToken = localStorage.getItem(authStorageKey);
  // Nginx default header limit is 8KB. A normal JWT is ~1.5KB.
  // If the token is > 6000 chars, it will likely cause a 431 Request Header Fields Too Large error (Failed to fetch).
  if (existingToken && existingToken.length > 6000) { 
    console.warn("[Storage] Detected bloated auth token. Clearing to prevent 'Failed to fetch' and quota errors.");
    localStorage.removeItem(authStorageKey);
  }
} catch (e) {
  // Ignore
}

export const supabase = (window as any)._supabaseClient || createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { 
    persistSession: true, 
    autoRefreshToken: true,
    detectSessionInUrl: false, // Prevents URL manipulation which causes 404s in preview
    storageKey: authStorageKey, 
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

export const checkConnection = async () => {
  try {
    const { error } = await supabase.from('profiles').select('count', { count: 'exact', head: true });
    if (error) throw error;
    return true;
  } catch (e) {
    console.error("Supabase Connection Check Failed:", e);
    return false;
  }
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
  
  if (data.session?.access_token && data.session.access_token.length > 4000) {
    await supabase.auth.signOut({ scope: 'local' });
    throw new Error("Account corrupted: Avatar data too large. Please create a new account.");
  }
  
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

export const updateProfile = async (user: User, profile: { displayName?: string, photoURL?: string, metrics?: UserMetrics, goals?: any }) => {
  if (isGuest(user.id)) return;

  console.log("--- EXTREME DEBUG: START PROFILE SAVE ---");
  console.log(`Target User ID: ${user.id}`);
  
  // 1. Check Session
  const { data: { session } } = await supabase.auth.getSession();
  console.log(`Access Token Active: ${!!session?.access_token}`);

  // 1.5 Check Connection
  const isConnected = await checkConnection();
  if (!isConnected) throw new Error("Network Error: Cannot reach database. Check your connection.");

  try {
    // 2. Prepare Payload Map with Strict Typing
    const payload: Record<string, any> = {};
    
    // Name & Avatar
    if (profile.displayName) payload.name = String(profile.displayName).trim();
    if (profile.photoURL) payload.avatar_url = String(profile.photoURL).trim();

    // Metrics & DOB Handling
    if (profile.metrics) {
      const metrics = profile.metrics;
      
      // STRICT DOB HANDLING: Ensure YYYY-MM-DD string
      let dobString = null;
      if (metrics.dob) {
        if ((metrics.dob as any) instanceof Date) {
           dobString = (metrics.dob as any).toISOString().split('T')[0];
        } else if (typeof metrics.dob === 'string') {
           // Verify format or substring
           dobString = metrics.dob.substring(0, 10); 
        }
      }

      // Construct metrics JSONB
      const safeMetrics = {
        height: Number(metrics.height) || 0,
        weight: Number(metrics.weight) || 0,
        age: Number(metrics.age) || 0,
        gender: String(metrics.gender || 'Other'),
        activityLevel: String(metrics.activityLevel || 'Sedentary'),
        fitnessGoal: String(metrics.fitnessGoal || 'Maintain'),
        dob: dobString
      };

      payload.metrics = safeMetrics;
      payload.weight = safeMetrics.weight; // Top-level column sync
      payload.height = safeMetrics.height; // Top-level column sync
    }

    // Goals Handling
    if (profile.goals) {
      const safeGoals = {
        stepGoal: Number(profile.goals.stepGoal) || 10000,
        calorieGoal: Number(profile.goals.calorieGoal) || 2000,
        distanceGoal: Number(profile.goals.distanceGoal) || 5.0,
        proteinGoal: Number(profile.goals.proteinGoal) || 150
      };
      payload.goals = safeGoals;
      payload.daily_step_goal = safeGoals.stepGoal;       // Top-level column sync
      payload.daily_calorie_goal = safeGoals.calorieGoal; // Top-level column sync
      payload.target_steps = safeGoals.stepGoal;          // Legacy column sync
      payload.target_calories = safeGoals.calorieGoal;    // Legacy column sync
    }

    payload.updated_at = new Date().toISOString();

    // 3. Deep Logging of Payload
    console.log("--- PAYLOAD AUDIT ---");
    Object.keys(payload).forEach(key => {
      console.log(`Key: ${key}, Value: ${payload[key]}, Type: ${typeof payload[key]}`);
    });

    // 4. Update Auth Metadata (Separate Call)
    if (profile.displayName) {
       const { error: authError } = await supabase.auth.updateUser({ 
         data: { 
           full_name: profile.displayName
         } 
       });
       if (authError) console.error("Auth Metadata Update Warning:", authError);
    }

    // 5. Execute Database Update
    if (Object.keys(payload).length > 0) {
      const { data, error } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', user.id)
        .select();

      if (error) {
        console.error("--- SUPABASE DB ERROR ---");
        console.error(`Code: ${error.code}`);
        console.error(`Message: ${error.message}`);
        console.error(`Details: ${error.details}`);
        throw error;
      }
      
      console.log("--- SAVE SUCCESSFUL ---");
      console.log("Response Data:", data);
    }

  } catch (e: any) {
    console.error("--- CRITICAL SAVE FAILURE ---");
    console.error("Error Object:", e);
    if (e.stack) {
      console.error("Stack Trace:", e.stack);
    }
    throw e;
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

export const sanitizeUserMetadata = async (user: User) => {
  if (user.user_metadata?.avatar_url && user.user_metadata.avatar_url.startsWith('data:image')) {
    console.log("Sanitizing bloated user_metadata...");
    const { error } = await supabase.auth.updateUser({
      data: { avatar_url: null }
    });
    if (error) {
      console.error("Failed to sanitize user_metadata:", error);
      // If we can't sanitize it, the account is permanently corrupted
      await supabase.auth.signOut({ scope: 'local' });
      throw new Error("Account corrupted: Avatar data too large. Please create a new account.");
    }
  }
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

// --- ACTIVITY LOGGING ---

export const logActivity = async (userId: string, activity: { activity_type: string, duration_minutes: number, intensity: string, calories_burned: number, notes?: string }) => {
  if (isGuest(userId)) return;
  
  try {
    // 0. Check connection first
    const isConnected = await checkConnection();
    if (!isConnected) throw new Error("Network Error: Cannot reach database.");

    // 1. Log the individual session
    const { error } = await supabase.from('activity_logs').insert({
      user_id: userId,
      ...activity,
      created_at: new Date().toISOString()
    });
    
    if (error) {
      // If table doesn't exist, we just log error and proceed to update daily totals
      console.warn("Activity Log Table Error (might be missing):", error);
    }

    // 2. Update Daily Totals
    const todayKey = getLocalTodayKey();
    
    // Fetch current daily activity to increment
    const { data: currentDaily } = await supabase
      .from('daily_activity')
      .select('calories_burned, steps, distance_km')
      .eq('user_id', userId)
      .eq('activity_date', todayKey)
      .maybeSingle();

    const currentCalories = currentDaily?.calories_burned || 0;
    const newCalories = currentCalories + activity.calories_burned;
    
    // Upsert daily activity
    // We need to be careful not to overwrite other fields if we are just creating it
    const upsertPayload: any = {
      user_id: userId,
      activity_date: todayKey,
      calories_burned: newCalories,
      updated_at: new Date().toISOString()
    };

    // If record exists, we just update calories. If not, we set defaults.
    if (!currentDaily) {
        upsertPayload.steps = 0;
        upsertPayload.distance_km = 0;
        upsertPayload.is_target_met = false;
    }

    if (currentDaily) {
        const { error: updateError } = await supabase.from('daily_activity').update({ 
            calories_burned: newCalories,
            updated_at: new Date().toISOString()
        }).eq('user_id', userId).eq('activity_date', todayKey);
        
        if (updateError) throw updateError;
    } else {
        const { error: insertError } = await supabase.from('daily_activity').insert(upsertPayload);
        if (insertError) throw insertError;
    }
  } catch (e: any) {
    console.error("Log Activity Failed:", e);
    throw e; // Re-throw for UI to handle
  }
};

export const fetchActivityLogs = async (userId: string) => {
  if (isGuest(userId)) return [];
  const { data, error } = await supabase
    .from('activity_logs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);
    
  if (error) {
      if (error.code === '42P01') return []; // Table missing
      console.error("Fetch Activity Logs Error:", error);
      return [];
  }
  return data || [];
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
