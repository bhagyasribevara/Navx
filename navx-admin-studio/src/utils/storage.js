import { Platform } from 'react-native';

let AsyncStorage = null;
try {
  AsyncStorage = require('@react-native-async-storage/async-storage').default;
} catch (e) {
  AsyncStorage = null;
}

// In-memory fallback dictionary
const memoryStore = new Map();

/**
 * Universal safe storage wrapper.
 * Automatically falls back to localStorage or in-memory storage
 * if AsyncStorage native module is unavailable.
 */
const safeStorage = {
  async getItem(key) {
    try {
      if (AsyncStorage && typeof AsyncStorage.getItem === 'function') {
        const value = await AsyncStorage.getItem(key);
        if (value !== null && value !== undefined) return value;
      }
    } catch (e) {
      // Fallback
    }

    // Fallback: Web localStorage
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      try {
        return window.localStorage.getItem(key);
      } catch (e) {}
    }

    // Fallback: In-memory
    return memoryStore.has(key) ? memoryStore.get(key) : null;
  },

  async setItem(key, value) {
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    
    // In-memory cache update
    memoryStore.set(key, stringValue);

    // Fallback: Web localStorage
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(key, stringValue);
      } catch (e) {}
    }

    try {
      if (AsyncStorage && typeof AsyncStorage.setItem === 'function') {
        await AsyncStorage.setItem(key, stringValue);
      }
    } catch (e) {
      // Non-blocking fallback
    }
  },

  async removeItem(key) {
    memoryStore.delete(key);

    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.removeItem(key);
      } catch (e) {}
    }

    try {
      if (AsyncStorage && typeof AsyncStorage.removeItem === 'function') {
        await AsyncStorage.removeItem(key);
      }
    } catch (e) {
      // Non-blocking fallback
    }
  },

  async clear() {
    memoryStore.clear();

    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.clear();
      } catch (e) {}
    }

    try {
      if (AsyncStorage && typeof AsyncStorage.clear === 'function') {
        await AsyncStorage.clear();
      }
    } catch (e) {}
  }
};

export default safeStorage;
