import { useState, useEffect } from 'react';

// Simple compression for base64 images - strips unnecessary parts
function compressAvatar(avatar: string): string {
  if (!avatar || !avatar.startsWith('data:image')) {
    return avatar;
  }
  // For default SVG avatars, keep them as-is (they're already small)
  if (avatar.includes('image/svg+xml')) {
    return avatar;
  }
  // For PNG avatars, we could implement actual compression here
  // For now, just return as-is
  return avatar;
}

function decompressAvatar(avatar: string): string {
  // In a real implementation, we'd decompress here
  return avatar;
}

// Helper to estimate size of data in bytes
function estimateSize(data: any): number {
  const str = JSON.stringify(data);
  return new Blob([str]).size;
}

// Check if we're approaching localStorage limit
function isApproachingQuota(): boolean {
  try {
    const testKey = '__quota_test__';
    const testData = new Array(1024).join('a'); // 1KB test
    localStorage.setItem(testKey, testData);
    localStorage.removeItem(testKey);
    return false;
  } catch (e) {
    return true;
  }
}

function getStorageValue<T,>(key: string, defaultValue: T): T {
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem(key);
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        // Decompress avatars if needed
        if (key === 'personas' && Array.isArray(parsed)) {
          return parsed.map((p: any) => ({
            ...p,
            avatar: decompressAvatar(p.avatar)
          })) as T;
        }
        return parsed;
      }
    } catch (e) {
      console.error("Failed to parse from localStorage", e);
      // If quota exceeded on read, clear the problematic key
      if (e instanceof Error && e.name === 'QuotaExceededError') {
        localStorage.removeItem(key);
      }
      return defaultValue;
    }
  }
  return defaultValue;
}

export const useLocalStorageWithCompression = <T,>(
  key: string, 
  defaultValue: T
): [T, React.Dispatch<React.SetStateAction<T>>] => {
  const [value, setValue] = useState<T>(() => {
    return getStorageValue(key, defaultValue);
  });

  useEffect(() => {
    try {
      let dataToStore = value;
      
      // Compress avatars for personas
      if (key === 'personas' && Array.isArray(value)) {
        dataToStore = value.map((p: any) => ({
          ...p,
          avatar: compressAvatar(p.avatar)
        })) as T;
      }

      const dataStr = JSON.stringify(dataToStore);
      const sizeInMB = estimateSize(dataToStore) / (1024 * 1024);
      
      // Warn if data is getting large
      if (sizeInMB > 2) {
        console.warn(`localStorage key "${key}" is using ${sizeInMB.toFixed(2)}MB`);
      }

      // Check if we're approaching quota
      if (isApproachingQuota()) {
        console.error('Approaching localStorage quota limit');
        // Could implement cleanup here
      }

      localStorage.setItem(key, dataStr);
    } catch (e) {
      console.error(`Failed to save to localStorage:`, e);
      if (e instanceof Error && e.name === 'QuotaExceededError') {
        alert('Storage quota exceeded. Some data may not be saved. Try clearing old chats or reducing the number of personas.');
      }
    }
  }, [key, value]);

  return [value, setValue];
}; 