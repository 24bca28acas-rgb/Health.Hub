
import { useState, useEffect } from 'react';
import { performMaintenance } from '../services/supabase';

function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
  const readValue = (): T => {
    if (typeof window === 'undefined') {
      return initialValue;
    }

    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn(`Error reading localStorage key “${key}”:`, error);
      return initialValue;
    }
  };

  const [storedValue, setStoredValue] = useState<T>(readValue);

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(key, JSON.stringify(valueToStore));
          setStoredValue(valueToStore);
        } catch (error: any) {
          if (error.name === 'QuotaExceededError' || error.message.includes('quota')) {
            console.error(`[useLocalStorage] Quota Exceeded for key "${key}". Triggering emergency cleanup.`);
            
            // Try to clear non-essential space first
            performMaintenance(true);
            
            // Retry the set operation once
            try {
              window.localStorage.setItem(key, JSON.stringify(valueToStore));
              setStoredValue(valueToStore);
            } catch (retryError) {
              console.error(`[useLocalStorage] Retry failed. Critical storage failure for key "${key}".`);
            }
          } else {
            throw error;
          }
        }
      }
    } catch (error: any) {
      console.warn(`Error setting localStorage key “${key}”:`, error);
    }
  };

  useEffect(() => {
    setStoredValue(readValue());
  }, []);

  return [storedValue, setValue];
}

export default useLocalStorage;
