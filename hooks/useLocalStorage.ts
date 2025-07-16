
import { useState, useEffect } from 'react';

function getStorageValue<T,>(key: string, defaultValue: T): T {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(key);
    if (saved !== null) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse from localStorage", e);
        return defaultValue;
      }
    }
  }
  return defaultValue;
}

export const useLocalStorage = <T,>(key:string, defaultValue:T): [T, React.Dispatch<React.SetStateAction<T>>] => {
  const [value, setValue] = useState<T>(() => {
    return getStorageValue(key, defaultValue);
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      if (e instanceof Error && e.name === 'QuotaExceededError') {
        console.error(`Failed to save ${key} to localStorage - quota exceeded`);
        alert(`Storage quota exceeded! Unable to save ${key}. Please open the storage manager (database icon) to free up space.`);
      } else {
        console.error(`Failed to save ${key} to localStorage:`, e);
      }
    }
  }, [key, value]);

  return [value, setValue];
};
