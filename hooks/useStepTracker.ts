
import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchFullUserDashboard, upsertDailyActivity, processStreakUpdate, getLocalTodayKey, checkAndAwardStreak, onAuthStateChange } from '../services/storage';

interface StepTrackerHook {
  steps: number;
  calories: number;
  distance: number;
  streak: number;
  history: any[];
  isTracking: boolean;
  toggleTracking: () => Promise<void>;
  refresh: () => Promise<void>;
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

  const loadSessionData = useCallback(async () => {
    if (!userId) {
        setIsLoading(false);
        return;
    }
    
    try {
      // 0. Check for yesterday's streak (Retrospective Awarding)
      await checkAndAwardStreak(userId, stepGoal);

      // 1. Fetch Dashboard Data (Today + History + Profile)
      const dashboard = await fetchFullUserDashboard(userId);

      if (dashboard) {
        if (dashboard.activity) {
          setSteps(dashboard.activity.steps || 0);
          setCalories(dashboard.activity.caloriesBurned || 0);
          setDistance(dashboard.activity.distanceKm || 0);
          lastSyncValue.current = dashboard.activity.steps || 0;
        }
        
        if (dashboard.profile) {
          setStreak(dashboard.profile.currentStreak || 0);
        }
        
        setHistory(dashboard.history || []);
      }

    } catch (e) {
      console.error("Initialization Error:", e);
    } finally {
      setIsLoading(false);
    }
  }, [userId, stepGoal]);

  // --- INITIALIZATION ---
  useEffect(() => {
    loadSessionData();
  }, [loadSessionData]); // Only run on mount or user/goal change

  // --- PERSISTENCE ENGINE (Debounced) ---
  useEffect(() => {
    if (!userId) return;
    
    if (syncTimer.current) clearTimeout(syncTimer.current);

    syncTimer.current = setTimeout(async () => {
      // Standard Upsert for background tracking
      await upsertDailyActivity(userId, getLocalTodayKey(), steps, Math.floor(calories), parseFloat(distance.toFixed(3)));
      
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

  return { steps, calories, distance, streak, history, isTracking, toggleTracking, refresh: loadSessionData, error, isLoading };
};

export default useStepTracker;
