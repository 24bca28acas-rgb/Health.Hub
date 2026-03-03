
import { useState, useEffect, useRef, useCallback } from 'react';

interface PedometerHook {
  isTracking: boolean;
  toggleTracking: () => Promise<void>;
  liveSteps: number;
  resetLiveSteps: () => void;
  status: 'Idle' | 'Active' | 'Walking';
  error: string | null;
  isSupported: boolean;
}

const usePedometer = (): PedometerHook => {
  const [isTracking, setIsTracking] = useState(false);
  const [liveSteps, setLiveSteps] = useState(0);
  const [status, setStatus] = useState<'Idle' | 'Active' | 'Walking'>('Idle');
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);
  
  const wakeLock = useRef<WakeLockSentinel | null>(null);
  const lastStepTime = useRef(0);
  const lastMag = useRef(0); // For smoothing
  
  const isTrackingRef = useRef(isTracking);
  const statusRef = useRef(status);

  useEffect(() => { isTrackingRef.current = isTracking; }, [isTracking]);
  useEffect(() => { statusRef.current = status; }, [status]);

  // Check support on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && !window.DeviceMotionEvent) {
      setIsSupported(false);
      setError("Device sensors unavailable on this hardware.");
    }
  }, []);

  // Algorithm Parameters
  // 1. Magnitude Threshold: Increased to 13.0 (approx 1.3g) to filter small shakes.
  //    Standard Gravity is ~9.8m/s². Walking peaks exceed this.
  const MAGNITUDE_THRESHOLD = 13.0; 
  
  // 2. Time Debounce: Minimum 600ms between steps.
  //    This limits cadence to max ~100 steps/min, filtering jitter.
  const STEP_DELAY_MS = 600; 

  // Smoothing Factor (Low-Pass Filter)
  const ALPHA = 0.8; 

  const handleMotion = useCallback((event: DeviceMotionEvent) => {
    if (!isTrackingRef.current) return;

    // Use accelerationIncludingGravity to measure total force relative to Earth (9.8 baseline)
    const acc = event.accelerationIncludingGravity;
    if (!acc) return;
    
    const { x, y, z } = acc;
    if (x === null || y === null || z === null) return;

    // Calculate Magnitude
    const rawMag = Math.sqrt(x*x + y*y + z*z);
    
    // Apply Low-Pass Filter (Smoothing)
    // smoothed = alpha * new + (1 - alpha) * old
    const mag = ALPHA * rawMag + (1 - ALPHA) * lastMag.current;
    lastMag.current = mag;

    const now = Date.now();

    // Activity Detection (Idle vs Active)
    // If movement is slightly above gravity (e.g., > 10.5), we are 'Active'
    if (mag > 10.5 && statusRef.current === 'Idle') {
         setStatus('Active');
    }

    // Step Detection Logic
    if (mag > MAGNITUDE_THRESHOLD) {
      if (now - lastStepTime.current > STEP_DELAY_MS) {
         setLiveSteps(prev => prev + 1);
         lastStepTime.current = now;
         
         if (statusRef.current !== 'Walking') {
             setStatus('Walking');
         }
         
         if (navigator.vibrate) navigator.vibrate(15);
      }
    }

    // Idle Timeout: If no steps for 3 seconds, revert to Idle
    if (now - lastStepTime.current > 3000 && statusRef.current === 'Walking') {
        setStatus('Idle');
    }
  }, []);

  const toggleTracking = async () => {
    setError(null);

    if (isTracking) {
      // STOP
      window.removeEventListener('devicemotion', handleMotion);
      if (wakeLock.current) {
        await wakeLock.current.release();
        wakeLock.current = null;
      }
      setIsTracking(false);
      setStatus('Idle');
    } else {
      // START
      // @ts-ignore
      if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
        try {
            // @ts-ignore
            const permission = await DeviceMotionEvent.requestPermission();
            if (permission !== 'granted') {
                setError("Motion tracking permission denied. Check device settings.");
                return;
            }
        } catch (e: any) {
            console.error("Permission Request Error:", e);
            if (e.name === 'NotAllowedError') {
                setError("Access denied. Please enable motion permissions in your browser settings.");
            } else if (e.name === 'SecurityError') {
                setError("Security Block: Use HTTPS or localhost to enable sensors.");
            } else {
                setError("Unable to request motion access.");
            }
            return;
        }
      } else if (!window.DeviceMotionEvent) {
         setError("Motion sensors not supported on this device.");
         return;
      }

      try {
        window.addEventListener('devicemotion', handleMotion);
      
        if ('wakeLock' in navigator) {
            try {
            wakeLock.current = await navigator.wakeLock.request('screen');
            } catch (err) {
                console.warn("Wake Lock failed (non-critical):", err);
            }
        }
        
        setIsTracking(true);
        setStatus('Active');
        lastStepTime.current = Date.now();
      } catch (e) {
          setError("Failed to initialize sensor event listeners.");
          setIsTracking(false);
      }
    }
  };

  useEffect(() => {
    return () => {
      window.removeEventListener('devicemotion', handleMotion);
      if (wakeLock.current) wakeLock.current.release().catch(() => {});
    };
  }, [handleMotion]);

  return { isTracking, toggleTracking, liveSteps, resetLiveSteps: () => setLiveSteps(0), status, error, isSupported };
};

export default usePedometer;
