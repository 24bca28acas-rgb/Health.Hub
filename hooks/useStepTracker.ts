
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, upsertDailyActivity, processStreakUpdate, getLocalTodayKey, checkAndAwardStreak } from '../services/storage';

interface StepTrackerHook {
  steps: number;
  calories: number;
  distance: number;
  hydration: number;
  hydrationGoal: number;
  caloriesConsumed: number;
  streak: number;
  history: any[];
  isTracking: boolean;
  toggleTracking: () => Promise<void>;
  refresh: () => Promise<void>;
  error: string | null;
  isLoading: boolean;
  updateOptimistically: (updates: Partial<{ steps: number; calories: number; distance: number; hydration: number; caloriesConsumed: number; streak: number }>) => void;
}

const useStepTracker = (userId: string | null, stepGoal: number): StepTrackerHook => {
  const [steps, setSteps] = useState(0);
  const [calories, setCalories] = useState(0);
  const [distance, setDistance] = useState(0);
  const [hydration, setHydration] = useState(0);
  const [hydrationGoal, setHydrationGoal] = useState(2.5);
  const [caloriesConsumed, setCaloriesConsumed] = useState(0);
  const [streak, setStreak] = useState(0);
  const [history, setHistory] = useState<any[]>([]);
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const syncTimer = useRef<any>(null);
  const lastSyncValue = useRef(0);
  const lastStepTime = useRef(0);
  const lastMag = useRef(0);
  const wakeLock = useRef<any>(null);

  // --- SERVER-FIRST INITIALIZATION ---
  const fetchTodayData = useCallback(async () => {
    // If user isn't loaded yet, do NOT keep spinning forever
    if (!userId) {
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true); // Start loading strictly before the fetch
    const today = getLocalTodayKey();

    // Safety timeout to prevent infinite loading
    const safetyTimeout = setTimeout(() => {
      setIsLoading(false);
      console.warn("Data fetch timed out, forcing loading state to false.");
    }, 10000);

    try {
      // 0. Check for yesterday's streak (Retrospective Awarding)
      await checkAndAwardStreak(userId, stepGoal);

      // 1. Fetch Today's Data from Supabase
      const { data, error: fetchError } = await supabase
        .from('daily_activity')
        .select('*')
        .eq('user_id', userId)
        .eq('date', today)
        .maybeSingle();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError; // Throw standard errors to be caught
      }

      if (data) {
        // Hydrate local React state with the database data
        setSteps(data.steps || 0);
        setCalories(data.calories_burned || 0);
        setDistance(data.distance_km || 0);
        setHydration(data.hydration || 0);
        setHydrationGoal(data.hydration_goal || 2.5);
        setCaloriesConsumed(data.calories_consumed || 0);
        lastSyncValue.current = data.steps || 0;
      }

      // 2. Fetch History & Profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('current_streak')
        .eq('id', userId)
        .maybeSingle();

      if (profileData) {
        setStreak(profileData.current_streak || 0);
      }

      const { data: historyData } = await supabase
        .from('daily_activity')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(7);

      if (historyData) {
        setHistory(historyData);
      }

    } catch (e) {
      console.error("Critical Fetch Error:", e);
      setError("Failed to load data from server.");
    } finally {
      // THIS IS THE FIX: This block runs NO MATTER WHAT (success or fail)
      clearTimeout(safetyTimeout);
      setIsLoading(false);
    }
  }, [userId, stepGoal]);

  useEffect(() => {
    fetchTodayData();
  }, [fetchTodayData]);

  // --- REALTIME SYNCHRONIZATION ---
  useEffect(() => {
    if (!userId) return;

    const today = getLocalTodayKey();
    const channel = supabase
      .channel(`daily_activity_${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'daily_activity',
          filter: `user_id=eq.${userId}`
        },
        (payload: any) => {
          const newData = payload.new;
          if (newData && newData.date === today) {
            // Only update if the change is from another device (optimistic update handles local)
            setSteps(newData.steps || 0);
            setCalories(newData.calories_burned || 0);
            setDistance(newData.distance_km || 0);
            setHydration(newData.hydration || 0);
            setHydrationGoal(newData.hydration_goal || 2.5);
            setCaloriesConsumed(newData.calories_consumed || 0);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // --- PERSISTENCE ENGINE (Debounced) ---
  useEffect(() => {
    if (!userId || isLoading) return;
    
    if (syncTimer.current) clearTimeout(syncTimer.current);

    syncTimer.current = setTimeout(async () => {
      // Standard Upsert for background tracking
      await upsertDailyActivity(userId, getLocalTodayKey(), steps, Math.floor(calories), parseFloat(distance.toFixed(3)), hydration, hydrationGoal, caloriesConsumed);
      
      // Check for streak update if goal met
      if (steps >= stepGoal) {
          const newStreak = await processStreakUpdate(userId, steps, stepGoal);
          if (newStreak) setStreak(newStreak);
      }
      
      lastSyncValue.current = steps;
    }, 2000); // 2s debounce to reduce write frequency

    return () => { if (syncTimer.current) clearTimeout(syncTimer.current); };
  }, [steps, userId, calories, distance, stepGoal, hydration, hydrationGoal, caloriesConsumed, isLoading]);

  // --- SENSOR LOGIC ---
  const handleMotion = useCallback((event: DeviceMotionEvent) => {
    const acc = event.accelerationIncludingGravity;
    if (!acc) return;
    const { x, y, z } = acc;
    if (x === null || y === null || z === null) return;

    const rawMag = Math.sqrt(x*x + y*y + z*z);
    const mag = 0.8 * rawMag + 0.2 * lastMag.current;
    lastMag.current = mag;

    const now = Date.now();
    if (mag > 13.0) {
      if (now - lastStepTime.current > 600) {
         setSteps(prev => {
             const next = prev + 1;
             // Increment calories/distance instead of recalculating from scratch
             // This preserves manual logs
             setCalories(c => c + 0.04);
             setDistance(d => d + 0.0008);
             return next;
         });
         lastStepTime.current = now;
         if (navigator.vibrate) navigator.vibrate(15);
      }
    }
  }, []);

  const toggleTracking = async () => {
    if (isTracking) {
      window.removeEventListener('devicemotion', handleMotion);
      if (wakeLock.current) await wakeLock.current.release();
      setIsTracking(false);
    } else {
      // Permission request for iOS
      // @ts-ignore
      if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
        try {
            // @ts-ignore
            const permission = await DeviceMotionEvent.requestPermission();
            if (permission !== 'granted') {
                setError("Sensor access denied.");
                return;
            }
        } catch (e) {
            setError("Sensors unavailable.");
            return;
        }
      }

      window.addEventListener('devicemotion', handleMotion);
      if ('wakeLock' in navigator) {
          try { wakeLock.current = await (navigator as any).wakeLock.request('screen'); } catch (e) {}
      }
      setIsTracking(true);
    }
  };

  const updateOptimistically = useCallback((updates: Partial<{ steps: number; calories: number; distance: number; hydration: number; caloriesConsumed: number; streak: number }>) => {
    // If updates is empty object, it's a bypass signal
    if (Object.keys(updates).length === 0) {
      setIsLoading(false);
      return;
    }
    if (updates.steps !== undefined) setSteps(updates.steps);
    if (updates.calories !== undefined) setCalories(updates.calories);
    if (updates.distance !== undefined) setDistance(updates.distance);
    if (updates.hydration !== undefined) setHydration(updates.hydration);
    if (updates.caloriesConsumed !== undefined) setCaloriesConsumed(updates.caloriesConsumed);
    if (updates.streak !== undefined) setStreak(updates.streak);
  }, []);

  return { steps, calories, distance, hydration, hydrationGoal, caloriesConsumed, streak, history, isTracking, toggleTracking, refresh: fetchTodayData, error, isLoading, updateOptimistically };
};

export default useStepTracker;
