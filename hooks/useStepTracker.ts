
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, upsertDailyActivity, processStreakUpdate, getLocalTodayKey, checkAndAwardStreak } from '../services/supabase';

interface StepTrackerHook {
  steps: number;
  calories: number;
  distance: number;
  streak: number;
  history: any[];
  isTracking: boolean;
  toggleTracking: () => Promise<void>;
  error: string | null;
  isLoading: boolean;
}

const useStepTracker = (userId: string | null, stepGoal: number): StepTrackerHook => {
  const [steps, setSteps] = useState(0);
  const [calories, setCalories] = useState(0);
  const [distance, setDistance] = useState(0);
  const [streak, setStreak] = useState(0);
  const [history, setHistory] = useState<any[]>([]);
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Replaced NodeJS.Timeout with any for compatibility in a web/browser context.
  const syncTimer = useRef<any>(null);
  const lastSyncValue = useRef(0);
  const lastStepTime = useRef(0);
  const lastMag = useRef(0);
  const wakeLock = useRef<any>(null);

  // --- INITIALIZATION & REALTIME SYNC ---
  useEffect(() => {
    let subscription: any = null;

    const loadSessionData = async () => {
      if (!userId) {
          setIsLoading(false);
          return;
      }
      
      try {
        const today = getLocalTodayKey();
        
        // 0. Check for yesterday's streak (Retrospective Awarding)
        await checkAndAwardStreak(userId, stepGoal);

        // 1. Fetch Today's Current Progress
        const { data: activity } = await supabase
          .from('daily_activity')
          .select('*')
          .eq('user_id', userId)
          .eq('activity_date', today)
          .maybeSingle();

        if (activity) {
          setSteps(activity.steps || 0);
          setCalories(activity.calories_burned || 0);
          setDistance(activity.distance_km || 0);
          lastSyncValue.current = activity.steps || 0;
        }

        // 2. Fetch Profile Streak
        const { data: profile } = await supabase
          .from('profiles')
          .select('current_streak')
          .eq('id', userId)
          .maybeSingle();

        if (profile) {
          setStreak(profile.current_streak || 0);
        }

        // 3. Fetch History (7 Days)
        const { data: hist } = await supabase
          .from('daily_activity')
          .select('*')
          .eq('user_id', userId)
          .order('activity_date', { ascending: false })
          .limit(7);
        
        setHistory(hist || []);

        // 4. REALTIME LISTENER (The Sync Glue)
        // If MapTrackingScreen updates the DB, this listener catches it and updates local state
        // This effectively implements "Delta Logic" because subsequent local steps will start adding from this new base.
        subscription = supabase
          .channel('public:daily_activity')
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'daily_activity',
              filter: `user_id=eq.${userId}`
            },
            (payload) => {
              const newData = payload.new;
              if (newData.activity_date === today) {
                // Only update if the DB value is higher (prevents race conditions with our own debounced writes)
                if (newData.steps > steps) {
                    setSteps(newData.steps);
                    setCalories(newData.calories_burned);
                    setDistance(newData.distance_km);
                    lastSyncValue.current = newData.steps; // Update baseline so we don't double-save
                }
              }
            }
          )
          .subscribe();

      } catch (e) {
        console.error("Initialization Error:", e);
      } finally {
        setIsLoading(false);
      }
    };

    loadSessionData();

    return () => {
      if (subscription) supabase.removeChannel(subscription);
    };
  }, [userId]); // Only run on mount or user change

  // --- PERSISTENCE ENGINE (Debounced) ---
  useEffect(() => {
    if (!userId || steps === lastSyncValue.current) return;

    if (syncTimer.current) clearTimeout(syncTimer.current);

    syncTimer.current = setTimeout(async () => {
      // Standard Upsert for background tracking
      await upsertDailyActivity(userId, steps, Math.floor(calories), parseFloat(distance.toFixed(3)));
      
      // Check for streak update if goal met
      if (steps >= stepGoal) {
          const newStreak = await processStreakUpdate(userId, steps, stepGoal);
          if (newStreak) setStreak(newStreak);
      }
      
      lastSyncValue.current = steps;
    }, 1500); // 1.5s debounce

    return () => { if (syncTimer.current) clearTimeout(syncTimer.current); };
  }, [steps, userId, calories, distance, stepGoal]);

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
             setCalories(next * 0.04);
             setDistance(next * 0.0008);
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

  return { steps, calories, distance, streak, history, isTracking, toggleTracking, error, isLoading };
};

export default useStepTracker;
